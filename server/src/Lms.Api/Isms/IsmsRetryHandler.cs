using System.Net;
using Microsoft.Extensions.Options;

namespace Lms.Api.Isms;

/// <summary>
/// Per-attempt timeout plus a small retry for transient ISMS failures: network errors,
/// timeouts and 408/502/503/504. 401/403/429 and other 4xx are never retried.
/// </summary>
internal sealed class IsmsRetryHandler(IOptions<IsmsOptions> options, ILogger<IsmsRetryHandler> logger) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var o = options.Value;
        var attempts = Math.Max(0, o.MaxRetries) + 1;

        for (var attempt = 1; ; attempt++)
        {
            using var attemptCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            attemptCts.CancelAfter(TimeSpan.FromSeconds(o.TimeoutSeconds));
            var isLastAttempt = attempt >= attempts;

            try
            {
                var response = await base.SendAsync(request, attemptCts.Token);
                if (isLastAttempt || !IsTransient(response.StatusCode))
                {
                    return response;
                }

                logger.LogInformation("ISMS answered {StatusCode}; retrying (attempt {Attempt} of {Attempts})", (int)response.StatusCode, attempt + 1, attempts);
                response.Dispose();
            }
            catch (HttpRequestException ex) when (!isLastAttempt)
            {
                logger.LogInformation("ISMS request failed ({ErrorType}); retrying (attempt {Attempt} of {Attempts})", ex.GetType().Name, attempt + 1, attempts);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested && !isLastAttempt)
            {
                logger.LogInformation("ISMS request timed out; retrying (attempt {Attempt} of {Attempts})", attempt + 1, attempts);
            }
            catch (OperationCanceledException ex) when (!cancellationToken.IsCancellationRequested)
            {
                throw new TimeoutException($"ISMS did not respond within {o.TimeoutSeconds}s.", ex);
            }

            await Task.Delay(TimeSpan.FromMilliseconds(o.RetryDelayMilliseconds * attempt), cancellationToken);
        }
    }

    private static bool IsTransient(HttpStatusCode status) =>
        status is HttpStatusCode.RequestTimeout or HttpStatusCode.BadGateway or HttpStatusCode.ServiceUnavailable or HttpStatusCode.GatewayTimeout;
}
