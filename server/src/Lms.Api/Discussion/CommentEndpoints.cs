using Lms.Api.Content;
using Lms.Api.Coursework;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Discussion;

/// <param name="CanDelete">The caller wrote it, or is the class's instructor.</param>
public sealed record CommentDto(long Id, string AuthorId, string AuthorName, string AuthorRole, string Body, DateTime CreatedAt, bool CanDelete);

/// <summary>The private comments between one student and the instructor, oldest first.</summary>
public sealed record PrivateThreadDto(string StudentId, string StudentName, IReadOnlyList<CommentDto> Comments);

/// <param name="Class">The public discussion: everyone on the class list and the instructor, oldest first.</param>
/// <param name="Private">A student gets only their own thread (empty until someone writes in it); the instructor gets every student's thread that has comments, most recent first.</param>
public sealed record CommentThreads(IReadOnlyList<CommentDto> Class, IReadOnlyList<PrivateThreadDto> Private);

/// <param name="Visibility"><c>class</c> (the default) or <c>private</c>.</param>
/// <param name="StudentId">The instructor's private reply: whose thread it goes in. Students never send it.</param>
public sealed record CommentCreate(string? Body, string? Visibility, string? StudentId);

/// <summary>
/// Comments on a material or a piece of coursework (assignments, quizzes and exams). Class
/// comments are read and written by the class's instructor and every student on its active
/// class list. A private comment is seen only by its student and the instructor. Comment text
/// never goes into the audit log.
/// </summary>
public static class CommentEndpoints
{
    public const int BodyMax = 2000;

    public static IEndpointRouteBuilder MapCommentEndpoints(this IEndpointRouteBuilder app)
    {
        var cls = app.MapGroup("/api/classes/{classId}").RequireDemoUser();
        MapThread(cls, "materials", CommentTarget.Material);
        MapThread(cls, "coursework", CommentTarget.Coursework);
        return app;
    }

    private static void MapThread(RouteGroupBuilder cls, string segment, string targetType)
    {
        var name = targetType == CommentTarget.Material ? "Material" : "Coursework";

        cls.MapGet($"/{segment}/{{targetId:long}}/comments", async Task<IResult> (string classId, long targetId, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (room, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            if (!await TargetVisibleAsync(db, user, classId, targetType, targetId, time, ct)) return ContentEndpoints.NotFound(name);

            var query = db.Comments.AsNoTracking().Where(c => c.ClassId == classId && c.TargetType == targetType && c.TargetId == targetId);
            if (user.IsStudent) query = query.Where(c => c.Visibility == CommentVisibility.Class || c.StudentId == user.Id);
            var rows = await query.OrderBy(c => c.CreatedAt).ThenBy(c => c.Id).ToListAsync(ct);
            var names = await NamesAsync(db, room!, ct);
            CommentDto Dto(Comment c) => ToDto(c, user, names);

            var publicRows = rows.Where(c => c.Visibility == CommentVisibility.Class).Select(Dto).ToList();
            var threads = rows.Where(c => c.Visibility == CommentVisibility.Private)
                .GroupBy(c => c.StudentId!)
                .Select(g => new PrivateThreadDto(g.Key, NameOf(names, g.Key), g.Select(Dto).ToList()))
                .OrderByDescending(t => t.Comments[^1].CreatedAt)
                .ToList();
            if (user.IsStudent && threads.Count == 0) threads.Add(new PrivateThreadDto(user.Id, NameOf(names, user.Id), []));
            return TypedResults.Ok(new CommentThreads(publicRows, threads));
        }).WithName($"List{name}Comments");

        cls.MapPost($"/{segment}/{{targetId:long}}/comments", async Task<IResult> (string classId, long targetId, CommentCreate input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (room, denied) = await ForCommentingAsync(access, db, classId, user, ct);
            if (denied is not null) return denied;
            if (!await TargetVisibleAsync(db, user, classId, targetType, targetId, time, ct)) return ContentEndpoints.NotFound(name);

            var errors = new Errors();
            var body = errors.Required("body", input.Body, BodyMax, "a comment");
            var visibility = string.IsNullOrWhiteSpace(input.Visibility) ? CommentVisibility.Class : input.Visibility.Trim().ToLowerInvariant();
            if (visibility is not (CommentVisibility.Class or CommentVisibility.Private))
                errors.Add("visibility", "Choose class or private.");
            string? studentId = null;
            if (visibility == CommentVisibility.Private)
            {
                if (user.IsStudent) studentId = user.Id;
                else if (string.IsNullOrWhiteSpace(input.StudentId)) errors.Add("studentId", "Choose the student to reply to.");
                else if (!await db.IsmsClassStudents.AnyAsync(s => s.ClassId == classId && s.StudentId == input.StudentId.Trim() && s.IsActive, ct))
                    errors.Add("studentId", "Choose a student on this class list.");
                else studentId = input.StudentId.Trim();
            }
            else if (!string.IsNullOrWhiteSpace(input.StudentId))
                errors.Add("studentId", "Only private comments go to one student.");
            if (errors.Any) return errors.Result();

            var row = new Comment
            {
                ClassId = classId, TargetType = targetType, TargetId = targetId, Visibility = visibility,
                StudentId = studentId, AuthorId = user.Id, AuthorRole = user.Role, Body = body!,
            };
            await ContentEndpoints.SaveWithAuditAsync(db, user, row, "posted", visibility == CommentVisibility.Private ? "Private comment" : "Class comment", () => row.Id, ct, "discussion");
            var names = await NamesAsync(db, room!, ct);
            return TypedResults.Created($"/api/classes/{classId}/{segment}/{targetId}/comments/{row.Id}", ToDto(row, user, names));
        }).WithName($"Create{name}Comment");

        cls.MapDelete($"/{segment}/{{targetId:long}}/comments/{{id:long}}", async Task<IResult> (string classId, long targetId, long id, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await ForCommentingAsync(access, db, classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Comments.SingleOrDefaultAsync(c => c.Id == id && c.ClassId == classId && c.TargetType == targetType && c.TargetId == targetId, ct);
            // A student never learns that someone else's private comment exists.
            if (row is null || (user.IsStudent && row.Visibility == CommentVisibility.Private && row.StudentId != user.Id))
                return ContentEndpoints.NotFound("Comment");
            if (!CanDelete(row, user))
                return TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Only the comment's author or the class's instructor can delete it.");
            db.Comments.Remove(row);
            await ContentEndpoints.SaveWithAuditAsync(db, user, null, "deleted", row.Visibility == CommentVisibility.Private ? "Private comment" : "Class comment", () => id, ct, "discussion");
            return TypedResults.NoContent();
        }).WithName($"Delete{name}Comment");
    }

    /// <summary>The instructor or a student on the class list, while ISMS still offers the class.</summary>
    private static async Task<(IsmsClass? Class, IResult? Denied)> ForCommentingAsync(ClassAccess access, LmsDbContext db, string classId, CurrentUser user, CancellationToken ct)
    {
        var (room, denied) = await access.ForReadAsync(classId, user, ct);
        if (denied is not null) return (null, denied);
        if (!room!.IsActive)
            return (null, TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: "This class is no longer offered in ISMS, so its comments are read-only."));
        db.Actor = user.Id;
        return (room, null);
    }

    /// <summary>Students comment only on what they can open: active materials, and coursework they can see.</summary>
    private static Task<bool> TargetVisibleAsync(LmsDbContext db, CurrentUser user, string classId, string targetType, long targetId, TimeProvider time, CancellationToken ct)
    {
        if (targetType == CommentTarget.Material)
        {
            var materials = db.Materials.Where(m => m.ClassId == classId && m.Id == targetId);
            if (user.IsStudent) materials = materials.Where(m => m.Status == ContentStatus.Active);
            return materials.AnyAsync(ct);
        }
        var work = CourseworkEndpoints.VisibleTo(user, db.Coursework.Where(c => c.ClassId == classId && c.Id == targetId), time);
        return work.AnyAsync(ct);
    }

    private static bool CanDelete(Comment c, CurrentUser user) => user.IsInstructor || c.AuthorId == user.Id;

    private static CommentDto ToDto(Comment c, CurrentUser user, IReadOnlyDictionary<string, string> names) =>
        new(c.Id, c.AuthorId, NameOf(names, c.AuthorId), c.AuthorRole, c.Body, c.CreatedAt, CanDelete(c, user));

    /// <summary>Display names from the synced class list and the class's instructor.</summary>
    private static async Task<Dictionary<string, string>> NamesAsync(LmsDbContext db, IsmsClass room, CancellationToken ct)
    {
        var students = await db.IsmsClassStudents.AsNoTracking().Where(s => s.ClassId == room.Id)
            .Select(s => new { s.StudentId, s.FirstName, s.LastName }).ToListAsync(ct);
        var names = students.ToDictionary(s => s.StudentId, s => $"{s.FirstName} {s.LastName}".Trim(), StringComparer.Ordinal);
        names[room.InstructorId] = room.InstructorName;
        return names;
    }

    private static string NameOf(IReadOnlyDictionary<string, string> names, string id) =>
        names.TryGetValue(id, out var name) && name.Length > 0 ? name : id;
}
