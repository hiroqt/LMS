namespace Lms.Api.Isms;

public enum IsmsFailure
{
    /// <summary>Network error, timeout, or a 5xx from ISMS.</summary>
    Unreachable,
    /// <summary>ISMS answered 401: the LMS's client id / API key is wrong or missing.</summary>
    Unauthorized,
    /// <summary>ISMS answered 403: the LMS's client lacks the permission.</summary>
    Forbidden,
    /// <summary>ISMS answered 429.</summary>
    RateLimited,
    /// <summary>ISMS answered 404.</summary>
    NotFound,
    /// <summary>ISMS answered something the LMS could not understand.</summary>
    BadResponse,
}

/// <summary>
/// A failed ISMS call. Messages are written by the LMS and never contain the API key,
/// the base URL, or ISMS response bodies, so they are safe to log.
/// </summary>
public sealed class IsmsException(IsmsFailure failure, string message, int? statusCode = null, TimeSpan? retryAfter = null, Exception? inner = null)
    : Exception(message, inner)
{
    public IsmsFailure Failure { get; } = failure;

    /// <summary>The HTTP status ISMS answered with, if it answered.</summary>
    public int? StatusCode { get; } = statusCode;

    /// <summary>Retry-After hint from ISMS, when it sent one.</summary>
    public TimeSpan? RetryAfter { get; } = retryAfter;

    /// <summary>Whether a stale cached copy may be served instead of failing.</summary>
    public bool AllowsStaleServe => Failure is IsmsFailure.Unreachable or IsmsFailure.RateLimited;
}
