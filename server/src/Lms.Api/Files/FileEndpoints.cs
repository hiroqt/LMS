using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Files;

/// <summary>
/// Downloads (contract §8). A file is served only through here: to the student who uploaded it,
/// and to the instructor of its class once it is part of handed-in work. Everyone else gets the
/// same 404 as for a file that doesn't exist, so ids cannot be probed. The response can only be
/// saved, never run in the page: no sniffing, an attachment, and a sandbox policy.
/// </summary>
public static class FileEndpoints
{
    public static IEndpointRouteBuilder MapFileEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGroup("/api/files").RequireDemoUser().MapGet("/{id:long}", async Task<IResult> (long id, HttpContext http, ClassAccess access, LmsDbContext db, IFileStore store, ILoggerFactory logs, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var file = await db.StoredFiles.AsNoTracking().SingleOrDefaultAsync(f => f.Id == id && f.DeletedAt == null, ct);
            if (file is null) return ContentEndpoints.NotFound("File");
            var (_, denied) = await access.ForReadAsync(file.ClassId, user, ct);
            if (denied is not null) return ContentEndpoints.NotFound("File");
            var allowed = user.IsStudent
                ? file.OwnerId == user.Id
                // A draft is the student's own, and so is a version they took back (D-054, D-058).
                : await db.SubmissionFiles.AnyAsync(l => l.FileId == file.Id && db.Submissions.Any(s => s.Id == l.SubmissionId
                    && s.Status != SubmissionStatus.InProgress && s.Status != SubmissionStatus.Withdrawn), ct);
            if (!allowed) return ContentEndpoints.NotFound("File");

            var content = store.OpenRead(file.StorageKey);
            if (content is null)
            {
                logs.CreateLogger(typeof(FileEndpoints)).LogError("Stored file {FileId} has no bytes in the file store", file.Id);
                return ContentEndpoints.NotFound("File");
            }
            var headers = http.Response.Headers;
            headers.XContentTypeOptions = "nosniff";
            headers.ContentSecurityPolicy = "sandbox";
            headers.CacheControl = "private, no-store";
            // A download name makes this "Content-Disposition: attachment".
            return TypedResults.Stream(content, file.ContentType, file.Name);
        }).WithName("DownloadFile");

        return app;
    }
}
