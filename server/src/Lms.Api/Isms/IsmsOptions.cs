using Microsoft.Extensions.Options;

namespace Lms.Api.Isms;

/// <summary>Settings for calling the ISMS API (configuration section "Isms").</summary>
public sealed class IsmsOptions
{
    public const string SectionName = "Isms";

    /// <summary>Base URL of the ISMS API, e.g. http://localhost:5100.</summary>
    public string BaseUrl { get; set; } = "";

    /// <summary>Sent as X-Client-Id.</summary>
    public string ClientId { get; set; } = "";

    /// <summary>Sent as X-Api-Key. Must come from user-secrets or environment variables.</summary>
    public string ApiKey { get; set; } = "";

    /// <summary>Per-attempt timeout for one ISMS request.</summary>
    public int TimeoutSeconds { get; set; } = 10;

    /// <summary>Extra attempts after a transient failure (network error, timeout, 408/502/503/504).</summary>
    public int MaxRetries { get; set; } = 2;

    /// <summary>Base back-off between attempts; attempt n waits n times this.</summary>
    public int RetryDelayMilliseconds { get; set; } = 250;

    /// <summary>Page size requested from ISMS list endpoints (ISMS maximum is 200).</summary>
    public int PageSize { get; set; } = 200;

    /// <summary>How long a cached ISMS read is considered fresh.</summary>
    public int CacheTtlSeconds { get; set; } = 300;

    /// <summary>
    /// How long past its TTL a cached read may still be served when ISMS is unreachable
    /// or rate limiting. 0 disables stale-serve.
    /// </summary>
    public int MaxStaleSeconds { get; set; } = 86400;
}

/// <summary>Fails startup with a clear message when the ISMS settings are missing or invalid.</summary>
internal sealed class IsmsOptionsValidator : IValidateOptions<IsmsOptions>
{
    public ValidateOptionsResult Validate(string? name, IsmsOptions o)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(o.BaseUrl))
        {
            errors.Add("Isms:BaseUrl is not set. Set it in appsettings.{Environment}.json or the Isms__BaseUrl environment variable.");
        }
        else if (!Uri.TryCreate(o.BaseUrl, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            errors.Add("Isms:BaseUrl must be an absolute http(s) URL.");
        }

        if (string.IsNullOrWhiteSpace(o.ClientId))
        {
            errors.Add("Isms:ClientId is not set. Run `dotnet user-secrets set Isms:ClientId <id>` in server/src/Lms.Api or set the Isms__ClientId environment variable.");
        }

        if (string.IsNullOrWhiteSpace(o.ApiKey))
        {
            errors.Add("Isms:ApiKey is not set. Run `dotnet user-secrets set Isms:ApiKey <key>` in server/src/Lms.Api or set the Isms__ApiKey environment variable. Never put the key in a committed appsettings file.");
        }

        if (o.TimeoutSeconds <= 0) errors.Add("Isms:TimeoutSeconds must be greater than 0.");
        if (o.MaxRetries < 0) errors.Add("Isms:MaxRetries must be 0 or more.");
        if (o.RetryDelayMilliseconds < 0) errors.Add("Isms:RetryDelayMilliseconds must be 0 or more.");
        if (o.PageSize is < 1 or > 200) errors.Add("Isms:PageSize must be between 1 and 200.");
        if (o.CacheTtlSeconds < 0) errors.Add("Isms:CacheTtlSeconds must be 0 or more.");
        if (o.MaxStaleSeconds < 0) errors.Add("Isms:MaxStaleSeconds must be 0 or more.");

        return errors.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(errors);
    }
}
