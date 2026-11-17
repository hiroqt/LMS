using Lms.Api.Data;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Submissions;

/// <summary>
/// Scoring a whole attempt: on submit, and again when the key is fixed, the spelling mode changes,
/// or the instructor decides a near miss. An attempt with an essay or a review near miss still
/// waiting stays submitted; otherwise it is graded with the sum of its answers.
/// </summary>
public static class AttemptGrading
{
    /// <summary>
    /// Scores every automatically scored answer in place (essays keep their points), adding a row
    /// for an unanswered question. Returns true when something still waits for the instructor.
    /// </summary>
    public static bool Rescore(IReadOnlyList<ScoringKey> keys, List<SubmissionAnswer> answers, string spellingMode, long submissionId, Action<SubmissionAnswer> add)
    {
        var waiting = false;
        foreach (var key in keys)
        {
            var answer = answers.FirstOrDefault(a => a.QuestionId == key.Question.Id);
            if (key.Question.Type == QuestionType.Essay)
            {
                waiting |= answer?.PointsAwarded is null;
                continue;
            }
            var result = Scoring.Evaluate(key, answer, spellingMode);
            if (answer is null)
            {
                answer = new SubmissionAnswer { SubmissionId = submissionId, QuestionId = key.Question.Id };
                add(answer);
                answers.Add(answer);
            }
            answer.PointsAwarded = result.Points;
            answer.MatchNote = result.MatchNote;
            waiting |= result.Points is null;
        }
        return waiting;
    }

    /// <summary>
    /// Scores one handed-in attempt and updates its status and grade. When <paramref name="regrade"/>
    /// is set and the score changed, records <see cref="Submission.ScoreUpdatedAt"/>. Returns whether the score changed.
    /// The caller saves.
    /// </summary>
    public static async Task<bool> ScoreAsync(LmsDbContext db, CourseworkRow cw, IReadOnlyList<ScoringKey> keys, Submission attempt, DateTime now, bool regrade, CancellationToken ct)
    {
        var answers = await db.SubmissionAnswers.Where(a => a.SubmissionId == attempt.Id).ToListAsync(ct);
        var oldTotal = answers.Sum(a => a.PointsAwarded ?? 0);
        var oldWaiting = answers.Where(a => a.PointsAwarded is null).Select(a => a.QuestionId).ToHashSet();
        var waiting = Rescore(keys, answers, cw.SpellingMode, attempt.Id, a => db.SubmissionAnswers.Add(a));
        var total = answers.Sum(a => a.PointsAwarded ?? 0);
        var grade = await db.Grades.SingleOrDefaultAsync(g => g.SubmissionId == attempt.Id, ct);
        var changed = total != oldTotal || !oldWaiting.SetEquals(answers.Where(a => a.PointsAwarded is null).Select(a => a.QuestionId));

        attempt.Status = waiting ? SubmissionStatus.Submitted : SubmissionStatus.Graded;
        if (grade is not null) grade.Points = total;
        else if (!waiting) db.Grades.Add(new Grade { SubmissionId = attempt.Id, Points = total, GradedBy = "auto", GradedAt = now });
        if (regrade && changed) attempt.ScoreUpdatedAt = now;
        return changed;
    }

    /// <summary>Re-scores every handed-in attempt of the exam (or only <paramref name="submissionIds"/>). Returns how many were re-scored and how many changed.</summary>
    public static async Task<(int Regraded, int Changed)> RegradeAsync(LmsDbContext db, CourseworkRow cw, IReadOnlyList<ScoringKey> keys, DateTime now, CancellationToken ct)
    {
        // Handed-in attempts only: never one in progress or a "not handed in" grade (no submitted time).
        var attempts = await db.Submissions.Where(s => s.CourseworkId == cw.Id && s.Status != SubmissionStatus.InProgress && s.SubmittedAt != null).ToListAsync(ct);
        var changed = 0;
        foreach (var attempt in attempts)
            if (await ScoreAsync(db, cw, keys, attempt, now, regrade: true, ct)) changed++;
        return (attempts.Count, changed);
    }
}
