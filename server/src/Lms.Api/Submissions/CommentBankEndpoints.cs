using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Submissions;

public sealed record SavedCommentDto(long Id, string Text);
public sealed record SavedCommentInput(string? Text);

/// <summary>
/// An instructor's saved feedback comments (D-062, contract §13). They belong to the instructor,
/// not to a class, so they follow them from class to class. Nobody else can read them.
/// </summary>
public static class CommentBankEndpoints
{
    private const int TextMax = 500;
    private const int MaxComments = 200;

    public static IEndpointRouteBuilder MapCommentBankEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/comment-bank").RequireDemoUser();

        group.MapGet("", async Task<IResult> (HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            if (!user.IsInstructor) return InstructorsOnly();
            var rows = await db.SavedComments.AsNoTracking().Where(c => c.OwnerInstructorId == user.Id).OrderByDescending(c => c.Id).ToListAsync(ct);
            return TypedResults.Ok(rows.Select(ToDto).ToList());
        }).WithName("ListSavedComments");

        group.MapPost("", async Task<IResult> (SavedCommentInput input, HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            if (!user.IsInstructor) return InstructorsOnly();
            var errors = new Errors();
            var text = errors.Required("text", input.Text, TextMax, "a comment");
            if (errors.Any) return errors.Result();
            var mine = await db.SavedComments.Where(c => c.OwnerInstructorId == user.Id).ToListAsync(ct);
            // Saving the same comment twice keeps one.
            if (mine.FirstOrDefault(c => c.Text == text) is { } same) return TypedResults.Ok(ToDto(same));
            if (mine.Count >= MaxComments) return TypedResults.Problem(statusCode: StatusCodes.Status409Conflict, title: $"You have saved {MaxComments} comments. Delete one you no longer use to save another.");
            db.Actor = user.Id;
            var row = new SavedComment { OwnerInstructorId = user.Id, Text = text! };
            db.SavedComments.Add(row);
            await db.SaveChangesAsync(ct);
            return TypedResults.Created($"/api/comment-bank/{row.Id}", ToDto(row));
        }).WithName("SaveComment");

        group.MapPut("/{id:long}", async Task<IResult> (long id, SavedCommentInput input, HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            if (!user.IsInstructor) return InstructorsOnly();
            var row = await db.SavedComments.SingleOrDefaultAsync(c => c.Id == id && c.OwnerInstructorId == user.Id, ct);
            if (row is null) return ContentEndpoints.NotFound("Comment");
            var errors = new Errors();
            var text = errors.Required("text", input.Text, TextMax, "a comment");
            if (errors.Any) return errors.Result();
            db.Actor = user.Id;
            row.Text = text!;
            await db.SaveChangesAsync(ct);
            return TypedResults.Ok(ToDto(row));
        }).WithName("UpdateSavedComment");

        group.MapDelete("/{id:long}", async Task<IResult> (long id, HttpContext http, LmsDbContext db, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            if (!user.IsInstructor) return InstructorsOnly();
            var row = await db.SavedComments.SingleOrDefaultAsync(c => c.Id == id && c.OwnerInstructorId == user.Id, ct);
            if (row is null) return ContentEndpoints.NotFound("Comment");
            db.SavedComments.Remove(row);
            await db.SaveChangesAsync(ct);
            return TypedResults.NoContent();
        }).WithName("DeleteSavedComment");

        return app;
    }

    private static SavedCommentDto ToDto(SavedComment row) => new(row.Id, row.Text);

    private static IResult InstructorsOnly() =>
        TypedResults.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Only instructors have saved comments.");
}
