using Lms.Api.Data;
using Lms.Api.Files;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Lms.Api.Submissions;

public sealed class RetentionOptions
{
    public const string SectionName = "Lms:Retention";
    public bool Enabled { get; set; } = true;
    /// <summary>Attempts are anonymized once their term is more than this many terms behind the current one (D-042, RA 10173).</summary>
    public int AttemptTerms { get; set; } = 2;
}

public readonly record struct Term(int SchoolYearId, int SemesterId) : IComparable<Term>
{
    public int CompareTo(Term other) => SchoolYearId != other.SchoolYearId ? SchoolYearId.CompareTo(other.SchoolYearId) : SemesterId.CompareTo(other.SemesterId);
}

/// <param name="Terms">Terms whose attempts were checked.</param>
/// <param name="Submissions">Submissions whose text was cleared.</param>
/// <param name="Answers">Answers whose text, items or matches were cleared.</param>
/// <param name="Files">Uploaded files that were deleted (D-055).</param>
public sealed record RetentionResult(int Terms, int Submissions, int Answers, int Files = 0);

/// <summary>
/// Anonymizes old attempts (contract §7): answer text, items and matches, and the submission's
/// text and link are cleared, its uploaded files are deleted, and the submission is marked anonymized; scores, points and grades stay. Terms are ordered by ISMS school year and
/// semester ids (both increase over time), and only classes ISMS no longer offers are touched.
/// </summary>
public sealed class AttemptRetention(LmsDbContext db, IOptions<RetentionOptions> options, TimeProvider time, IFileStore files, ILogger<AttemptRetention> logger)
{
    /// <summary>The known terms that are more than <paramref name="keep"/> terms behind <paramref name="current"/>.</summary>
    public static IReadOnlyList<Term> ExpiredTerms(IEnumerable<Term> known, Term current, int keep)
    {
        var ordered = known.Append(current).Distinct().Order().ToList();
        var now = ordered.IndexOf(current);
        return ordered.Where((_, i) => now - i > Math.Max(0, keep)).ToList();
    }

    public async Task<RetentionResult> RunAsync(CancellationToken ct)
    {
        var active = await db.IsmsClasses.AsNoTracking().Where(c => c.IsActive).Select(c => new { c.SchoolYearId, c.SemesterId }).Distinct().ToListAsync(ct);
        // No class offered now: more likely an ISMS problem than the end of every term, so nothing is touched.
        if (active.Count == 0) return new RetentionResult(0, 0, 0);
        var current = active.Select(t => new Term(t.SchoolYearId, t.SemesterId)).Max();
        var known = (await db.IsmsClasses.AsNoTracking().Select(c => new { c.SchoolYearId, c.SemesterId }).Distinct().ToListAsync(ct))
            .Select(t => new Term(t.SchoolYearId, t.SemesterId));
        var expired = ExpiredTerms(known, current, options.Value.AttemptTerms);
        if (expired.Count == 0) return new RetentionResult(0, 0, 0);

        var classIds = (await db.IsmsClasses.AsNoTracking().Where(c => !c.IsActive).Select(c => new { c.Id, c.SchoolYearId, c.SemesterId }).ToListAsync(ct))
            .Where(c => expired.Contains(new Term(c.SchoolYearId, c.SemesterId))).Select(c => c.Id).ToList();
        var submissions = db.Submissions.Where(s => db.Coursework.Any(c => c.Id == s.CourseworkId && classIds.Contains(c.ClassId)));

        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var texts = await submissions.Where(s => s.Text != null || s.Link != null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Text, (string?)null).SetProperty(x => x.Link, (string?)null), ct);
        var answers = await db.SubmissionAnswers.Where(a => a.AnswerText != null && submissions.Any(s => s.Id == a.SubmissionId))
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.AnswerText, (string?)null), ct);
        // Marked so no re-score ever reads the cleared answers as wrong ones.
        var now = time.GetUtcNow().UtcDateTime;
        await submissions.Where(s => s.AnonymizedAt == null).ExecuteUpdateAsync(s => s.SetProperty(x => x.AnonymizedAt, now), ct);
        // Uploaded files go too: the row stays as a record that a file existed, without its name.
        var keys = await db.StoredFiles.Where(f => f.DeletedAt == null && classIds.Contains(f.ClassId)).Select(f => f.StorageKey).ToListAsync(ct);
        if (keys.Count > 0)
            await db.StoredFiles.Where(f => f.DeletedAt == null && classIds.Contains(f.ClassId))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.DeletedAt, now).SetProperty(x => x.Name, ""), ct);
        if (texts + answers + keys.Count > 0)
        {
            // Metadata only: counts, never content.
            db.AuditLog.Add(new AuditLogEntry
            {
                ActorId = LmsDbContext.SystemActor, ActorRole = LmsDbContext.SystemActor, Category = "retention", Action = "anonymized", Target = "Attempts",
                Summary = $"Anonymized {texts} submissions and {answers} answers, and deleted {keys.Count} files, from {expired.Count} terms",
            });
            await db.SaveChangesAsync(ct);
        }
        await transaction.CommitAsync(ct);
        // The bytes go only once the database says they are gone; a file that can't be deleted now is logged, not retried.
        foreach (var key in keys)
        {
            try { files.Delete(key); }
            catch (Exception e) { logger.LogWarning(e, "Retention could not delete stored file {Key}", key); }
        }
        return new RetentionResult(expired.Count, texts, answers, keys.Count);
    }
}

/// <summary>Runs <see cref="AttemptRetention"/> once a day, starting a few minutes after startup. Off in Demo mode.</summary>
public sealed class RetentionWorker(IServiceScopeFactory scopes, TimeProvider time, IOptions<RetentionOptions> options, ILogger<RetentionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled) return;
        var wait = TimeSpan.FromMinutes(5);
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await Task.Delay(wait, time, stoppingToken); }
            catch (OperationCanceledException) { return; }
            wait = TimeSpan.FromDays(1);
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var result = await scope.ServiceProvider.GetRequiredService<AttemptRetention>().RunAsync(stoppingToken);
                logger.LogInformation("Retention: {Submissions} submissions and {Answers} answers anonymized", result.Submissions, result.Answers);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception ex)
            {
                // Never let one failed run stop the worker; it tries again tomorrow.
                logger.LogWarning(ex, "Retention run failed");
            }
        }
    }
}
