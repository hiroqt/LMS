using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Content;

/// <summary>
/// Modules, materials and announcements of a class. Instructors manage their own classes;
/// students on the class list read them (archived items hidden). Every change writes a
/// metadata-only audit row in the same transaction.
/// </summary>
public static class ContentEndpoints
{
    public static IEndpointRouteBuilder MapContentEndpoints(this IEndpointRouteBuilder app)
    {
        var me = app.MapGroup("/api/me").RequireDemoUser();

        // The active classes of the person the client is viewing as, from lmsdb.
        me.MapGet("/classes", async (HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var query = db.IsmsClasses.AsNoTracking().Where(c => c.IsActive);
            query = user.IsInstructor
                ? query.Where(c => c.InstructorId == user.Id)
                : query.Where(c => db.IsmsClassStudents.Any(s => s.ClassId == c.Id && s.StudentId == user.Id && s.IsActive));
            var rows = await query.OrderBy(c => c.SectionName).ThenBy(c => c.SubjectCode).ToListAsync(ct);
            return TypedResults.Ok(new MyClasses(user.Role, rows.Select(ToClass).ToList()));
        }).WithName("ListMyClasses");

        var cls = app.MapGroup("/api/classes/{classId}").RequireDemoUser();

        // ------------------------------------------------------------------ modules
        cls.MapGet("/modules", async Task<IResult> (string classId, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var (_, denied) = await access.ForReadAsync(classId, http.CurrentUser(), ct);
            if (denied is not null) return denied;
            var rows = await db.Modules.AsNoTracking().Where(m => m.ClassId == classId)
                .OrderBy(m => m.SortOrder).ThenBy(m => m.Id).ToListAsync(ct);
            return TypedResults.Ok(rows.Select(m => m.ToDto()).ToList());
        }).WithName("ListModules");

        cls.MapPost("/modules", async Task<IResult> (string classId, ModuleCreate input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var errors = new Errors();
            var title = errors.Required("title", input.Title, ContentRules.TitleMax, "a title");
            if (input.SortOrder is < 0) errors.Add("sortOrder", "Sort order must be 0 or more.");
            if (input.ParentModuleId is { } parentId)
            {
                // Two levels at most: a module, and submodules under it.
                var parent = await db.Modules.AsNoTracking().SingleOrDefaultAsync(m => m.Id == parentId && m.ClassId == classId, ct);
                if (parent is null) errors.Add("parentModuleId", "Choose a module of this class.");
                else if (parent.ParentModuleId is not null) errors.Add("parentModuleId", "A submodule cannot have its own submodules.");
            }
            if (errors.Any) return errors.Result();

            var sortOrder = input.SortOrder ?? (await db.Modules.Where(m => m.ClassId == classId && m.ParentModuleId == input.ParentModuleId)
                .Select(m => (int?)m.SortOrder).MaxAsync(ct) ?? 0) + 1;
            var row = new Module { ClassId = classId, ParentModuleId = input.ParentModuleId, Title = title!, SortOrder = sortOrder };
            await SaveWithAuditAsync(db, user, row, "created", "Module", () => row.Id, ct);
            return TypedResults.Created($"/api/classes/{classId}/modules/{row.Id}", row.ToDto());
        }).WithName("CreateModule");

        cls.MapPatch("/modules/{id:long}", async Task<IResult> (string classId, long id, ModuleUpdate input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Modules.SingleOrDefaultAsync(m => m.Id == id && m.ClassId == classId, ct);
            if (row is null) return NotFound("Module");
            var errors = new Errors();
            if (input.Title is not null) row.Title = errors.Required("title", input.Title, ContentRules.TitleMax, "a title") ?? row.Title;
            if (input.SortOrder is { } order) { if (order < 0) errors.Add("sortOrder", "Sort order must be 0 or more."); else row.SortOrder = order; }
            if (errors.Any) return errors.Result();
            await SaveWithAuditAsync(db, user, row, "updated", "Module", () => row.Id, ct);
            return TypedResults.Ok(row.ToDto());
        }).WithName("UpdateModule");

        // ---------------------------------------------------------------- materials
        cls.MapGet("/materials", async Task<IResult> (string classId, long? moduleId, int? page, int? pageSize, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            if (PageError(page, pageSize) is { } bad) return bad;
            var query = db.Materials.AsNoTracking().Where(m => m.ClassId == classId);
            if (user.IsStudent) query = query.Where(m => m.Status == ContentStatus.Active);
            if (moduleId is { } mid) query = query.Where(m => m.ModuleId == mid);
            return TypedResults.Ok(await PageAsync(query.OrderBy(m => m.Id), page, pageSize, m => m.ToDto(), ct));
        }).WithName("ListMaterials");

        cls.MapPost("/materials", async Task<IResult> (string classId, MaterialCreate input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var errors = new Errors();
            var title = errors.Required("title", input.Title, ContentRules.TitleMax, "a title");
            var kind = KindOf(errors, input.Kind);
            var description = errors.Optional("description", input.Description, ContentRules.DescriptionMax);
            var fileName = errors.Optional("fileName", input.FileName, 255);
            if (fileName?.IndexOfAny(['/', '\\']) >= 0) errors.Add("fileName", "Use a file name without a folder path.");
            var fileType = errors.Optional("fileType", input.FileType, 20);
            var fileSize = errors.Optional("fileSize", input.FileSize, 20);
            if (!await db.Modules.AnyAsync(m => m.Id == input.ModuleId && m.ClassId == classId, ct))
                errors.Add("moduleId", "Choose a module of this class.");
            if (errors.Any) return errors.Result();

            var row = new Material { ClassId = classId, ModuleId = input.ModuleId, Title = title!, Kind = kind!, Description = description, FileName = fileName, FileType = fileType, FileSize = fileSize };
            await SaveWithAuditAsync(db, user, row, "created", "Material", () => row.Id, ct);
            return TypedResults.Created($"/api/classes/{classId}/materials/{row.Id}", row.ToDto());
        }).WithName("CreateMaterial");

        cls.MapPatch("/materials/{id:long}", async Task<IResult> (string classId, long id, MaterialUpdate input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Materials.SingleOrDefaultAsync(m => m.Id == id && m.ClassId == classId, ct);
            if (row is null) return NotFound("Material");
            var errors = new Errors();
            if (input.Title is not null) row.Title = errors.Required("title", input.Title, ContentRules.TitleMax, "a title") ?? row.Title;
            if (input.Kind is not null) row.Kind = KindOf(errors, input.Kind) ?? row.Kind;
            if (input.Description is not null) row.Description = errors.Optional("description", input.Description, ContentRules.DescriptionMax);
            if (input.Status is not null) row.Status = StatusOf(errors, input.Status) ?? row.Status;
            if (input.ModuleId is { } moduleId)
            {
                if (await db.Modules.AnyAsync(m => m.Id == moduleId && m.ClassId == classId, ct)) row.ModuleId = moduleId;
                else errors.Add("moduleId", "Choose a module of this class.");
            }
            if (errors.Any) return errors.Result();
            var action = input.Status == ContentStatus.Archived ? "archived" : input.Status == ContentStatus.Active ? "restored" : "updated";
            await SaveWithAuditAsync(db, user, row, action, "Material", () => row.Id, ct);
            return TypedResults.Ok(row.ToDto());
        }).WithName("UpdateMaterial");

        cls.MapDelete("/materials/{id:long}", async Task<IResult> (string classId, long id, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Materials.SingleOrDefaultAsync(m => m.Id == id && m.ClassId == classId, ct);
            if (row is null) return NotFound("Material");
            db.Materials.Remove(row);
            await SaveWithAuditAsync(db, user, null, "deleted", "Material", () => id, ct);
            return TypedResults.NoContent();
        }).WithName("DeleteMaterial");

        // ------------------------------------------------------------ announcements
        cls.MapGet("/announcements", async Task<IResult> (string classId, int? page, int? pageSize, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForReadAsync(classId, user, ct);
            if (denied is not null) return denied;
            if (PageError(page, pageSize) is { } bad) return bad;
            var query = db.Announcements.AsNoTracking().Where(a => a.ClassId == classId);
            if (user.IsStudent) query = query.Where(a => a.Status == ContentStatus.Active);
            return TypedResults.Ok(await PageAsync(query.OrderByDescending(a => a.PublishedAt).ThenByDescending(a => a.Id), page, pageSize, a => a.ToDto(), ct));
        }).WithName("ListAnnouncements");

        cls.MapPost("/announcements", async Task<IResult> (string classId, AnnouncementCreate input, HttpContext http, ClassAccess access, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var errors = new Errors();
            var title = errors.Required("title", input.Title, ContentRules.AnnouncementTitleMax, "a title");
            var message = errors.Required("message", input.Message, ContentRules.AnnouncementMessageMax, "a message");
            if (errors.Any) return errors.Result();
            var row = new Announcement { ClassId = classId, Title = title!, Message = message!, PublishedAt = time.GetUtcNow().UtcDateTime };
            await SaveWithAuditAsync(db, user, row, "published", "Announcement", () => row.Id, ct);
            return TypedResults.Created($"/api/classes/{classId}/announcements/{row.Id}", row.ToDto());
        }).WithName("CreateAnnouncement");

        cls.MapPatch("/announcements/{id:long}", async Task<IResult> (string classId, long id, AnnouncementUpdate input, HttpContext http, ClassAccess access, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (_, denied) = await access.ForWriteAsync(classId, user, ct);
            if (denied is not null) return denied;
            var row = await db.Announcements.SingleOrDefaultAsync(a => a.Id == id && a.ClassId == classId, ct);
            if (row is null) return NotFound("Announcement");
            var errors = new Errors();
            row.Status = StatusOf(errors, input.Status) ?? row.Status;
            if (errors.Any) return errors.Result();
            await SaveWithAuditAsync(db, user, row, row.Status == ContentStatus.Archived ? "archived" : "restored", "Announcement", () => row.Id, ct);
            return TypedResults.Ok(row.ToDto());
        }).WithName("UpdateAnnouncement");

        return app;
    }

    private static MyClass ToClass(IsmsClass c) => new(
        c.Id, c.ScheduleId, c.SubjectId, c.SubjectCode, c.SubjectName, c.SectionId, c.SectionName,
        c.InstructorId, c.InstructorName, c.SchoolYearId, c.SemesterId, c.TermName,
        System.Text.Json.JsonSerializer.Deserialize<List<Classes.ClassMeeting>>(c.MeetingsJson, System.Text.Json.JsonSerializerOptions.Web) ?? []);

    private static string? KindOf(Errors errors, string? kind)
    {
        var match = ContentRules.MaterialKinds.FirstOrDefault(k => string.Equals(k, kind?.Trim(), StringComparison.OrdinalIgnoreCase));
        if (match is null) errors.Add("kind", $"Choose one of: {string.Join(", ", ContentRules.MaterialKinds)}.");
        return match;
    }

    private static string? StatusOf(Errors errors, string? status)
    {
        if (status is ContentStatus.Active or ContentStatus.Archived) return status;
        errors.Add("status", "Choose active or archived.");
        return null;
    }

    internal static IResult? PageError(int? page, int? pageSize)
    {
        var errors = new Errors();
        if (page is < 1) errors.Add("page", "page must be 1 or more.");
        if (pageSize is < 1 or > ContentRules.MaxPageSize) errors.Add("pageSize", $"pageSize must be between 1 and {ContentRules.MaxPageSize}.");
        return errors.Any ? errors.Result() : null;
    }

    internal static async Task<PagedList<TDto>> PageAsync<TRow, TDto>(IQueryable<TRow> ordered, int? page, int? pageSize, Func<TRow, TDto> map, CancellationToken ct)
    {
        var p = page ?? 1;
        var size = pageSize ?? ContentRules.DefaultPageSize;
        var total = await ordered.CountAsync(ct);
        var rows = await ordered.Skip((p - 1) * size).Take(size).ToListAsync(ct);
        return new PagedList<TDto>(rows.Select(map).ToList(), p, size, total);
    }

    internal static IResult NotFound(string what) =>
        TypedResults.Problem(statusCode: StatusCodes.Status404NotFound, title: $"{what} not found");

    /// <summary>
    /// Saves the change and its audit row together: the row's id is known only after the first
    /// save, so both saves share one transaction and neither is kept if the other fails.
    /// </summary>
    internal static async Task SaveWithAuditAsync(LmsDbContext db, CurrentUser user, object? added, string action, string target, Func<long> id, CancellationToken ct, string category = "content")
    {
        if (added is not null && db.Entry(added).State == EntityState.Detached) db.Add(added);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await db.SaveChangesAsync(ct);
        db.AuditLog.Add(new AuditLogEntry
        {
            ActorId = user.Id,
            ActorRole = user.Role,
            Category = category,
            Action = action,
            Target = target,
            TargetId = id().ToString(System.Globalization.CultureInfo.InvariantCulture),
            Summary = $"{target} {action}",
        });
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
