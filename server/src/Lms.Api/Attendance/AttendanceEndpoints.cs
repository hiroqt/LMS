using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Attendance;

public sealed record AttendanceEntryDto(string StudentId, int DaysPresent);
public sealed record AttendanceMonthDto(int Year, int Month, int SchoolDays, IReadOnlyList<AttendanceEntryDto> Entries);
public sealed record AttendanceEntryInput(string? StudentId, int? DaysPresent);
public sealed record AttendanceMonthInput(int? SchoolDays, IReadOnlyList<AttendanceEntryInput>? Entries);

/// <summary>
/// Monthly attendance totals of a class: the school days in a month and each student's days
/// present. Recorded only: attendance is not part of the gradebook yet. The class's instructor
/// sets a whole month in one call; students read only their own days.
/// </summary>
public static class AttendanceEndpoints
{
    public const int MinYear = 2000;
    public const int MaxYear = 2100;

    public static IEndpointRouteBuilder MapAttendanceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/classes/{classId}/attendance").RequireDemoUser();

        group.MapGet("", async Task<IResult> (string classId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            var months = await LoadAsync(db, [classId], ct);
            return TypedResults.Ok(months.Select(m => ToDto(m, user)).ToList());
        }).WithName("ListAttendance");

        group.MapPut("/{year:int}/{month:int}", async Task<IResult> (string classId, int year, int month, AttendanceMonthInput input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;

            var errors = new Errors();
            if (year is < MinYear or > MaxYear) errors.Add("year", $"Use a year from {MinYear} to {MaxYear}.");
            if (month is < 1 or > 12) errors.Add("month", "Use a month from 1 to 12.");
            if (errors.Any) return errors.Result();
            var daysInMonth = DateTime.DaysInMonth(year, month);
            if (input.SchoolDays is not { } schoolDays || schoolDays < 1 || schoolDays > daysInMonth)
            {
                errors.Add("schoolDays", $"Enter school days from 1 to {daysInMonth}.");
                return errors.Result();
            }

            var roster = await db.IsmsClassStudents.AsNoTracking().Where(s => s.ClassId == classId).ToListAsync(ct);
            var entries = input.Entries ?? [];
            var seen = new HashSet<string>(StringComparer.Ordinal);
            for (var i = 0; i < entries.Count; i++)
            {
                var entry = entries[i];
                var id = entry.StudentId?.Trim();
                if (string.IsNullOrEmpty(id) || !roster.Any(s => s.StudentId == id && s.IsActive))
                    errors.Add($"entries[{i}].studentId", "Choose a student on this class list.");
                else if (!seen.Add(id))
                    errors.Add($"entries[{i}].studentId", "This student is listed twice.");
                if (entry.DaysPresent is not { } days || days < 0 || days > schoolDays)
                    errors.Add($"entries[{i}].daysPresent", $"Enter days present from 0 to {schoolDays}.");
            }

            var row = await db.AttendanceMonths.Include(m => m.Entries)
                .SingleOrDefaultAsync(m => m.ClassId == classId && m.Year == year && m.Month == month, ct);
            // Lowering the school days must not leave a saved entry above them.
            if (row is not null)
            {
                var over = row.Entries.Where(e => !seen.Contains(e.StudentId) && e.DaysPresent > schoolDays)
                    .Select(e => roster.FirstOrDefault(s => s.StudentId == e.StudentId) is { } s ? $"{s.FirstName} {s.LastName}".Trim() : e.StudentId)
                    .OrderBy(n => n, StringComparer.Ordinal).ToList();
                if (over.Count > 0)
                    errors.Add("schoolDays", $"Already saved with more days present than {schoolDays}: {string.Join(", ", over)}. Lower their days first.");
            }
            if (errors.Any) return errors.Result();

            var action = row is null ? "recorded" : "updated";
            if (row is null)
            {
                row = new AttendanceMonth { ClassId = classId, Year = year, Month = month };
                db.AttendanceMonths.Add(row);
            }
            row.SchoolDays = schoolDays;
            foreach (var entry in entries)
            {
                var id = entry.StudentId!.Trim();
                var existing = row.Entries.FirstOrDefault(e => e.StudentId == id);
                if (existing is null) row.Entries.Add(new AttendanceEntry { StudentId = id, DaysPresent = entry.DaysPresent!.Value });
                else existing.DaysPresent = entry.DaysPresent!.Value;
            }
            // When the month is new, its id is known only after the first save inside the transaction.
            try { await ContentEndpoints.SaveWithAuditAsync(db, user, null, action, "Attendance", () => row.Id, ct, "attendance"); }
            // Two first saves of the same month at once: the unique index refuses the second.
            catch (DbUpdateException)
            {
                return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "This month was saved by someone else at the same moment. Reload and try again.");
            }
            return TypedResults.Ok(ToDto(row, user));
        }).WithName("SetAttendanceMonth");

        return app;
    }

    /// <summary>Months of the given classes, newest first, with their entries.</summary>
    internal static async Task<List<AttendanceMonth>> LoadAsync(LmsDbContext db, IReadOnlyCollection<string> classIds, CancellationToken ct) =>
        await db.AttendanceMonths.AsNoTracking().Include(m => m.Entries)
            .Where(m => classIds.Contains(m.ClassId))
            .OrderByDescending(m => m.Year).ThenByDescending(m => m.Month).ToListAsync(ct);

    /// <summary>Instructors get every entry; a student gets only their own.</summary>
    internal static AttendanceMonthDto ToDto(AttendanceMonth m, CurrentUser user) =>
        new(m.Year, m.Month, m.SchoolDays, m.Entries
            .Where(e => user.IsInstructor || e.StudentId == user.Id)
            .OrderBy(e => e.StudentId, StringComparer.Ordinal)
            .Select(e => new AttendanceEntryDto(e.StudentId, e.DaysPresent)).ToList());
}
