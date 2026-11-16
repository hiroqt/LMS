using Isms.Api.Access;
using Isms.Api.Isms;
using Microsoft.EntityFrameworkCore;

namespace Isms.Api.Features.Schedules;

/// <param name="Day">Raw ISMS DayID value.</param>
/// <param name="TimeFrom">"HH:mm".</param>
public sealed record MeetingDto(string Day, string TimeFrom, string TimeTo, int RoomId, int Modality);

/// <summary>One class offering: a (schedule RefID, subject, instructor) combination with its meetings.</summary>
public sealed record ScheduleDto(
    string ScheduleId, int SchoolYearId, int SemesterId, int SectionId, string? SectionName,
    int SubjectId, string? SubjectCode, string SubjectName,
    string InstructorId, string InstructorName, IReadOnlyList<MeetingDto> Meetings);

/// <param name="StudentId">The student RefID (enrollments_tbl.StudentID).</param>
/// <param name="EnrollmentId">The enrollment RefID.</param>
public sealed record ScheduleStudentDto(string StudentId, string EnrollmentId, string? FirstName, string? MiddleName, string? LastName);

public sealed record ScheduleFilter(int? SchoolYearId, int? SemesterId, string? InstructorId, int? SubjectId);

public sealed class ScheduleService(IsmsDbContext db)
{
    private sealed record OfferingKey(string ScheduleId, int SubjectId, string InstructorId);

    public async Task<PagedResult<ScheduleDto>> ListAsync(ScheduleFilter filter, PageRequest page, CancellationToken ct)
    {
        var rows =
            from s in db.Schedules
            join i in db.ScheduleItems on s.RefId equals i.RefId
            select new { s, i };
        if (filter.SchoolYearId is { } sy) rows = rows.Where(r => r.s.SyId == sy);
        if (filter.SemesterId is { } sem) rows = rows.Where(r => r.s.SemesterId == sem);
        if (filter.SubjectId is { } subj) rows = rows.Where(r => r.i.SubjectId == subj);
        if (!string.IsNullOrWhiteSpace(filter.InstructorId)) rows = rows.Where(r => r.i.InstructorId == filter.InstructorId);

        // Page over offerings (not over meeting rows), then load the meetings for that page.
        var keysQuery = rows
            .Select(r => new { ScheduleId = r.s.RefId, r.i.SubjectId, r.i.InstructorId })
            .Distinct();
        var total = await keysQuery.CountAsync(ct);
        var keys = (await keysQuery
                .OrderBy(k => k.ScheduleId).ThenBy(k => k.SubjectId).ThenBy(k => k.InstructorId)
                .Skip(page.Skip).Take(page.PageSize)
                .ToListAsync(ct))
            .Select(k => new OfferingKey(k.ScheduleId, k.SubjectId, k.InstructorId))
            .ToList();
        if (keys.Count == 0)
            return new PagedResult<ScheduleDto>([], page.Page, page.PageSize, total);

        var scheduleIds = keys.Select(k => k.ScheduleId).Distinct().ToList();
        var details = await (
            from r in rows
            where scheduleIds.Contains(r.s.RefId)
            join sec in db.Sections on r.s.SectionId equals sec.Id into secs
            from sec in secs.DefaultIfEmpty()
            join sub in db.Subjects on r.i.SubjectId equals sub.Id into subs
            from sub in subs.DefaultIfEmpty()
            join emp in db.Employees on r.i.InstructorId equals emp.RefId into emps
            from emp in emps.DefaultIfEmpty()
            select new
            {
                ScheduleId = r.s.RefId, r.s.SyId, r.s.SemesterId, r.s.SectionId,
                SectionName = sec == null ? null : sec.Name,
                r.i.SubjectId,
                SubjectCode = sub == null ? null : sub.ShortCode,
                SubjectName = sub == null ? null : sub.Name,
                r.i.InstructorId,
                InstructorFirst = emp == null ? null : emp.Fname,
                InstructorLast = emp == null ? null : emp.Lname,
                InstructorSuffix = emp == null ? null : emp.Suffix,
                r.i.DayId, r.i.TimeFrom, r.i.TimeTo, r.i.RoomId, r.i.Modality,
            }).ToListAsync(ct);

        var byKey = details.ToLookup(d => new OfferingKey(d.ScheduleId, d.SubjectId, d.InstructorId));
        var items = keys.Select(key =>
        {
            var group = byKey[key].ToList();
            var first = group[0];
            return new ScheduleDto(
                key.ScheduleId, first.SyId, first.SemesterId, first.SectionId, first.SectionName,
                key.SubjectId, first.SubjectCode, first.SubjectName ?? "",
                key.InstructorId, FullName(first.InstructorFirst, first.InstructorLast, first.InstructorSuffix),
                group.OrderBy(g => g.DayId).ThenBy(g => g.TimeFrom)
                    .Select(g => new MeetingDto(g.DayId, Hhmm(g.TimeFrom), Hhmm(g.TimeTo), g.RoomId, g.Modality))
                    .ToList());
        }).ToList();
        return new PagedResult<ScheduleDto>(items, page.Page, page.PageSize, total);
    }

    /// <summary>Students in a schedule, or null when the schedule does not exist.</summary>
    public async Task<PagedResult<ScheduleStudentDto>?> StudentsAsync(string scheduleId, PageRequest page, CancellationToken ct)
    {
        if (!await db.Schedules.AnyAsync(s => s.RefId == scheduleId, ct))
            return null;
        var query =
            from ss in db.ScheduleStudents
            where ss.RefId == scheduleId
            join en in db.Enrollments on ss.EnrollmentId equals en.RefId
            join st in db.Students on en.StudentId equals st.RefId
            orderby st.Lname, st.Fname, st.RefId
            select new ScheduleStudentDto(st.RefId, en.RefId, st.Fname, st.Mname, st.Lname);
        return await page.ApplyAsync(query, ct);
    }

    private static string Hhmm(TimeSpan t) => t.ToString(@"hh\:mm");

    private static string FullName(params string?[] parts) =>
        string.Join(' ', parts.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim()));
}

public static class ScheduleEndpoints
{
    public static void MapScheduleEndpoints(this IEndpointRouteBuilder v1)
    {
        v1.MapGet("/schedules", async (
                int? schoolYearId, int? semesterId, string? instructorId, int? subjectId,
                int? page, int? pageSize, ScheduleService service, CancellationToken ct) =>
                PageRequest.TryCreate(page, pageSize, out var p, out var problem)
                    ? Results.Ok(await service.ListAsync(new ScheduleFilter(schoolYearId, semesterId, instructorId, subjectId), p, ct))
                    : problem!)
            .RequirePermission(Permissions.ScheduleView)
            .WithName("ListSchedules");

        v1.MapGet("/schedules/{scheduleId}/students", async (
                string scheduleId, int? page, int? pageSize, ScheduleService service, CancellationToken ct) =>
            {
                if (!PageRequest.TryCreate(page, pageSize, out var p, out var problem))
                    return problem!;
                var result = await service.StudentsAsync(scheduleId, p, ct);
                return result is null
                    ? Results.Problem(statusCode: StatusCodes.Status404NotFound, title: "Schedule not found.")
                    : Results.Ok(result);
            })
            .RequirePermission(Permissions.StudentView)
            .WithName("ListScheduleStudents");
    }
}
