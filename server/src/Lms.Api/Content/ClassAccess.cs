using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Content;

/// <summary>
/// Who may see and change a class. Read: the class's instructor, or a student on its active
/// ISMS class list. Write: the class's instructor only, and only while ISMS still offers the
/// class. A class the caller cannot see is reported as not found, so ids cannot be probed.
/// </summary>
public sealed class ClassAccess(LmsDbContext db)
{
    public async Task<(IsmsClass? Class, IResult? Denied)> ForReadAsync(string classId, CurrentUser user, CancellationToken ct)
    {
        var room = await db.IsmsClasses.AsNoTracking().SingleOrDefaultAsync(c => c.Id == classId, ct);
        if (room is null) return (null, NotFound());
        var allowed = user.IsInstructor
            ? room.InstructorId == user.Id
            : await db.IsmsClassStudents.AnyAsync(s => s.ClassId == classId && s.StudentId == user.Id && s.IsActive, ct);
        return allowed ? (room, null) : (null, NotFound());
    }

    public async Task<(IsmsClass? Class, IResult? Denied)> ForWriteAsync(string classId, CurrentUser user, CancellationToken ct)
    {
        var (room, denied) = await ForReadAsync(classId, user, ct);
        if (denied is not null) return (null, denied);
        if (!user.IsInstructor)
            return (null, TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Only the class's instructor can change its content."));
        if (!room!.IsActive)
            return (null, TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "This class is no longer offered in ISMS, so its content is read-only."));
        db.Actor = user.Id;
        return (room, null);
    }

    private static IResult NotFound() =>
        TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: "Class not found", detail: "No class with this id exists for you.");
}
