using Lms.Api.Isms;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Lms.Api.Endpoints;

/// <summary>
/// Turns <see cref="IsmsException"/> into RFC 7807 problem details. 401/403 from ISMS are the
/// LMS server's own misconfiguration, so they surface as 502 rather than being passed through
/// to the browser as if the signed-in user were at fault. Nothing secret goes in the body.
/// </summary>
internal sealed class IsmsExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not IsmsException ex) return false;

        var (status, code, title, detail) = ex.Failure switch
        {
            IsmsFailure.Unauthorized => (StatusCodes.Status502BadGateway, "isms_unauthorized",
                "ISMS rejected the LMS's credentials",
                "The ISMS API answered 401: the LMS server's ISMS client id or API key is missing, wrong or revoked. This is a server configuration problem, not something the signed-in user can fix."),
            IsmsFailure.Forbidden => (StatusCodes.Status502BadGateway, "isms_forbidden",
                "The LMS is not permitted to read this from ISMS",
                "The ISMS API answered 403: the LMS's ISMS client lacks the permission for this data. An ISMS administrator must grant it."),
            IsmsFailure.RateLimited => (StatusCodes.Status503ServiceUnavailable, "isms_rate_limited",
                "ISMS is busy",
                "The ISMS API is rate limiting the LMS and no cached copy is available. Try again shortly."),
            IsmsFailure.NotFound => (StatusCodes.Status404NotFound, "isms_not_found",
                "Not found in ISMS",
                "ISMS has no record for this request."),
            IsmsFailure.BadResponse => (StatusCodes.Status502BadGateway, "isms_bad_response",
                "ISMS sent an unexpected response",
                "The LMS could not read the ISMS API's response."),
            _ => (StatusCodes.Status503ServiceUnavailable, "isms_unavailable",
                "ISMS is unavailable",
                "The ISMS API could not be reached and no cached copy is available. Try again shortly."),
        };

        context.Response.StatusCode = status;
        if (status == StatusCodes.Status503ServiceUnavailable)
        {
            var retryAfter = ex.RetryAfter is { } r && r > TimeSpan.Zero ? (int)Math.Ceiling(r.TotalSeconds) : 30;
            context.Response.Headers.RetryAfter = retryAfter.ToString();
        }

        var problem = new ProblemDetails { Status = status, Title = title, Detail = detail };
        problem.Extensions["code"] = code;
        if (ex.StatusCode is { } ismsStatus) problem.Extensions["ismsStatus"] = ismsStatus;

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = problem,
            Exception = exception,
        });
    }
}
