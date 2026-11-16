using Lms.Api.Data;

namespace Lms.Api.Content;

// What the content endpoints send and accept. Database rows are never returned directly.

public sealed record ModuleDto(long Id, long? ParentModuleId, string Title, int SortOrder);

public sealed record MaterialDto(long Id, long ModuleId, string Title, string Kind, string? Description,
    string? FileName, string? FileType, string? FileSize, string Status, DateTime CreatedAt);

public sealed record AnnouncementDto(long Id, string Title, string Message, string Status, DateTime PublishedAt, string? PostedBy);

public sealed record MyClass(string Id, string ScheduleId, int SubjectId, string? SubjectCode, string SubjectName,
    int SectionId, string? SectionName, string InstructorId, string InstructorName, int SchoolYearId, int SemesterId,
    string? TermName, IReadOnlyList<Lms.Api.Classes.ClassMeeting> Meetings);

public sealed record MyClasses(string Role, IReadOnlyList<MyClass> Items);

public sealed record PagedList<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);

public sealed record ModuleCreate(string? Title, long? ParentModuleId, int? SortOrder);
public sealed record ModuleUpdate(string? Title, int? SortOrder);
public sealed record MaterialCreate(long ModuleId, string? Title, string? Kind, string? Description, string? FileName, string? FileType, string? FileSize);
public sealed record MaterialUpdate(string? Title, string? Kind, string? Description, string? Status);
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
    public static MaterialDto ToDto(this Material m) => new(m.Id, m.ModuleId, m.Title, m.Kind, m.Description, m.FileName, m.FileType, m.FileSize, m.Status, m.CreatedAt);
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
