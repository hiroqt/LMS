using Lms.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Endpoints;

public sealed record ModuleInput(string? Title, int SortOrder = 0);
public sealed record MaterialInput(long ModuleId, string? Title, string? Kind, string? Description = null,
    string? FileName = null, string? FileType = null, string? FileSize = null);
public sealed record AnnouncementInput(string? Title, string? Message);
public sealed record MaterialStatusInput(string? Status);
public sealed record ClassContentResponse(IReadOnlyList<Module> Modules, IReadOnlyList<Material> Materials,
    IReadOnlyList<Announcement> Announcements, int? NextOffset);

/// <summary>Local demo content API. The selected instructor header is not authentication.</summary>
public static class ClassContentEndpoints
{
    public const string InstructorHeader = "X-Demo-Instructor-Id";

    public static IEndpointRouteBuilder MapClassContentEndpoints(this IEndpointRouteBuilder app)
    {
        // shortcut: demo identities are caller-selected; require real authentication before production use.
        if (!app.ServiceProvider.GetRequiredService<IHostEnvironment>().IsDevelopment()) return app;
        var content = app.MapGroup("/api/classes/{classId}/content");

        content.MapGet("", async Task<IResult> (string classId, int? offset, int? limit,
            HttpRequest request, LmsDbContext db, CancellationToken ct) =>
        {
            var (_, error) = await ClassAsync(classId, request, db, false, ct);
            if (error is not null) return error;
            var start = offset ?? 0;
            var size = limit ?? 200;
            if (start < 0 || size is < 1 or > 200)
                return Invalid("pagination", "Offset must be non-negative and limit must be between 1 and 200.");
            var modules = await db.Modules.AsNoTracking().Where(x => x.ClassId == classId)
                .OrderBy(x => x.SortOrder).ThenBy(x => x.Id).Skip(start).Take(size + 1).ToListAsync(ct);
            var materials = await db.Materials.AsNoTracking().Where(x => x.ClassId == classId)
                .OrderBy(x => x.Id).Skip(start).Take(size + 1).ToListAsync(ct);
            var announcements = await db.Announcements.AsNoTracking().Where(x => x.ClassId == classId)
                .OrderByDescending(x => x.PublishedAt).ThenByDescending(x => x.Id).Skip(start).Take(size + 1).ToListAsync(ct);
            var more = modules.Count > size || materials.Count > size || announcements.Count > size;
            return TypedResults.Ok(new ClassContentResponse(modules.Take(size).ToList(), materials.Take(size).ToList(),
                announcements.Take(size).ToList(), more ? checked(start + size) : null));
        }).WithName("GetClassContent");

        content.MapPost("/modules", async Task<IResult> (string classId, ModuleInput input,
            HttpRequest request, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (_, error) = await ClassAsync(classId, request, db, true, ct);
            if (error is not null) return error;
            if (!Required(input.Title, 250)) return Invalid("title", "Enter a title of at most 250 characters.");
            if (input.SortOrder < 0) return Invalid("sortOrder", "Sort order must be non-negative.");
            var row = new Module { ClassId = classId, Title = input.Title!.Trim(), SortOrder = input.SortOrder };
            db.Modules.Add(row);
            Audit(db, time, classId, "created", "Module");
            await db.SaveChangesAsync(ct);
            return TypedResults.Created($"/api/classes/{classId}/content", row);
        }).WithName("CreateClassModule");

        content.MapPost("/materials", async Task<IResult> (string classId, MaterialInput input,
            HttpRequest request, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (_, error) = await ClassAsync(classId, request, db, true, ct);
            if (error is not null) return error;
            if (!Required(input.Title, 250)) return Invalid("title", "Enter a title of at most 250 characters.");
            if (!Required(input.Kind, 50)) return Invalid("kind", "Enter a resource type of at most 50 characters.");
            if (!Optional(input.Description, 10000)) return Invalid("description", "Use at most 10000 characters.");
            if (!Optional(input.FileName, 255) || input.FileName?.IndexOfAny(['/', '\\']) >= 0)
                return Invalid("fileName", "Use a filename without a path, at most 255 characters.");
            if (!Optional(input.FileType, 20) || !Optional(input.FileSize, 20))
                return Invalid("file", "File type and size must each be at most 20 characters.");
            if (!await db.Modules.AnyAsync(x => x.Id == input.ModuleId && x.ClassId == classId, ct))
                return Invalid("moduleId", "Choose a module belonging to this class.");
            var row = new Material
            {
                ClassId = classId, ModuleId = input.ModuleId, Title = input.Title!.Trim(), Kind = input.Kind!.Trim(),
                Description = input.Description?.Trim(), FileName = input.FileName?.Trim(),
                FileType = input.FileType?.Trim(), FileSize = input.FileSize?.Trim(),
            };
            db.Materials.Add(row);
            Audit(db, time, classId, "published", "Material");
            await db.SaveChangesAsync(ct);
            return TypedResults.Created($"/api/classes/{classId}/content", row);
        }).WithName("CreateClassMaterial");

        content.MapPost("/announcements", async Task<IResult> (string classId, AnnouncementInput input,
            HttpRequest request, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (_, error) = await ClassAsync(classId, request, db, true, ct);
            if (error is not null) return error;
            if (!Required(input.Title, 120)) return Invalid("title", "Enter a title of at most 120 characters.");
            if (!Required(input.Message, 1200)) return Invalid("message", "Enter a message of at most 1200 characters.");
            var row = new Announcement
            {
                ClassId = classId, Title = input.Title!.Trim(), Message = input.Message!.Trim(),
                PublishedAt = time.GetUtcNow().UtcDateTime,
            };
            db.Announcements.Add(row);
            Audit(db, time, classId, "published", "Announcement");
            await db.SaveChangesAsync(ct);
            return TypedResults.Created($"/api/classes/{classId}/content", row);
        }).WithName("CreateClassAnnouncement");

        content.MapPatch("/materials/{id:long}", async Task<IResult> (string classId, long id, MaterialStatusInput input,
            HttpRequest request, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (_, error) = await ClassAsync(classId, request, db, true, ct);
            if (error is not null) return error;
            if (input.Status is not ContentStatus.Active and not ContentStatus.Archived)
                return Invalid("status", "Choose active or archived.");
            var row = await db.Materials.SingleOrDefaultAsync(x => x.Id == id && x.ClassId == classId, ct);
            if (row is null) return TypedResults.NotFound();
            row.Status = input.Status;
            Audit(db, time, classId, "updated", "Material", id);
            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(row);
        }).WithName("SetClassMaterialStatus");

        content.MapDelete("/materials/{id:long}", async Task<IResult> (string classId, long id,
            HttpRequest request, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var (_, error) = await ClassAsync(classId, request, db, true, ct);
            if (error is not null) return error;
            var row = await db.Materials.SingleOrDefaultAsync(x => x.Id == id && x.ClassId == classId, ct);
            if (row is null) return TypedResults.NotFound();
            db.Materials.Remove(row);
            Audit(db, time, classId, "deleted", "Material", id);
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        }).WithName("DeleteClassMaterial");

        return app;
    }

    private static async Task<(IsmsClass? Class, IResult? Error)> ClassAsync(string id, HttpRequest request,
        LmsDbContext db, bool write, CancellationToken ct)
    {
        var room = await db.IsmsClasses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (room is null) return (null, TypedResults.NotFound());
        var actor = request.Headers[InstructorHeader];
        if (actor.Count != 1 || !string.Equals(actor[0], room.InstructorId, StringComparison.Ordinal))
            return (null, TypedResults.Problem(statusCode: 403, title: "Select this class's instructor to use demo content."));
        if (write && !room.IsActive)
            return (null, TypedResults.Problem(statusCode: 409, title: "This class is inactive; its content is read-only."));
        db.Actor = room.InstructorId;
        return (room, null);
    }

    private static bool Required(string? value, int max) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= max;
    private static bool Optional(string? value, int max) => value is null || value.Length <= max;
    private static IResult Invalid(string field, string message) => TypedResults.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    private static void Audit(LmsDbContext db, TimeProvider time, string classId, string action, string target, long? id = null) =>
        db.AuditLog.Add(new AuditLogEntry
        {
            ActorId = db.Actor, ActorRole = "instructor", Category = "courses", Action = action,
            Target = target, TargetId = id?.ToString(System.Globalization.CultureInfo.InvariantCulture) ?? classId,
            Summary = $"{target} {action}", CreatedAt = time.GetUtcNow().UtcDateTime,
        });
}
