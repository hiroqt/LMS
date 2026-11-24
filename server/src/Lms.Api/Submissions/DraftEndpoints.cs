using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Files;
using Lms.Api.Identity;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using CourseworkRow = Lms.Api.Data.Coursework;
using FileOptions = Lms.Api.Files.FileOptions;

namespace Lms.Api.Submissions;

/// <summary>
/// A student's work on an assignment before and at turn-in (contract §7): the draft (text, a link,
/// uploaded files), turning it in for a receipt, and taking turned-in work back. Every rule is
/// decided here from <see cref="AssignmentRules"/> and the assignment's hand-in settings; the
/// browser only shows the verdict.
/// </summary>
public static class DraftEndpoints
{
    internal const string NoText = "This assignment doesn't take a written answer.";
    internal const string NoFiles = "This assignment doesn't take files.";
    internal const string NoLink = "This assignment doesn't take a link.";
    internal const string ConfirmOwnWork = "Confirm that this is your own work.";
    internal const string NoLongerADraft = "This work was turned in a moment ago, so it can no longer be changed. Reload to see it.";
    private const int LinkMax = 2_000;
    private const string FileField = "file";

    public static IEndpointRouteBuilder MapDraftEndpoints(this IEndpointRouteBuilder app)
    {
        var work = app.MapGroup("/api/classes/{classId}/coursework/{courseworkId:long}").RequireDemoUser();

        work.MapPost("/draft", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (scope, refused) = await OpenAsync(classId, courseworkId, http, access, db, time, ct);
            if (refused is not null) return refused;
            var existed = scope!.Draft is not null;
            var (draft, failed) = await EnsureDraftAsync(db, scope, ct);
            if (failed is not null) return failed;
            var dto = await DtoAsync(db, scope.Cw, draft!, ct);
            return existed ? TypedResults.Ok(dto) : TypedResults.Created($"/api/classes/{classId}/coursework/{courseworkId}/draft", dto);
        }).WithName("StartDraft");

        work.MapPut("/draft", async Task<IResult> (string classId, long courseworkId, DraftInput input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (scope, refused) = await OpenAsync(classId, courseworkId, http, access, db, time, ct);
            if (refused is not null) return refused;
            if (scope!.Verdict.Reason is { } reason) return SubmissionEndpoints.Conflict(AssignmentRules.Message(reason, scope.Cw));

            var kinds = SubmissionKind.Parse(scope.Cw.SubmissionKinds);
            var errors = new Errors();
            var text = errors.Optional("text", input.Text, SubmissionEndpoints.TextMax);
            var link = errors.Optional("link", input.Link, LinkMax);
            if (text is not null && !kinds.Contains(SubmissionKind.Text)) errors.Add("text", NoText);
            if (link is not null && !kinds.Contains(SubmissionKind.Link)) errors.Add("link", NoLink);
            else if (link is not null && !(Uri.TryCreate(link, UriKind.Absolute, out var uri) && uri.Scheme is "http" or "https"))
                errors.Add("link", "Enter a full web address that starts with https:// or http://.");
            if (errors.Any) return errors.Result();

            var (draft, failed) = await EnsureDraftAsync(db, scope, ct, copyContent: false);
            if (failed is not null) return failed;
            draft!.Text = text;
            draft.Link = link;
            // Turned in a moment ago by another request: the turned-in work stays as it was.
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException) { return SubmissionEndpoints.Conflict(NoLongerADraft); }
            return TypedResults.Ok(await DtoAsync(db, scope.Cw, draft, ct));
        }).WithName("SaveDraft");

        work.MapPost("/draft/files", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time,
            IFileStore store, IFileScanner scanner, ILoggerFactory logs, CancellationToken ct) =>
        {
            var (scope, refused) = await OpenAsync(classId, courseworkId, http, access, db, time, ct);
            if (refused is not null) return refused;
            var cw = scope!.Cw;
            if (scope.Verdict.Reason is { } reason) return SubmissionEndpoints.Conflict(AssignmentRules.Message(reason, cw));
            if (!SubmissionKind.Parse(cw.SubmissionKinds).Contains(SubmissionKind.File)) return SubmissionEndpoints.Conflict(NoFiles);
            // With no draft yet, the new one starts as a copy of the latest version, files included.
            var basis = scope.Draft ?? scope.CopySource;
            var current = basis is null ? [] : (await AssignmentFiles.RowsAsync(db, [basis.Id], ct))[basis.Id].ToList();
            if (current.Count >= cw.MaxFiles) return SubmissionEndpoints.Conflict(AtMost(cw.MaxFiles));

            if (http.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } size) size.MaxRequestBodySize = FileLimits.MaxFileBytes + 64 * 1024;
            var (section, name) = await FileSectionAsync(http.Request, ct);
            if (section is null) return FileRefused("Choose a file to add.");

            IPendingFile pending;
            try { pending = await store.ReceiveAsync(section.Body, FileLimits.MaxFileBytes, ct); }
            catch (FileTooLargeException) { return FileRefused("This file is larger than 25 MB."); }
            catch (Exception e) when (e is InvalidDataException or BadHttpRequestException or IOException) { return FileRefused("The upload did not finish. Add the file again."); }

            await using (pending)
            {
                if (pending.Size == 0) return FileRefused("This file is empty.");
                Sniffed sniffed;
                await using (var content = pending.OpenRead()) sniffed = FileSniffer.Detect(content, name, ct);
                if (sniffed.Kind is not { } kind) return FileRefused(sniffed.Refusal!);
                var allowed = FileTypes.Parse(cw.AllowedFileTypes);
                if (!allowed.Contains(kind.Type)) return FileRefused($"This file is {kind.Label}. This assignment takes only: {string.Join(", ", allowed.Select(TypeLabel))}.");
                if (current.Any(f => f.ContentHash == pending.Sha256)) return FileRefused("You already added this file.");

                ScanResult scan;
                await using (var content = pending.OpenRead()) scan = await scanner.ScanAsync(content, ct);
                if (scan.Verdict == ScanVerdict.Unavailable)
                    return TypedResults.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "The virus scan is not available right now, so the file was not saved. Try again in a few minutes.");
                if (scan.Verdict == ScanVerdict.Infected)
                {
                    logs.CreateLogger(typeof(DraftEndpoints)).LogWarning("Upload refused by the virus scan: {Signature} (student {StudentId}, coursework {CourseworkId})", scan.Signature, scope.User.Id, cw.Id);
                    // Metadata only: who and where, never the file or its name.
                    SubmissionEndpoints.Audit(db, scope.User, "files", "refused", "Upload flagged by the virus scan", cw.Id);
                    await db.SaveChangesAsync(ct);
                    return FileRefused("The virus scan flagged this file, so it was not saved. Check it on your device, then add a clean copy.");
                }

                var (draft, failed) = await EnsureDraftAsync(db, scope, ct);
                if (failed is not null) return failed;
                var key = await pending.KeepAsync(ct);
                try
                {
                    await using var transaction = await db.Database.BeginTransactionAsync(ct);
                    // The scan can take a while; the draft may have been turned in meanwhile, and
                    // another upload may be finishing. The lock settles both (see LockDraftAsync).
                    if (!await AssignmentFiles.LockDraftAsync(db, draft!.Id, scope.Now, ct))
                    {
                        await transaction.RollbackAsync(ct);
                        store.Delete(key);
                        return SubmissionEndpoints.Conflict(NoLongerADraft);
                    }
                    var onDraft = (await AssignmentFiles.RowsAsync(db, [draft.Id], ct))[draft.Id].ToList();
                    if (onDraft.Count >= cw.MaxFiles || onDraft.Any(f => f.ContentHash == pending.Sha256))
                    {
                        await transaction.RollbackAsync(ct);
                        store.Delete(key);
                        return onDraft.Count >= cw.MaxFiles ? SubmissionEndpoints.Conflict(AtMost(cw.MaxFiles)) : FileRefused("You already added this file.");
                    }
                    var file = new StoredFile
                    {
                        ClassId = cw.ClassId, CourseworkId = cw.Id, OwnerId = scope.User.Id, StorageKey = key, Name = name,
                        ContentType = kind.ContentType, Size = pending.Size, ContentHash = pending.Sha256, ScanStatus = scanner.PassedStatus,
                    };
                    db.StoredFiles.Add(file);
                    await db.SaveChangesAsync(ct);
                    db.SubmissionFiles.Add(new SubmissionFile { SubmissionId = draft.Id, FileId = file.Id });
                    await db.SaveChangesAsync(ct);
                    await transaction.CommitAsync(ct);
                }
                catch
                {
                    store.Delete(key);
                    throw;
                }
                return TypedResults.Created($"/api/classes/{classId}/coursework/{courseworkId}/draft", await DtoAsync(db, cw, draft, ct));
            }
        }).WithName("AddDraftFile").RequireRateLimiting(FileOptions.UploadPolicy);

        work.MapDelete("/draft/files/{fileId:long}", async Task<IResult> (string classId, long courseworkId, long fileId, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time,
            IFileStore store, CancellationToken ct) =>
        {
            var (scope, refused) = await OpenAsync(classId, courseworkId, http, access, db, time, ct);
            if (refused is not null) return refused;
            if (scope!.Draft is not { } draft) return ContentEndpoints.NotFound("File");
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            // Turned in a moment ago: the file stays on the turned-in work.
            if (!await AssignmentFiles.LockDraftAsync(db, draft.Id, scope.Now, ct)) return ContentEndpoints.NotFound("File");
            var (found, unusedKey) = await AssignmentFiles.UnlinkAsync(db, draft.Id, fileId, scope.Now, ct);
            if (!found) return ContentEndpoints.NotFound("File");
            await transaction.CommitAsync(ct);
            // The bytes go only once the database says nothing uses them.
            if (unusedKey is not null) store.Delete(unusedKey);
            return TypedResults.Ok(await DtoAsync(db, scope.Cw, draft, ct));
        }).WithName("RemoveDraftFile");

        work.MapPost("/draft/turn-in", async Task<IResult> (string classId, long courseworkId, TurnInInput? input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (scope, refused) = await OpenAsync(classId, courseworkId, http, access, db, time, ct);
            if (refused is not null) return refused;
            var cw = scope!.Cw;
            if (scope.Draft is not { } draft)
            {
                // A repeat (a retry after a lost answer) gets the receipt of what was turned in.
                if (scope.LatestHandedIn is { } done) return TypedResults.Ok(await ReceiptAsync(db, cw, done, ct));
                return Work("Add your work before you turn it in.");
            }
            if (scope.Verdict.Reason is { } reason) return SubmissionEndpoints.Conflict(AssignmentRules.Message(reason, cw));

            if (await DraftProblemAsync(db, cw, draft, ct) is { } problem) return Work(problem);
            if (cw.HonorStatement && input?.HonorStatement != true)
            {
                var errors = new Errors();
                errors.Add("honorStatement", ConfirmOwnWork);
                return errors.Result();
            }

            draft.Status = SubmissionStatus.Submitted;
            draft.SubmittedAt = scope.Now;
            draft.HonorAcceptedAt = cw.HonorStatement ? scope.Now : null;
            try { await ContentEndpoints.SaveWithAuditAsync(db, scope.User, null, "submitted", "Assignment", () => draft.Id, ct, "submissions"); }
            catch (DbUpdateException) { return SubmissionEndpoints.Conflict("Another submission was saved at the same moment. Reload and try again."); }
            return TypedResults.Ok(await ReceiptAsync(db, cw, draft, ct));
        }).WithName("TurnInDraft");

        work.MapPost("/unsubmit", async Task<IResult> (string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (scope, refused) = await OpenAsync(classId, courseworkId, http, access, db, time, ct);
            if (refused is not null) return refused;
            if (!scope!.Verdict.CanUnsubmit || scope.LatestHandedIn is not { Status: SubmissionStatus.Submitted } latest || await db.Grades.AnyAsync(g => g.SubmissionId == latest.Id, ct))
                return SubmissionEndpoints.Conflict(AssignmentRules.CannotUnsubmit);

            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            latest.Status = SubmissionStatus.Withdrawn;
            var draft = scope.Draft;
            if (draft is null)
            {
                draft = new Submission
                {
                    CourseworkId = scope.Cw.Id, StudentId = scope.User.Id, AttemptNumber = SubmissionEndpoints.NextAttempt(scope.Mine),
                    Status = SubmissionStatus.InProgress, StartedAt = scope.Now, Text = latest.Text, Link = latest.Link,
                };
                db.Submissions.Add(draft);
                await db.SaveChangesAsync(ct);
                await AssignmentFiles.CopyLinksAsync(db, latest.Id, draft.Id, ct);
            }
            SubmissionEndpoints.Audit(db, scope.User, "submissions", "unsubmitted", "Assignment", latest.Id);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return SubmissionEndpoints.Conflict("Your work changed at the same moment. Reload and try again."); }
            await transaction.CommitAsync(ct);
            return TypedResults.Ok(await DtoAsync(db, scope.Cw, draft, ct));
        }).WithName("UnsubmitAssignment");

        return app;
    }

    /// <summary>One student, one assignment, at one moment: their rows and the server's verdict.</summary>
    /// <param name="Mine">Tracked, so a change to one of them is saved.</param>
    private sealed record Scope(CurrentUser User, CourseworkRow Cw, List<Submission> Mine, DateTime Now, TurnInStatus Verdict)
    {
        public Submission? Draft => Mine.FirstOrDefault(s => s.Status == SubmissionStatus.InProgress);

        /// <summary>The newest work the instructor can see (never a "not handed in" record).</summary>
        public Submission? LatestHandedIn => Mine.Where(s => GradingRules.IsHandedIn(s) && !GradingRules.IsNotHandedIn(s)).MaxBy(s => s.AttemptNumber);

        /// <summary>What a new draft starts as a copy of: the newest version, taken back or not.</summary>
        public Submission? CopySource => Mine.Where(s => s.Status != SubmissionStatus.InProgress && s.SubmittedAt is not null).MaxBy(s => s.AttemptNumber);
    }

    private static async Task<(Scope? Scope, IResult? Refused)> OpenAsync(string classId, long courseworkId, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct)
    {
        var user = http.CurrentUser();
        var (_, denied) = await access.ForStudentWorkAsync(classId, user, ct);
        if (denied is not null) return (null, denied);
        var cw = await SubmissionEndpoints.VisibleAsync(db, classId, courseworkId, time, ct);
        if (cw is null || cw.Type != CourseworkType.Assignment) return (null, ContentEndpoints.NotFound("Assignment"));
        var now = time.GetUtcNow().UtcDateTime;
        var mine = await db.Submissions.Where(s => s.CourseworkId == cw.Id && s.StudentId == user.Id).ToListAsync(ct);
        var exception = await AssignmentRules.ExceptionAsync(db, cw.Id, user.Id, ct);
        return (new Scope(user, cw, mine, now, AssignmentRules.Evaluate(cw, mine, now, exception)), null);
    }

    /// <summary>
    /// The student's draft, created when there is none and work can still be turned in. A new draft
    /// after turned-in work starts as a copy of it: the files always, the text and link unless the
    /// caller is about to set them.
    /// </summary>
    private static async Task<(Submission? Draft, IResult? Refused)> EnsureDraftAsync(LmsDbContext db, Scope scope, CancellationToken ct, bool copyContent = true)
    {
        if (scope.Draft is { } existing) return (existing, null);
        if (scope.Verdict.Reason is { } reason) return (null, SubmissionEndpoints.Conflict(AssignmentRules.Message(reason, scope.Cw)));
        var source = scope.CopySource;
        var draft = new Submission
        {
            CourseworkId = scope.Cw.Id, StudentId = scope.User.Id, AttemptNumber = SubmissionEndpoints.NextAttempt(scope.Mine),
            Status = SubmissionStatus.InProgress, StartedAt = scope.Now, Text = copyContent ? source?.Text : null, Link = copyContent ? source?.Link : null,
        };
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.Submissions.Add(draft);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            db.Entry(draft).State = EntityState.Detached;
            return (null, SubmissionEndpoints.Conflict("Another draft was started at the same moment. Reload and try again."));
        }
        if (source is not null)
        {
            await AssignmentFiles.CopyLinksAsync(db, source.Id, draft.Id, ct);
            await db.SaveChangesAsync(ct);
        }
        await transaction.CommitAsync(ct);
        scope.Mine.Add(draft);
        return (draft, null);
    }

    private static async Task<SubmissionDto> DtoAsync(LmsDbContext db, CourseworkRow cw, Submission row, CancellationToken ct) =>
        (await SubmissionEndpoints.ToDtoAsync(db, cw, [row], ct, forStudent: true))[0];

    private static async Task<TurnInReceipt> ReceiptAsync(LmsDbContext db, CourseworkRow cw, Submission row, CancellationToken ct)
    {
        var dto = await DtoAsync(db, cw, row, ct);
        return new TurnInReceipt(dto, new Receipt(row.Id, row.AttemptNumber, row.SubmittedAt!.Value, dto.Late,
            (dto.Files ?? []).Select(f => new ReceiptFile(f.Id, f.Name, f.Size, f.Code)).ToList()));
    }

    /// <summary>The first part named <c>file</c>, with its cleaned name. The body is read by the caller, straight to the store.</summary>
    private static async Task<(MultipartSection? Section, string Name)> FileSectionAsync(HttpRequest request, CancellationToken ct)
    {
        if (!MediaTypeHeaderValue.TryParse(request.ContentType, out var type)
            || !string.Equals(type.MediaType.Value, "multipart/form-data", StringComparison.OrdinalIgnoreCase)
            || HeaderUtilities.RemoveQuotes(type.Boundary).Value is not { Length: > 0 } boundary)
            return (null, "");
        try
        {
            var reader = new MultipartReader(boundary, request.Body);
            while (await reader.ReadNextSectionAsync(ct) is { } section)
            {
                if (ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition)
                    && string.Equals(HeaderUtilities.RemoveQuotes(disposition.Name).Value, FileField, StringComparison.Ordinal))
                    return (section, FileNames.Clean(disposition.FileNameStar.HasValue ? disposition.FileNameStar.Value : HeaderUtilities.RemoveQuotes(disposition.FileName).Value));
            }
        }
        catch (Exception e) when (e is InvalidDataException or BadHttpRequestException or IOException)
        {
            // Not valid multipart.
        }
        return (null, "");
    }

    /// <summary>
    /// Why a draft can't be turned in as it stands, or null when it can. The settings can change
    /// after a draft was started, so it is checked against today's. Both turn-in routes use this.
    /// </summary>
    internal static async Task<string?> DraftProblemAsync(LmsDbContext db, CourseworkRow cw, Submission draft, CancellationToken ct)
    {
        var files = (await AssignmentFiles.RowsAsync(db, [draft.Id], ct))[draft.Id].ToList();
        var kinds = SubmissionKind.Parse(cw.SubmissionKinds);
        if (draft.Text is not null && !kinds.Contains(SubmissionKind.Text)) return "This assignment no longer takes a written answer. Clear yours to turn in.";
        if (draft.Link is not null && !kinds.Contains(SubmissionKind.Link)) return "This assignment no longer takes a link. Remove yours to turn in.";
        if (files.Count > 0 && !kinds.Contains(SubmissionKind.File)) return "This assignment no longer takes files. Remove yours to turn in.";
        if (files.Count > cw.MaxFiles) return $"{AtMost(cw.MaxFiles)} Remove some to turn in.";
        var allowed = FileTypes.Parse(cw.AllowedFileTypes);
        if (files.FirstOrDefault(f => FileKind.TypeOf(f.ContentType) is not { } type || !allowed.Contains(type)) is { } unwanted)
            return $"This assignment no longer takes files like {unwanted.Name}. Remove it to turn in.";
        if (draft.Text is null && draft.Link is null && draft.FileName is null && files.Count == 0) return "Add your work before you turn it in.";
        return null;
    }

    private static string AtMost(int max) => $"This assignment takes at most {max} {(max == 1 ? "file" : "files")}.";

    private static string TypeLabel(string type) => type switch
    {
        FileTypes.Pdf => "PDF",
        FileTypes.Word => "Word (.docx)",
        FileTypes.PowerPoint => "PowerPoint (.pptx)",
        FileTypes.Excel => "Excel (.xlsx)",
        FileTypes.Image => "JPEG or PNG images",
        _ => "text files (.txt)",
    };

    private static IResult FileRefused(string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [FileField] = [message] }, statusCode: StatusCodes.Status422UnprocessableEntity);

    private static IResult Work(string message)
    {
        var errors = new Errors();
        errors.Add("work", message);
        return errors.Result();
    }
}
