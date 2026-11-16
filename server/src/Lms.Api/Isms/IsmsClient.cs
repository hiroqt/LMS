using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;

namespace Lms.Api.Isms;

/// <summary>
/// HTTP implementation of <see cref="IIsmsClient"/>. Base address, credential headers and the
/// overall timeout are set where the client is registered (see <see cref="IsmsServiceCollectionExtensions"/>);
/// per-attempt timeout and retries live in <see cref="IsmsRetryHandler"/>.
/// </summary>
internal sealed class IsmsClient(HttpClient http, IOptions<IsmsOptions> options, ILogger<IsmsClient> logger) : IIsmsClient
{
    // Safety net against an ISMS that never reports the last page.
    private const int MaxPages = 1000;

    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    public Task<IReadOnlyList<IsmsLookup>> GetSchoolYearsAsync(CancellationToken ct = default) =>
        GetAllPagesAsync<IsmsLookup>("v1/school-years", [], ct);

    public Task<IReadOnlyList<IsmsLookup>> GetSemestersAsync(CancellationToken ct = default) =>
        GetAllPagesAsync<IsmsLookup>("v1/semesters", [], ct);

    public Task<IReadOnlyList<IsmsSubject>> GetSubjectsAsync(CancellationToken ct = default) =>
        GetAllPagesAsync<IsmsSubject>("v1/subjects", [], ct);

    public Task<IReadOnlyList<IsmsInstructor>> GetInstructorsAsync(CancellationToken ct = default) =>
        GetAllPagesAsync<IsmsInstructor>("v1/instructors", [], ct);

    public Task<IReadOnlyList<IsmsSchedule>> GetSchedulesAsync(IsmsScheduleQuery query, CancellationToken ct = default)
    {
        var filters = new List<KeyValuePair<string, string>>();
        if (query.SchoolYearId is { } sy) filters.Add(new("schoolYearId", sy.ToString()));
        if (query.SemesterId is { } sem) filters.Add(new("semesterId", sem.ToString()));
        if (!string.IsNullOrWhiteSpace(query.InstructorId)) filters.Add(new("instructorId", query.InstructorId));
        if (query.SubjectId is { } subj) filters.Add(new("subjectId", subj.ToString()));
        return GetAllPagesAsync<IsmsSchedule>("v1/schedules", filters, ct);
    }

    public Task<IReadOnlyList<IsmsStudent>> GetScheduleStudentsAsync(string scheduleId, CancellationToken ct = default) =>
        GetAllPagesAsync<IsmsStudent>($"v1/schedules/{Uri.EscapeDataString(scheduleId)}/students", [], ct);

    public async Task<IsmsProbeResult> ProbeAsync(CancellationToken ct = default)
    {
        try
        {
            using var response = await http.GetAsync("v1/subjects?page=1&pageSize=1", ct);
            return new IsmsProbeResult((int)response.StatusCode);
        }
        catch (Exception ex) when (IsNetworkFailure(ex, ct))
        {
            logger.LogWarning("ISMS status probe failed: {ErrorType}", ex.GetType().Name);
            return new IsmsProbeResult(null);
        }
    }

    private async Task<IReadOnlyList<T>> GetAllPagesAsync<T>(string path, IReadOnlyList<KeyValuePair<string, string>> filters, CancellationToken ct)
    {
        var requestedPageSize = Math.Clamp(options.Value.PageSize, 1, 200);
        var all = new List<T>();

        for (var page = 1; page <= MaxPages; page++)
        {
            var result = await GetPageAsync<T>(BuildUri(path, filters, page, requestedPageSize), path, ct);
            var items = result.Items ?? [];
            all.AddRange(items);

            if (items.Count == 0) break;
            if (result.Total > 0)
            {
                if (all.Count >= result.Total) break;
            }
            else
            {
                // No usable total: a short page is the last page. ISMS may cap pageSize, so
                // compare against the size it says it used.
                var effectivePageSize = result.PageSize > 0 ? result.PageSize : requestedPageSize;
                if (items.Count < effectivePageSize) break;
            }
        }

        return all;
    }

    private async Task<IsmsPage<T>> GetPageAsync<T>(string uri, string pathForMessages, CancellationToken ct)
    {
        HttpResponseMessage response;
        try
        {
            response = await http.GetAsync(uri, ct);
        }
        catch (Exception ex) when (IsNetworkFailure(ex, ct))
        {
            logger.LogWarning("ISMS request to {Path} failed: {ErrorType}", pathForMessages, ex.GetType().Name);
            throw new IsmsException(IsmsFailure.Unreachable, "The ISMS API could not be reached or did not respond in time.", inner: ex);
        }

        using (response)
        {
            var status = (int)response.StatusCode;
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("ISMS request to {Path} answered {StatusCode}", pathForMessages, status);
                throw response.StatusCode switch
                {
                    HttpStatusCode.Unauthorized => new IsmsException(IsmsFailure.Unauthorized, "The ISMS API rejected the LMS's client id or API key (401).", status),
                    HttpStatusCode.Forbidden => new IsmsException(IsmsFailure.Forbidden, "The ISMS API refused this request: the LMS's client lacks the permission (403).", status),
                    HttpStatusCode.TooManyRequests => new IsmsException(IsmsFailure.RateLimited, "The ISMS API is rate limiting the LMS (429).", status, RetryAfterOf(response)),
                    HttpStatusCode.NotFound => new IsmsException(IsmsFailure.NotFound, "The ISMS API has no such record (404).", status),
                    _ when status >= 500 => new IsmsException(IsmsFailure.Unreachable, $"The ISMS API is unavailable ({status}).", status, RetryAfterOf(response)),
                    _ => new IsmsException(IsmsFailure.BadResponse, $"The ISMS API answered an unexpected status ({status}).", status),
                };
            }

            try
            {
                var page = await response.Content.ReadFromJsonAsync<IsmsPage<T>>(Json, ct);
                return page ?? throw new JsonException("Empty body.");
            }
            catch (Exception ex) when (ex is JsonException or NotSupportedException)
            {
                logger.LogWarning("ISMS response from {Path} could not be parsed: {ErrorType}", pathForMessages, ex.GetType().Name);
                throw new IsmsException(IsmsFailure.BadResponse, "The ISMS API sent a response the LMS could not read.", status, inner: ex);
            }
        }
    }

    private static string BuildUri(string path, IReadOnlyList<KeyValuePair<string, string>> filters, int page, int pageSize)
    {
        var sb = new StringBuilder(path).Append("?page=").Append(page).Append("&pageSize=").Append(pageSize);
        foreach (var (key, value) in filters)
        {
            sb.Append('&').Append(key).Append('=').Append(Uri.EscapeDataString(value));
        }
        return sb.ToString();
    }

    private static TimeSpan? RetryAfterOf(HttpResponseMessage response)
    {
        var retryAfter = response.Headers.RetryAfter;
        if (retryAfter?.Delta is { } delta) return delta;
        if (retryAfter?.Date is { } date) return date - DateTimeOffset.UtcNow;
        return null;
    }

    private static bool IsNetworkFailure(Exception ex, CancellationToken callerToken) =>
        ex is HttpRequestException or TimeoutException
        || (ex is OperationCanceledException && !callerToken.IsCancellationRequested);
}
