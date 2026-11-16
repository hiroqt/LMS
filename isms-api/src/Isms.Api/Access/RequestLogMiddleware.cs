namespace Isms.Api.Access;

/// <summary>
/// Writes one api_request_logs row per request: who (if authenticated), what, the required
/// permission and the outcome. Headers are never logged, so keys never reach the log.
/// </summary>
public sealed class RequestLogMiddleware(RequestDelegate next, ILogger<RequestLogMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context, ApiAccessDbContext db, TimeProvider clock)
    {
        var timestamp = clock.GetUtcNow().UtcDateTime;
        var failed = false;
        try
        {
            await next(context);
        }
        catch
        {
            failed = true;
            throw;
        }
        finally
        {
            var path = context.Request.Path.Value ?? "";
            db.RequestLogs.Add(new ApiRequestLog
            {
                Timestamp = timestamp,
                ClientUsername = context.User.Identity?.IsAuthenticated == true ? context.User.Identity.Name : null,
                Method = context.Request.Method,
                Path = path.Length > 512 ? path[..512] : path,
                RequiredPermission = context.GetEndpoint()?.Metadata.GetMetadata<RequiredPermission>()?.Permission,
                StatusCode = failed ? StatusCodes.Status500InternalServerError : context.Response.StatusCode,
                RemoteIp = context.Connection.RemoteIpAddress?.ToString(),
            });
            try
            {
                await db.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception ex)
            {
                // Logging must never take the API down; surface it in the app log instead.
                logger.LogError(ex, "Failed to write request log row for {Method} {Path}", context.Request.Method, path);
            }
        }
    }
}
