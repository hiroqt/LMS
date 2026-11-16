namespace Isms.Api.Access;

/// <summary>
/// The single registry of permissions this API knows about. Granting a permission to a
/// client is a data change (api_client_permissions); adding a new kind of permission is
/// the only thing that needs a code change, here.
/// </summary>
public static class Permissions
{
    public const string SubjectView = "subject.view";
    public const string InstructorView = "instructor.view";
    public const string ScheduleView = "schedule.view";
    public const string StudentView = "student.view";

    public static readonly IReadOnlyList<string> All =
        [SubjectView, InstructorView, ScheduleView, StudentView];

    public static bool IsKnown(string permission) => All.Contains(permission, StringComparer.Ordinal);

    public static string PolicyName(string permission) => "permission:" + permission;
}
