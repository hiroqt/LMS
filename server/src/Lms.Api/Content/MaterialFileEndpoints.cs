using System.Globalization;
using System.Text;
using Lms.Api.Data;
using Lms.Api.Files;
using Lms.Api.Identity;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using FileOptions = Lms.Api.Files.FileOptions;

namespace Lms.Api.Content;

/// <summary>
/// The file of a class material (D-067): sent with a new material or added later, replaced,
/// removed, downloaded, and previewed. Files are received, checked and scanned like turn-ins (D-055).
/// Word, PowerPoint and Excel files also get a PDF copy for their preview, made during the upload.
/// Only these routes serve a material's files: to the class's instructor, and to a student on the
/// class list while the material is active. Everyone else gets the same 404 as for a missing file.
/// </summary>
public static class MaterialFileEndpoints
{
    private const string FileField = "file";
    /// <summary>A PDF copy can be larger than the file it was made from.</summary>
    public const long MaxPreviewBytes = 60L * 1024 * 1024;
    /// <summary>The most one text field sent with a file may hold; the description is the longest.</summary>
    private const int MaxFieldBytes = 64 * 1024;
    private const int MaxFields = 20;
    public const string Busy = "The file was changed at the same moment. Reload and try again.";

    public static IEndpointRouteBuilder MapMaterialFileEndpoints(this IEndpointRouteBuilder app)
    {
        var cls = app.MapGroup("/api/classes/{classId}").RequireDemoUser();

        // A new material with its file, as multipart: moduleId, title, kind, description, then file.
        // The material and its file are saved together, or neither is.
        cls.MapPost("/materials/upload", async Task<IResult> (string classId, HttpContext http, ClassAccess access, LmsDbContext db,
            IFileStore store, IFileScanner scanner, IDocumentConverter converter, ILoggerFactory logs, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            AllowFileBody(http);
            var form = await ReadFormAsync(http.Request, ct);
            if (form is null) return FileRefused("Choose a file to add.");

            // The fields arrive before the file, so a missing title is refused before any bytes are kept.
            var errors = new Errors();
            var title = errors.Required("title", form.Field("title"), ContentRules.TitleMax, "a title");
            var kind = ContentEndpoints.KindOf(errors, form.Field("kind"));
            var description = errors.Optional("description", form.Field("description"), ContentRules.DescriptionMax);
            var moduleId = long.TryParse(form.Field("moduleId"), NumberStyles.None, CultureInfo.InvariantCulture, out var id) ? id : 0;
            if (!await db.Modules.AnyAsync(m => m.Id == moduleId && m.ClassId == classId, ct)) errors.Add("moduleId", "Choose a module of this class.");
            if (errors.Any) return errors.Result();
            if (form.File is null) return FileRefused("Choose a file to add.");

            var (received, refused) = await ReceiveAsync(form.File, form.FileName, classId, user, db, store, scanner, converter, logs, ct);
            if (refused is not null) return refused;
            await using (var intake = received!)
            {
                var kept = await intake.KeepAsync(store, ct);
                try
                {
                    await using var transaction = await db.Database.BeginTransactionAsync(ct);
                    var (file, preview) = intake.Rows(db, kept, classId, user);
                    await db.SaveChangesAsync(ct);
                    var row = new Material { ClassId = classId, ModuleId = moduleId, Title = title!, Kind = kind!, Description = description };
                    intake.Attach(row, file, preview);
                    db.Materials.Add(row);
                    await db.SaveChangesAsync(ct);
                    Audit(db, user, "created", row.Id);
                    await db.SaveChangesAsync(ct);
                    await transaction.CommitAsync(ct);
                    return TypedResults.Created($"/api/classes/{classId}/materials/{row.Id}", row.ToDto(file, preview));
                }
                catch
                {
                    kept.Delete(store);
                    throw;
                }
            }
        }).WithName("CreateMaterialWithFile").RequireRateLimiting(FileOptions.UploadPolicy);

        // Adds a file to a material, or replaces the one it has. The old bytes go once the change is saved.
        cls.MapPut("/materials/{id:long}/file", async Task<IResult> (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db,
            IFileStore store, IFileScanner scanner, IDocumentConverter converter, ILoggerFactory logs, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Materials.SingleOrDefaultAsync(m => m.Id == id && m.ClassId == classId, ct);
            if (row is null) return ContentEndpoints.NotFound("Material");
            AllowFileBody(http);
            var form = await ReadFormAsync(http.Request, ct);
            if (form?.File is null) return FileRefused("Choose a file to add.");

            var (received, refused) = await ReceiveAsync(form.File, form.FileName, classId, user, db, store, scanner, converter, logs, ct);
            if (refused is not null) return refused;
            await using (var intake = received!)
            {
                var kept = await intake.KeepAsync(store, ct);
                List<string> unused;
                StoredFile file;
                StoredFile? copy;
                try
                {
                    await using var transaction = await db.Database.BeginTransactionAsync(ct);
                    if (!await LockAsync(db, row, time, ct))
                    {
                        await transaction.RollbackAsync(ct);
                        kept.Delete(store);
                        return Conflict();
                    }
                    var (added, preview) = intake.Rows(db, kept, classId, user);
                    await db.SaveChangesAsync(ct);
                    unused = await ReleaseAsync(db, row, time, ct);
                    intake.Attach(row, added, preview);
                    (file, copy) = (added, preview);
                    await db.SaveChangesAsync(ct);
                    Audit(db, user, "file replaced", row.Id);
                    await db.SaveChangesAsync(ct);
                    await transaction.CommitAsync(ct);
                }
                catch
                {
                    kept.Delete(store);
                    throw;
                }
                foreach (var key in unused) store.Delete(key);
                return TypedResults.Ok(row.ToDto(file, copy));
            }
        }).WithName("ReplaceMaterialFile").RequireRateLimiting(FileOptions.UploadPolicy);

        // Takes the file off a material. The material stays.
        cls.MapDelete("/materials/{id:long}/file", async Task<IResult> (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db,
            IFileStore store, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Materials.SingleOrDefaultAsync(m => m.Id == id && m.ClassId == classId, ct);
            if (row is null) return ContentEndpoints.NotFound("Material");
            if (row.FileId is null) return ContentEndpoints.NotFound("File");
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            if (!await LockAsync(db, row, time, ct)) return Conflict();
            var unused = await ReleaseAsync(db, row, time, ct);
            row.FileName = row.FileType = row.FileSize = null;
            await db.SaveChangesAsync(ct);
            Audit(db, user, "file removed", row.Id);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            foreach (var key in unused) store.Delete(key);
            return TypedResults.Ok(row.ToDto());
        }).WithName("RemoveMaterialFile");

        cls.MapGet("/materials/{id:long}/file", (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db, IFileStore store, ILoggerFactory logs, CancellationToken ct) =>
            ServeAsync(classId, id, preview: false, http, access, db, store, logs, ct)).WithName("DownloadMaterialFile");

        // The PDF copy of an Office file. A PDF, image or text file is its own preview: use …/file.
        cls.MapGet("/materials/{id:long}/preview", (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db, IFileStore store, ILoggerFactory logs, CancellationToken ct) =>
            ServeAsync(classId, id, preview: true, http, access, db, store, logs, ct)).WithName("PreviewMaterialFile");

        return app;
    }

    /// <summary>The stored files of these materials and their PDF copies, by id, for their DTOs.</summary>
    public static async Task<Dictionary<long, StoredFile>> FilesOfAsync(LmsDbContext db, IEnumerable<Material> materials, CancellationToken ct)
    {
        var ids = materials.SelectMany(m => new[] { m.FileId, m.PreviewFileId }).OfType<long>().Distinct().ToList();
        if (ids.Count == 0) return [];
        return await db.StoredFiles.AsNoTracking().Where(f => ids.Contains(f.Id) && f.DeletedAt == null).ToDictionaryAsync(f => f.Id, ct);
    }

    /// <summary>Marks a material's file and preview deleted and returns their storage keys, to delete <b>after the transaction commits</b>.</summary>
    internal static async Task<List<string>> ReleaseAsync(LmsDbContext db, Material row, TimeProvider time, CancellationToken ct)
    {
        var ids = new[] { row.FileId, row.PreviewFileId }.OfType<long>().ToList();
        row.FileId = row.PreviewFileId = null;
        row.PreviewStatus = null;
        if (ids.Count == 0) return [];
        var files = await db.StoredFiles.Where(f => ids.Contains(f.Id) && f.DeletedAt == null).ToListAsync(ct);
        var now = time.GetUtcNow().UtcDateTime;
        foreach (var file in files) file.DeletedAt = now;
        return files.Select(f => f.StorageKey).ToList();
    }

    private static async Task<IResult> ServeAsync(string classId, long id, bool preview, HttpContext http, ClassAccess access, LmsDbContext db, IFileStore store, ILoggerFactory logs, CancellationToken ct)
    {
        var user = http.CurrentUser();
        var (_, denied) = await access.ForReadAsync(classId, user, ct);
        if (denied is not null) return ContentEndpoints.NotFound("File");
        var material = await db.Materials.AsNoTracking().SingleOrDefaultAsync(m => m.Id == id && m.ClassId == classId, ct);
        if (material is null || (!user.IsInstructor && material.Status != ContentStatus.Active)) return ContentEndpoints.NotFound("File");
        var fileId = preview ? material.PreviewFileId : material.FileId;
        var file = fileId is null ? null : await db.StoredFiles.AsNoTracking().SingleOrDefaultAsync(f => f.Id == fileId && f.DeletedAt == null, ct);
        if (file is null) return ContentEndpoints.NotFound("File");

        var content = store.OpenRead(file.StorageKey);
        if (content is null)
        {
            logs.CreateLogger(typeof(MaterialFileEndpoints)).LogError("Stored file {FileId} of material {MaterialId} has no bytes in the file store", file.Id, material.Id);
            return ContentEndpoints.NotFound("File");
        }
        var headers = http.Response.Headers;
        headers.XContentTypeOptions = "nosniff";
        headers.ContentSecurityPolicy = "sandbox";
        // Checked again on every use (no-cache): the ETag lets a file the browser already has come back as 304.
        headers.CacheControl = "private, no-cache";
        // A download name makes this "Content-Disposition: attachment": the page shows the bytes itself.
        return TypedResults.Stream(content, file.ContentType, file.Name, entityTag: new EntityTagHeaderValue($"\"{file.ContentHash}\""));
    }

    /// <summary>
    /// Takes the material's row for this change, and checks its file is still the one this request
    /// read: another replace or remove that got there first makes this one stop. Call inside a transaction.
    /// </summary>
    internal static async Task<bool> LockAsync(LmsDbContext db, Material row, TimeProvider time, CancellationToken ct)
    {
        var fileId = row.FileId;
        var now = time.GetUtcNow().UtcDateTime;
        var locked = await db.Materials.Where(m => m.Id == row.Id && m.FileId == fileId)
            .ExecuteUpdateAsync(m => m.SetProperty(x => x.UpdatedAt, now), ct) == 1;
        if (locked) row.UpdatedAt = now;
        return locked;
    }

    private static async Task<(Intake? Intake, IResult? Refused)> ReceiveAsync(MultipartSection section, string name, string classId, CurrentUser user, LmsDbContext db,
        IFileStore store, IFileScanner scanner, IDocumentConverter converter, ILoggerFactory logs, CancellationToken ct)
    {
        IPendingFile pending;
        try { pending = await store.ReceiveAsync(section.Body, FileLimits.MaxFileBytes, ct); }
        catch (FileTooLargeException) { return (null, FileRefused("This file is larger than 25 MB.")); }
        catch (Exception e) when (e is InvalidDataException or BadHttpRequestException or IOException) { return (null, FileRefused("The upload did not finish. Add the file again.")); }

        var handedOver = false;
        try
        {
            if (pending.Size == 0) return (null, FileRefused("This file is empty."));
            Sniffed sniffed;
            await using (var content = pending.OpenRead()) sniffed = FileSniffer.Detect(content, name, ct);
            if (sniffed.Kind is not { } kind) return (null, FileRefused(sniffed.Refusal!));

            ScanResult scan;
            await using (var content = pending.OpenRead()) scan = await scanner.ScanAsync(content, ct);
            if (scan.Verdict == ScanVerdict.Unavailable)
                return (null, TypedResults.Problem(statusCode: StatusCodes.Status503ServiceUnavailable, title: "The virus scan is not available right now, so the file was not saved. Try again in a few minutes."));
            if (scan.Verdict == ScanVerdict.Infected)
            {
                logs.CreateLogger(typeof(MaterialFileEndpoints)).LogWarning("Material upload refused by the virus scan: {Signature} (instructor {InstructorId}, class {ClassId})", scan.Signature, user.Id, classId);
                // Metadata only: who and where, never the file or its name.
                db.AuditLog.Add(new AuditLogEntry { ActorId = user.Id, ActorRole = user.Role, Category = "files", Action = "refused", Target = "Material file", TargetId = classId, Summary = "Material upload flagged by the virus scan" });
                await db.SaveChangesAsync(ct);
                return (null, FileRefused("The virus scan flagged this file, so it was not saved. Check it on your device, then add a clean copy."));
            }

            var intake = new Intake(pending, kind, name, scanner.PassedStatus);
            handedOver = true;
            try
            {
                if (kind.Type is FileTypes.Word or FileTypes.PowerPoint or FileTypes.Excel)
                    await intake.MakePreviewAsync(store, converter, ct);
            }
            catch
            {
                // Cancelled mid-conversion: nothing is kept, so the received file goes too.
                await intake.DisposeAsync();
                throw;
            }
            return (intake, null);
        }
        finally
        {
            if (!handedOver) await pending.DisposeAsync();
        }
    }

    private static void AllowFileBody(HttpContext http)
    {
        if (http.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } size)
            size.MaxRequestBodySize = FileLimits.MaxFileBytes + MaxFields * MaxFieldBytes + 64 * 1024;
    }

    private sealed record Form(Dictionary<string, string> Fields, MultipartSection? File, string FileName)
    {
        public string? Field(string name) => Fields.GetValueOrDefault(name);
    }

    /// <summary>
    /// Reads the text fields up to the <c>file</c> part and stops there, with the file's bytes still
    /// to come. Null when the body is not multipart. Fields after the file are not read.
    /// </summary>
    private static async Task<Form?> ReadFormAsync(HttpRequest request, CancellationToken ct)
    {
        if (!MediaTypeHeaderValue.TryParse(request.ContentType, out var type)
            || !string.Equals(type.MediaType.Value, "multipart/form-data", StringComparison.OrdinalIgnoreCase)
            || HeaderUtilities.RemoveQuotes(type.Boundary).Value is not { Length: > 0 } boundary)
            return null;
        var fields = new Dictionary<string, string>(StringComparer.Ordinal);
        try
        {
            var reader = new MultipartReader(boundary, request.Body);
            while (await reader.ReadNextSectionAsync(ct) is { } section)
            {
                if (!ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition)) continue;
                var name = HeaderUtilities.RemoveQuotes(disposition.Name).Value ?? "";
                if (disposition.IsFileDisposition())
                {
                    if (name == FileField)
                        return new Form(fields, section, FileNames.Clean(disposition.FileNameStar.HasValue ? disposition.FileNameStar.Value : HeaderUtilities.RemoveQuotes(disposition.FileName).Value));
                    continue;
                }
                if (fields.Count >= MaxFields) return null;
                fields[name] = await ReadTextAsync(section.Body, ct);
            }
        }
        catch (Exception e) when (e is InvalidDataException or BadHttpRequestException or IOException)
        {
            return null;
        }
        return new Form(fields, null, "");
    }

    /// <summary>At most <see cref="MaxFieldBytes"/>: anything longer is cut, which still fails the field's own length check.</summary>
    private static async Task<string> ReadTextAsync(Stream body, CancellationToken ct)
    {
        var buffer = new byte[MaxFieldBytes];
        var total = 0;
        int read;
        while (total < buffer.Length && (read = await body.ReadAsync(buffer.AsMemory(total), ct)) > 0) total += read;
        // The rest of an over-long field is drained, so the next part can be read.
        await body.CopyToAsync(Stream.Null, ct);
        return Encoding.UTF8.GetString(buffer, 0, total);
    }

    internal static void Audit(LmsDbContext db, CurrentUser user, string action, long materialId) =>
        db.AuditLog.Add(new AuditLogEntry { ActorId = user.Id, ActorRole = user.Role, Category = "content", Action = action, Target = "Material", TargetId = materialId.ToString(CultureInfo.InvariantCulture), Summary = $"Material {action}" });

    private static IResult FileRefused(string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [FileField] = [message] }, statusCode: StatusCodes.Status422UnprocessableEntity);

    internal static IResult Conflict() => TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: Busy);

    /// <summary>Storage keys kept for one upload, deleted again if saving the rows fails.</summary>
    private sealed record Kept(string File, string? Preview)
    {
        public void Delete(IFileStore store)
        {
            store.Delete(File);
            if (Preview is not null) store.Delete(Preview);
        }
    }

    /// <summary>A checked, scanned upload and its PDF copy, received but not kept yet.</summary>
    private sealed class Intake(IPendingFile file, FileKind kind, string name, string scanStatus) : IAsyncDisposable
    {
        private IPendingFile? _preview;
        private string? _previewStatus;

        /// <summary>Asks the converter for a PDF copy and checks it is one. Never refuses the upload: without a copy the file is still saved.</summary>
        public async Task MakePreviewAsync(IFileStore store, IDocumentConverter converter, CancellationToken ct)
        {
            if (!converter.Enabled)
            {
                _previewStatus = PreviewStatus.Off;
                return;
            }
            await using (var source = file.OpenRead())
            await using (var converted = await converter.ToPdfAsync(source, Path.GetExtension(name).ToLowerInvariant(), ct))
            {
                if (converted is not null)
                {
                    try
                    {
                        await using var pdf = converted.OpenRead();
                        _preview = await store.ReceiveAsync(pdf, MaxPreviewBytes, ct);
                    }
                    catch (Exception e) when (e is FileTooLargeException or IOException) { }
                }
            }
            if (_preview is not null)
            {
                Sniffed sniffed;
                await using (var content = _preview.OpenRead()) sniffed = FileSniffer.Detect(content, "preview.pdf", ct);
                if (sniffed.Kind != FileKind.Pdf)
                {
                    await _preview.DisposeAsync();
                    _preview = null;
                }
            }
            _previewStatus = _preview is null ? PreviewStatus.Failed : PreviewStatus.Ready;
        }

        public async Task<Kept> KeepAsync(IFileStore store, CancellationToken ct)
        {
            var fileKey = await file.KeepAsync(ct);
            try { return new Kept(fileKey, _preview is null ? null : await _preview.KeepAsync(ct)); }
            catch
            {
                store.Delete(fileKey);
                throw;
            }
        }

        /// <summary>Adds the stored-file rows; their ids are set by the next save.</summary>
        public (StoredFile File, StoredFile? Preview) Rows(LmsDbContext db, Kept kept, string classId, CurrentUser user)
        {
            var added = new StoredFile
            {
                ClassId = classId, OwnerId = user.Id, StorageKey = kept.File, Name = name, ContentType = kind.ContentType,
                Size = file.Size, ContentHash = file.Sha256, ScanStatus = scanStatus,
            };
            // Made by the server from the scanned file, so it carries the same scan result.
            var preview = kept.Preview is null || _preview is null ? null : new StoredFile
            {
                ClassId = classId, OwnerId = user.Id, StorageKey = kept.Preview, Name = Path.ChangeExtension(name, ".pdf"), ContentType = FileKind.Pdf.ContentType,
                Size = _preview.Size, ContentHash = _preview.Sha256, ScanStatus = scanStatus,
            };
            db.StoredFiles.Add(added);
            if (preview is not null) db.StoredFiles.Add(preview);
            return (added, preview);
        }

        /// <summary>Points the material at its saved files, and fills the old text columns too.</summary>
        public void Attach(Material row, StoredFile added, StoredFile? preview)
        {
            row.FileId = added.Id;
            row.PreviewFileId = preview?.Id;
            row.PreviewStatus = _previewStatus;
            row.FileName = added.Name;
            row.FileType = Path.GetExtension(added.Name).TrimStart('.').ToLowerInvariant();
            row.FileSize = SizeText(added.Size);
        }

        public async ValueTask DisposeAsync()
        {
            await file.DisposeAsync();
            if (_preview is not null) await _preview.DisposeAsync();
        }
    }

    /// <summary>The size as the old text column holds it, e.g. "2.4 MB" or "340 KB".</summary>
    internal static string SizeText(long bytes) => bytes >= 1024 * 1024
        ? $"{(bytes / (1024d * 1024)).ToString("0.0", CultureInfo.InvariantCulture)} MB"
        : $"{Math.Max(1, (long)Math.Round(bytes / 1024d)).ToString(CultureInfo.InvariantCulture)} KB";
}
