using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Endpoints;

/// <summary>
/// Two requests changed the same row at the same moment (for example, an instructor graded work
/// just as the student took it back), and the later one lost. It did nothing; the caller reloads
/// and decides again. Answered as 409, like every other "the state changed" refusal.
/// </summary>
internal sealed class ConcurrencyExceptionHandler(IProblemDetailsService problemDetails) : IExceptionHandler
{
    public const string Title = "This changed at the same moment. Reload and try again.";

    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not DbUpdateConcurrencyException) return false;
        context.Response.StatusCode = StatusCodes.Status409Conflict;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = { Status = StatusCodes.Status409Conflict, Title = Title },
        });
    }
}
