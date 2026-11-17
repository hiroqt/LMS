using System.Text.Json;
using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Net.Http.Headers;

namespace Lms.Api.Import;

/// <summary>
/// Exam import (D-041): an instructor uploads a .docx, .xlsx, .csv, or .txt file, or pastes text,
/// and gets back draft questions with warnings to review in the builder. <b>Nothing is saved</b>:
/// the file is read in memory and dropped, and the audit row holds only its name, format, and
/// question count.
/// </summary>
public static class ImportEndpoints
{
    private const string FileField = "file";
    private const string TextField = "text";
    /// <summary>The whole request: the file plus room for the multipart headers.</summary>
    private const long MaxRequestBytes = ImportLimits.MaxFileBytes + 64 * 1024;

    private sealed record Upload(string Field, string Format, string Name, byte[]? Bytes, string? Text);

    public static IEndpointRouteBuilder MapImportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/questionnaires/import").RequireDemoUser();

        group.MapPost("", async Task<IResult> (HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            if (!user.IsInstructor) return InstructorsOnly();
            if (http.Features.Get<IHttpMaxRequestBodySizeFeature>() is { IsReadOnly: false } size) size.MaxRequestBodySize = MaxRequestBytes;

            var (upload, refused) = await ReadUploadAsync(http.Request, ct);
            if (refused is not null) return refused;

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(ImportLimits.ParseTime);
            ImportResult result;
            try
            {
                result = Read(upload!, timeout.Token);
            }
            catch (ImportRefusedException e)
            {
                return Refused(upload!.Field, e.Message);
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                return Refused(upload!.Field, ImportRefusedException.Unreadable);
            }

            var summary = $"Questions imported from {upload!.Name} ({result.Format}, {result.Questions.Count} questions)";
            db.AuditLog.Add(new AuditLogEntry
            {
                ActorId = user.Id, ActorRole = user.Role, Category = "coursework", Action = "imported", Target = "QuestionImport",
                Summary = summary.Length > 300 ? summary[..300] : summary,
            });
            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(result);
        }).WithName("ImportQuestions");

        group.MapGet("/template", IResult (string? format, HttpContext http) =>
        {
            if (!http.CurrentUser().IsInstructor) return InstructorsOnly();
            return format?.Trim().ToLowerInvariant() switch
            {
                "docx" => TypedResults.File(ImportTemplates.Docx(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "exam-import-template.docx"),
                "xlsx" => TypedResults.File(ImportTemplates.Xlsx(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "exam-import-template.xlsx"),
                "csv" => TypedResults.File(ImportTemplates.Csv(), "text/csv; charset=utf-8", "exam-import-template.csv"),
                _ => FormatError(),
            };
        }).WithName("GetImportTemplate");

        return app;
    }

    /// <summary>Reads the file into memory (never to disk), or the pasted text.</summary>
    private static async Task<(Upload? Upload, IResult? Refused)> ReadUploadAsync(HttpRequest request, CancellationToken ct)
    {
        if (request.HasJsonContentType())
        {
            ImportTextInput? input;
            try { input = await request.ReadFromJsonAsync<ImportTextInput>(ct); }
            catch (JsonException) { input = null; }
            if (string.IsNullOrWhiteSpace(input?.Text)) return (null, Refused(TextField, "Paste the exam's text."));
            if (input.Text.Length > ImportLimits.MaxTextChars) return (null, Refused(TextField, "Paste at most 200,000 characters."));
            return (new Upload(TextField, "text", "pasted text", null, input.Text), null);
        }

        if (!MediaTypeHeaderValue.TryParse(request.ContentType, out var type)
            || !string.Equals(type.MediaType.Value, "multipart/form-data", StringComparison.OrdinalIgnoreCase)
            || HeaderUtilities.RemoveQuotes(type.Boundary).Value is not { Length: > 0 } boundary)
            return (null, Refused(FileField, ImportRefusedException.WrongFile));

        try
        {
            var reader = new MultipartReader(boundary, request.Body) { BodyLengthLimit = ImportLimits.MaxFileBytes };
            while (await reader.ReadNextSectionAsync(ct) is { } section)
            {
                if (!ContentDispositionHeaderValue.TryParse(section.ContentDisposition, out var disposition)
                    || !string.Equals(HeaderUtilities.RemoveQuotes(disposition.Name).Value, FileField, StringComparison.Ordinal))
                    continue;

                var name = SafeName(disposition.FileNameStar.HasValue ? disposition.FileNameStar.Value : HeaderUtilities.RemoveQuotes(disposition.FileName).Value);
                var format = Path.GetExtension(name).ToLowerInvariant() switch
                {
                    ".docx" => "docx",
                    ".xlsx" => "xlsx",
                    ".csv" => "csv",
                    ".txt" => "text",
                    // Macro-enabled Office files are never opened.
                    ".docm" or ".dotm" or ".xlsm" or ".xltm" or ".xlam" => null,
                    _ => "",
                };
                if (format is null) return (null, Refused(FileField, ImportRefusedException.Unreadable));
                if (format.Length == 0) return (null, Refused(FileField, ImportRefusedException.WrongFile));

                using var buffer = new MemoryStream();
                await section.Body.CopyToAsync(buffer, ct);
                return (new Upload(FileField, format, name, buffer.ToArray(), null), null);
            }
        }
        catch (Exception e) when (e is InvalidDataException or BadHttpRequestException)
        {
            // Over the size limit, or not valid multipart.
        }
        return (null, Refused(FileField, ImportRefusedException.WrongFile));
    }

    private static ImportResult Read(Upload upload, CancellationToken ct)
    {
        var fileTitle = upload.Field == FileField ? Path.GetFileNameWithoutExtension(upload.Name) : null;
        var notUtf8 = false;
        var bytes = upload.Bytes ?? [];
        var exam = upload.Format switch
        {
            "docx" => ExamTextParser.Parse(FromPackage(bytes, () => DocxReader.ReadLines(bytes, ct), ct), ct),
            "xlsx" => ExamRowParser.Parse(FromPackage(bytes, () => XlsxReader.ReadRows(bytes, ct), ct), ct),
            "csv" => ExamRowParser.Parse(CsvReader.Read(PlainText.Decode(bytes, out notUtf8), ct), ct),
            _ => ExamTextParser.Parse(ExamText.Lines(upload.Text ?? PlainText.Decode(bytes, out notUtf8)), ct),
        };
        if (notUtf8) exam.Warnings.Insert(0, PlainText.NotUtf8Warning);
        return ExamBuilder.Build(exam, upload.Format, fileTitle, ct);
    }

    /// <summary>Checks the zip first; any error from the Office reader means the file could not be read.</summary>
    private static T FromPackage<T>(byte[] bytes, Func<T> read, CancellationToken ct)
    {
        ZipGuard.Check(bytes, ct);
        try { return read(); }
        catch (Exception e) when (e is not (ImportRefusedException or OperationCanceledException))
        {
            throw new ImportRefusedException(ImportRefusedException.Unreadable);
        }
    }

    /// <summary>The name only (no folders, no control characters), at most 120 characters, for the audit row.</summary>
    private static string SafeName(string? name)
    {
        var clean = ExamText.Clean(name).Replace('\t', ' ');
        clean = clean[(clean.LastIndexOfAny(['/', '\\']) + 1)..];
        return clean.Length > 120 ? clean[..120] : clean;
    }

    private static IResult Refused(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] }, statusCode: StatusCodes.Status422UnprocessableEntity);

    private static IResult FormatError()
    {
        var errors = new Errors();
        errors.Add("format", "Choose docx, xlsx, or csv.");
        return errors.Result();
    }

    private static IResult InstructorsOnly() =>
        TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Only instructors can import questions.");
}
