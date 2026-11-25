using Lms.Api.Data;

namespace Lms.Api.Content;

// What the content endpoints send and accept. Database rows are never returned directly.

public sealed record ModuleDto(long Id, long? ParentModuleId, string Title, int SortOrder);

/// <summary>
/// A material's uploaded file (D-067). <c>Type</c> is pdf, word, powerpoint, excel, image or text.
/// <c>Preview</c> is null when the file is shown as it is (PDF, image, text); for an Office file it is
/// ready (a PDF copy is at <c>…/preview</c>), failed, or off (the server had no converter).
/// </summary>
public sealed record MaterialFileDto(long Id, string Name, string ContentType, string? Type, long Size, string? Preview);

/// <summary><c>FileName</c>, <c>FileType</c> and <c>FileSize</c> are text kept for materials made before uploads; <c>File</c> is the real file.</summary>
public sealed record MaterialDto(long Id, long ModuleId, string Title, string Kind, string? Description,
    string? FileName, string? FileType, string? FileSize, string Status, DateTime CreatedAt, MaterialFileDto? File = null);

public sealed record AnnouncementDto(long Id, string Title, string Message, string Status, DateTime PublishedAt, string? PostedBy);

public sealed record MyClass(string Id, string ScheduleId, int SubjectId, string? SubjectCode, string SubjectName,
    int SectionId, string? SectionName, string InstructorId, string InstructorName, int SchoolYearId, int SemesterId,
    string? TermName, IReadOnlyList<Lms.Api.Classes.ClassMeeting> Meetings);

public sealed record MyClasses(string Role, IReadOnlyList<MyClass> Items);

public sealed record PagedList<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);

public sealed record ModuleCreate(string? Title, long? ParentModuleId, int? SortOrder);
public sealed record ModuleUpdate(string? Title, int? SortOrder);
public sealed record MaterialCreate(long ModuleId, string? Title, string? Kind, string? Description, string? FileName, string? FileType, string? FileSize);
/// <summary>Only the sent fields change. <c>ModuleId</c> moves the material to another module or submodule of the same class.</summary>
public sealed record MaterialUpdate(string? Title, string? Kind, string? Description, string? Status, long? ModuleId = null);
public sealed record AnnouncementCreate(string? Title, string? Message);
public sealed record AnnouncementUpdate(string? Status);

public static class ContentRules
{
    /// <summary>The resource types the Instructor form offers (client classUtils RESOURCE_TYPES).</summary>
    public static readonly IReadOnlyList<string> MaterialKinds = ["Study guide", "Lecture Slides", "Lab Manual", "Reading", "Practice set", "Reference sheet"];

    public const int TitleMax = 250;
    public const int DescriptionMax = 10_000;
    public const int AnnouncementTitleMax = 120;
    public const int AnnouncementMessageMax = 1_200;
    public const int DefaultPageSize = 50;
    public const int MaxPageSize = 200;

    public static ModuleDto ToDto(this Module m) => new(m.Id, m.ParentModuleId, m.Title, m.SortOrder);
    public static MaterialDto ToDto(this Material m, StoredFile? file = null) => new(m.Id, m.ModuleId, m.Title, m.Kind, m.Description, m.FileName, m.FileType, m.FileSize, m.Status, m.CreatedAt, m.FileDto(file));

    /// <summary>Null unless <paramref name="file"/> is the material's own, still-stored file.</summary>
    public static MaterialFileDto? FileDto(this Material m, StoredFile? file) =>
        file is not null && file.Id == m.FileId && file.DeletedAt is null
            ? new(file.Id, file.Name, file.ContentType, Files.FileKind.TypeOf(file.ContentType), file.Size, m.PreviewStatus)
            : null;

    public static AnnouncementDto ToDto(this Announcement a) => new(a.Id, a.Title, a.Message, a.Status, a.PublishedAt, a.CreatedBy);
}

/// <summary>Collects field errors and turns them into one 400 validation problem.</summary>
public sealed class Errors
{
    private readonly Dictionary<string, string[]> _errors = [];
    public bool Any => _errors.Count > 0;
    public void Add(string field, string message) => _errors[field] = [message];
    public IResult Result() => TypedResults.ValidationProblem(_errors);

    /// <summary>Required text, trimmed, at most <paramref name="max"/> characters.</summary>
    public string? Required(string field, string? value, int max, string label)
    {
        var text = value?.Trim();
        if (string.IsNullOrEmpty(text)) Add(field, $"Enter {label}.");
        else if (text.Length > max) Add(field, $"Use at most {max} characters.");
        return text;
    }

    public string? Optional(string field, string? value, int max)
    {
        var text = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        if (text is not null && text.Length > max) Add(field, $"Use at most {max} characters.");
        return text;
    }
}
