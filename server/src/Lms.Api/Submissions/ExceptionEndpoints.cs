using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Submissions;

/// <summary>
/// One student's own terms for one assignment (D-062, contract §11): a later due date and last
/// day, or being excused. Set by the class's instructor. The row is read by
/// <see cref="AssignmentRules"/>, so every rule that depends on a date uses the student's own.
/// </summary>
public static class ExceptionEndpoints
{
    public static IEndpointRouteBuilder MapExceptionEndpoints(this IEndpointRouteBuilder app)
    {
        var student = app.MapGroup("/api/classes/{classId}/coursework/{courseworkId:long}/students/{studentId}").RequireDemoUser();

        student.MapPut("/extension", async Task<IResult> (string classId, long courseworkId, string studentId, ExtensionInput input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (scope, refused) = await OpenAsync(classId, courseworkId, studentId, http, access, db, ct);
            if (refused is not null) return refused;
            var cw = scope!.Cw;
            if (cw.DueAt is not { } classDue) return Conflict("This assignment has no due date to extend.");
            var errors = new Errors();
            var due = input.DueAt?.UtcDateTime;
            if (due is null) errors.Add("dueAt", "Choose this student's due date.");
            else if (due <= classDue) errors.Add("dueAt", "A student's own due date must be after the assignment's due date.");
            var close = input.CloseAt?.UtcDateTime;
            if (close is not null)
            {
                if (!cw.AllowLate) errors.Add("closeAt", "This assignment doesn't accept late work, so there is no last day to set.");
                else if (due is not null && close <= due) errors.Add("closeAt", "The last day for late work must be after this student's due date.");
            }
            if (errors.Any) return errors.Result();

            var row = scope.Row ?? Add(db, courseworkId, studentId);
            row.DueAt = due;
            row.CloseAt = close;
            SubmissionEndpoints.Audit(db, scope.User, "coursework", "extended", "Assignment for one student", courseworkId);
            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(ToDto(row));
        }).WithName("SetExtension");

        student.MapDelete("/extension", async Task<IResult> (string classId, long courseworkId, string studentId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (scope, refused) = await OpenAsync(classId, courseworkId, studentId, http, access, db, ct);
            if (refused is not null) return refused;
            if (scope!.Row is { DueAt: not null } row)
            {
                row.DueAt = null;
                row.CloseAt = null;
                if (!row.Excused) db.CourseworkExceptions.Remove(row);
                SubmissionEndpoints.Audit(db, scope.User, "coursework", "extension removed", "Assignment for one student", courseworkId);
                await db.SaveChangesAsync(ct);
            }
            return TypedResults.NoContent();
        }).WithName("RemoveExtension");

        student.MapPut("/excuse", async Task<IResult> (string classId, long courseworkId, string studentId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (scope, refused) = await OpenAsync(classId, courseworkId, studentId, http, access, db, ct);
            if (refused is not null) return refused;
            var row = scope!.Row ?? Add(db, courseworkId, studentId);
            if (!row.Excused)
            {
                row.Excused = true;
                SubmissionEndpoints.Audit(db, scope.User, "coursework", "excused", "Assignment for one student", courseworkId);
                await db.SaveChangesAsync(ct);
            }
            return TypedResults.Ok(ToDto(row));
        }).WithName("ExcuseStudent");

        student.MapDelete("/excuse", async Task<IResult> (string classId, long courseworkId, string studentId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (scope, refused) = await OpenAsync(classId, courseworkId, studentId, http, access, db, ct);
            if (refused is not null) return refused;
            if (scope!.Row is { Excused: true } row)
            {
                row.Excused = false;
                if (row.DueAt is null) db.CourseworkExceptions.Remove(row);
                SubmissionEndpoints.Audit(db, scope.User, "coursework", "excuse removed", "Assignment for one student", courseworkId);
                await db.SaveChangesAsync(ct);
            }
            return TypedResults.NoContent();
        }).WithName("RemoveExcuse");

        return app;
    }

    private sealed record Scope(CurrentUser User, CourseworkRow Cw, CourseworkException? Row);

    /// <summary>The class's instructor, an assignment of the class, and a student active on its class list.</summary>
    private static async Task<(Scope? Scope, IResult? Refused)> OpenAsync(string classId, long courseworkId, string studentId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct)
    {
        var user = http.CurrentUser();
        var (_, denied) = await access.ForWriteAsync(classId, user, ct);
        if (denied is not null) return (null, denied);
        var cw = await db.Coursework.AsNoTracking().SingleOrDefaultAsync(c => c.Id == courseworkId && c.ClassId == classId, ct);
        if (cw is null) return (null, ContentEndpoints.NotFound("Coursework"));
        if (cw.Type != CourseworkType.Assignment) return (null, Conflict("Only assignments have a student's own dates or an excuse."));
        if (!await db.IsmsClassStudents.AnyAsync(s => s.ClassId == classId && s.StudentId == studentId && s.IsActive, ct)) return (null, ContentEndpoints.NotFound("Student"));
        var row = await db.CourseworkExceptions.SingleOrDefaultAsync(e => e.CourseworkId == courseworkId && e.StudentId == studentId, ct);
        return (new Scope(user, cw, row), null);
    }

    private static CourseworkException Add(LmsDbContext db, long courseworkId, string studentId)
    {
        var row = new CourseworkException { CourseworkId = courseworkId, StudentId = studentId };
        db.CourseworkExceptions.Add(row);
        return row;
    }

    private static ExceptionDto ToDto(CourseworkException row) => new(row.StudentId, row.DueAt, row.CloseAt, row.Excused);

    private static IResult Conflict(string title) => TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: title);
}
