using System.IO.Compression;
using System.Text;
using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Files;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Submissions;

/// <summary>
/// Every student's latest handed-in work of one assignment as one zip (D-062, contract §13), for
/// the class's instructor: a folder per student with their files and, when they wrote an answer
/// or gave a link, <c>answer.txt</c>. Built as it is sent, never on disk. Capped, because the
/// browser must hold the whole file to save it (L-075).
/// </summary>
public static class DownloadEndpoints
{
    public const long MaxZipBytes = 250L * 1024 * 1024;

    public static IEndpointRouteBuilder MapDownloadEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGroup("/api/classes/{classId}/coursework/{courseworkId:long}").RequireDemoUser().MapGet("/submissions.zip", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, IFileStore store, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForGradingAsync(classId, user, ct);
            if (denied is not null) return denied;
            var cw = await db.Coursework.AsNoTracking().SingleOrDefaultAsync(c => c.Id == courseworkId && c.ClassId == classId, ct);
            if (cw is null) return ContentEndpoints.NotFound("Coursework");
            if (cw.Type != CourseworkType.Assignment) return Conflict("Only an assignment's work can be downloaded.");

            var handedIn = await db.Submissions.AsNoTracking().Where(s => s.CourseworkId == cw.Id && s.Status != SubmissionStatus.InProgress && s.Status != SubmissionStatus.Withdrawn && s.SubmittedAt != null).ToListAsync(ct);
            var latest = handedIn.GroupBy(s => s.StudentId).Select(g => g.MaxBy(s => s.AttemptNumber)!).ToList();
            var files = await AssignmentFiles.RowsAsync(db, latest.Select(s => s.Id).ToList(), ct);
            if (files.SelectMany(g => g).Sum(f => f.Size) > MaxZipBytes)
                return Conflict("These files add up to more than 250 MB. Download them from each student's work instead.");
            var ids = latest.Select(s => s.StudentId).ToList();
            var names = await db.IsmsClassStudents.AsNoTracking().Where(s => s.ClassId == classId && ids.Contains(s.StudentId)).ToDictionaryAsync(s => s.StudentId, ct);

            // Metadata only: which assignment and how many students, never a name or a file.
            db.AuditLog.Add(new AuditLogEntry
            {
                ActorId = user.Id, ActorRole = user.Role, Category = "files", Action = "downloaded", Target = "Assignment",
                TargetId = cw.Id.ToString(System.Globalization.CultureInfo.InvariantCulture), Summary = $"Work of {latest.Count} students downloaded",
            });
            await db.SaveChangesAsync(ct);

            var folders = latest
                .Select(s => (Submission: s, Folder: names.TryGetValue(s.StudentId, out var n) ? FileNames.Clean($"{n.LastName}, {n.FirstName} ({s.StudentId})") : FileNames.Clean(s.StudentId)))
                .OrderBy(x => x.Folder, StringComparer.OrdinalIgnoreCase).ToList();
            http.Response.Headers.XContentTypeOptions = "nosniff";
            http.Response.Headers.CacheControl = "private, no-store";
            return TypedResults.Stream(async body =>
            {
                // The zip writer writes synchronously in places, which the response refuses, so it
                // writes into memory and what it wrote is passed on after every chunk.
                var sink = new DrainStream();
                using (var zip = new ZipArchive(sink, ZipArchiveMode.Create, leaveOpen: true, entryNameEncoding: Encoding.UTF8))
                {
                    var buffer = new byte[81920];
                    foreach (var (submission, folder) in folders)
                    {
                        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        if (submission.Text is not null || submission.Link is not null)
                        {
                            var answer = new StringBuilder();
                            if (submission.Link is not null) answer.Append("Link: ").AppendLine(submission.Link).AppendLine();
                            if (submission.Text is not null) answer.AppendLine(submission.Text);
                            using (var entry = zip.CreateEntry($"{folder}/{Unique(used, "answer.txt")}", CompressionLevel.Fastest).Open())
                                entry.Write(Encoding.UTF8.GetBytes(answer.ToString()));
                            await sink.DrainAsync(body, ct);
                        }
                        foreach (var file in files[submission.Id])
                        {
                            await using var content = store.OpenRead(file.StorageKey);
                            if (content is null) continue; // the row outlived its bytes; the rest is still worth having
                            using (var entry = zip.CreateEntry($"{folder}/{Unique(used, file.Name)}", CompressionLevel.Fastest).Open())
                            {
                                int read;
                                while ((read = await content.ReadAsync(buffer, ct)) > 0)
                                {
                                    entry.Write(buffer, 0, read);
                                    await sink.DrainAsync(body, ct);
                                }
                            }
                            await sink.DrainAsync(body, ct);
                        }
                    }
                }
                await sink.DrainAsync(body, ct);
            }, "application/zip", $"{FileNames.Clean(cw.Title)}-work.zip");
        }).WithName("DownloadSubmissions");

        return app;
    }

    /// <summary>"notes.txt", then "notes (2).txt" when the folder already has one.</summary>
    internal static string Unique(HashSet<string> used, string name)
    {
        var candidate = name;
        for (var n = 2; !used.Add(candidate); n++)
            candidate = $"{Path.GetFileNameWithoutExtension(name)} ({n}){Path.GetExtension(name)}";
        return candidate;
    }

    private static IResult Conflict(string title) => TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: title);

    /// <summary>A write-only, unseekable stream that keeps what is written until it is drained to another stream.</summary>
    private sealed class DrainStream : Stream
    {
        private readonly MemoryStream _pending = new();
        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override bool CanWrite => true;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => _pending.Write(buffer, offset, count);

        public async Task DrainAsync(Stream target, CancellationToken ct)
        {
            if (_pending.Length == 0) return;
            await target.WriteAsync(_pending.GetBuffer().AsMemory(0, (int)_pending.Length), ct);
            _pending.SetLength(0);
        }
    }
}
