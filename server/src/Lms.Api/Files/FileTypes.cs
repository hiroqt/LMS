using Lms.Api.Import;

namespace Lms.Api.Files;

/// <summary>The fixed limits on student uploads (contract §5, §7).</summary>
public static class FileLimits
{
    public const long MaxFileBytes = 25 * 1024 * 1024;
    public const int MaxFilesPerTurnIn = 5;
    public const int MaxNameLength = 120;
    /// <summary>The most an Office file may hold once unpacked (zip bomb guard).</summary>
    public const long MaxUnpackedBytes = 250L * 1024 * 1024;
    public const int MaxZipEntries = 5_000;
}

/// <summary>The file types an instructor can allow for an assignment (contract §5). Stored comma-separated; null means all (L-074).</summary>
public static class FileTypes
{
    public const string Pdf = "pdf";
    public const string Word = "word";
    public const string PowerPoint = "powerpoint";
    public const string Excel = "excel";
    public const string Image = "image";
    public const string Text = "text";
    public static readonly IReadOnlyList<string> All = [Pdf, Word, PowerPoint, Excel, Image, Text];

    public static IReadOnlyList<string> Parse(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored)) return All;
        var chosen = stored.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return All.Where(chosen.Contains).ToList() is { Count: > 0 } types ? types : All;
    }

    /// <summary>Null when every type is chosen, so a type added later is accepted too.</summary>
    public static string? Store(IEnumerable<string> types)
    {
        var chosen = All.Where(types.Contains).ToList();
        return chosen.Count == All.Count ? null : string.Join(',', chosen);
    }
}

/// <summary>One concrete format: what it is called, what it is stored as, and the names it may have.</summary>
public sealed record FileKind(string Type, string Label, string ContentType, params string[] Extensions)
{
    public static readonly FileKind Pdf = new(FileTypes.Pdf, "a PDF", "application/pdf", ".pdf");
    public static readonly FileKind Docx = new(FileTypes.Word, "a Word document", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".docx");
    public static readonly FileKind Pptx = new(FileTypes.PowerPoint, "a PowerPoint presentation", "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pptx");
    public static readonly FileKind Xlsx = new(FileTypes.Excel, "an Excel workbook", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".xlsx");
    public static readonly FileKind Jpeg = new(FileTypes.Image, "a JPEG image", "image/jpeg", ".jpg", ".jpeg");
    public static readonly FileKind Png = new(FileTypes.Image, "a PNG image", "image/png", ".png");
    public static readonly FileKind PlainText = new(FileTypes.Text, "a text file", "text/plain; charset=utf-8", ".txt");
    public static readonly IReadOnlyList<FileKind> All = [Pdf, Docx, Pptx, Xlsx, Jpeg, Png, PlainText];

    /// <summary>The type (<see cref="FileTypes"/>) of a stored file, from the content type the server gave it.</summary>
    public static string? TypeOf(string contentType) => All.FirstOrDefault(k => k.ContentType == contentType)?.Type;
}

/// <param name="Kind">What the file is, when it is accepted.</param>
/// <param name="Refusal">Why it is refused, in words for the student.</param>
public readonly record struct Sniffed(FileKind? Kind, string? Refusal);

/// <summary>
/// Decides what an uploaded file is <b>from its bytes</b> (D-055): the name and the browser's
/// content type are never trusted. The name only has to agree with what was found.
/// </summary>
public static class FileSniffer
{
    public const string NotAccepted = "This file type is not accepted. Use PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx), JPEG, PNG, or TXT.";
    public const string OldOffice = "Old Office files (.doc, .xls, .ppt) are not accepted. Save it as .docx, .xlsx, or .pptx and add it again.";
    public const string Macros = "This file contains macros, so it is not accepted. Save it without macros and add it again.";
    public const string Damaged = "This file could not be read. Export it again and add the new copy.";

    /// <param name="content">Seekable; read from the start and left open.</param>
    public static Sniffed Detect(Stream content, string name, CancellationToken ct)
    {
        var extension = Path.GetExtension(name).ToLowerInvariant();
        Span<byte> head = stackalloc byte[8];
        content.Position = 0;
        var read = content.ReadAtLeast(head, head.Length, throwOnEndOfStream: false);
        head = head[..read];

        FileKind? kind;
        if (head.StartsWith("%PDF-"u8)) kind = FileKind.Pdf;
        else if (head.StartsWith<byte>([0xFF, 0xD8, 0xFF])) kind = FileKind.Jpeg;
        else if (head.StartsWith<byte>([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) kind = FileKind.Png;
        else if (head.StartsWith<byte>([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])) return new(null, OldOffice);
        else if (head.StartsWith<byte>([(byte)'P', (byte)'K', 3, 4]))
        {
            var (problem, types) = ZipGuard.Inspect(content, FileLimits.MaxZipEntries, FileLimits.MaxUnpackedBytes, ct);
            if (problem == ZipProblem.Macro) return new(null, Macros);
            if (problem != ZipProblem.None) return new(null, Damaged);
            // The main part's content type says which Office format this is; templates and other zips have none of these.
            kind = types.Contains("wordprocessingml.document.main+xml", StringComparison.Ordinal) ? FileKind.Docx
                : types.Contains("presentationml.presentation.main+xml", StringComparison.Ordinal) ? FileKind.Pptx
                : types.Contains("spreadsheetml.sheet.main+xml", StringComparison.Ordinal) ? FileKind.Xlsx
                : null;
            if (kind is null) return new(null, NotAccepted);
        }
        else if (extension == ".txt" && IsPlainText(content, ct)) kind = FileKind.PlainText;
        else return new(null, NotAccepted);

        if (!kind.Extensions.Contains(extension))
            return new(null, $"This file is {kind.Label}, but its name ends in \"{(extension.Length == 0 ? "nothing" : extension)}\". Rename it to end in {kind.Extensions[0]} and add it again.");
        return new(kind, null);
    }

    /// <summary>Text has no signature, so it is text when it holds no control bytes other than tabs and line breaks.</summary>
    private static bool IsPlainText(Stream content, CancellationToken ct)
    {
        content.Position = 0;
        var buffer = new byte[81920];
        int read;
        while ((read = content.Read(buffer, 0, buffer.Length)) > 0)
        {
            ct.ThrowIfCancellationRequested();
            foreach (var b in buffer.AsSpan(0, read))
                if (b == 0x7F || (b < 0x20 && b is not (0x09 or 0x0A or 0x0C or 0x0D))) return false;
        }
        return true;
    }
}

public static class FileNames
{
    /// <summary>
    /// The name to keep and show: no folders, no control characters, nothing a file system or a
    /// header treats specially, at most <see cref="FileLimits.MaxNameLength"/> characters with the
    /// extension kept. The name is data only; it never decides where the bytes are stored.
    /// </summary>
    public static string Clean(string? raw)
    {
        var name = ExamText.Clean(raw).Replace('\t', ' ').Replace('\n', ' ');
        name = name[(name.LastIndexOfAny(['/', '\\']) + 1)..];
        name = string.Concat(name.Select(c => c is '"' or '<' or '>' or ':' or '|' or '?' or '*' ? '_' : c)).Trim().TrimStart('.').Trim();
        var extension = Path.GetExtension(name);
        if (extension.Length > 10) extension = "";
        var stem = name[..(name.Length - extension.Length)].TrimEnd();
        if (stem.Length == 0) stem = "file";
        var room = FileLimits.MaxNameLength - extension.Length;
        if (stem.Length > room) stem = stem[..room].TrimEnd();
        return stem + extension;
    }
}
