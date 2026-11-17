using Lms.Api.Coursework;
using Lms.Api.Data;
using Microsoft.EntityFrameworkCore;
using CourseworkRow = Lms.Api.Data.Coursework;

namespace Lms.Api.Submissions;

/// <summary>What a student may see of an attempt (contract §4).</summary>
/// <param name="Points">pointsAwarded and matchNote.</param>
/// <param name="Keys">The correct answers.</param>
public sealed record Visibility(bool Points, bool Keys)
{
    /// <summary>
    /// Nothing before submitting. Then by answer review: score_only shows the score only; results
    /// adds points and match notes; answers_after_submit adds the keys; answers_after_due adds them
    /// once the due date has passed or the exam is closed.
    /// </summary>
    public static Visibility For(CourseworkRow cw, Submission attempt, DateTime now)
    {
        if (attempt.Status == SubmissionStatus.InProgress) return new(false, false);
        return cw.AnswerReview switch
        {
            AnswerReview.ScoreOnly => new(false, false),
            AnswerReview.AnswersAfterSubmit => new(true, true),
            AnswerReview.AnswersAfterDue => new(true, cw.Status == CourseworkStatus.Closed || (cw.DueAt is { } due && now > due)),
            _ => new(true, false),
        };
    }
}

/// <summary>The student's view of an attempt: sections, questions in their (stable) order, and answers.</summary>
public static class AttemptView
{
    public static async Task<AttemptDto> BuildAsync(LmsDbContext db, CourseworkRow cw, Submission attempt, DateTime now, CancellationToken ct)
    {
        var sections = await QuestionStore.SectionsAsync(db, cw.QuestionnaireId!.Value, ct);
        var keys = await SubmissionEndpoints.KeysAsync(db, cw.QuestionnaireId!.Value, ct);
        var answers = await db.SubmissionAnswers.AsNoTracking().Where(a => a.SubmissionId == attempt.Id).ToListAsync(ct);
        var grade = await db.Grades.AsNoTracking().SingleOrDefaultAsync(g => g.SubmissionId == attempt.Id, ct);
        var see = Visibility.For(cw, attempt, now);
        return new AttemptDto(attempt.Id, attempt.AttemptNumber, attempt.Status, attempt.StartedAt, attempt.SubmittedAt, SubmissionEndpoints.Deadline(cw, attempt),
            grade?.Points, cw.MaxPoints, grade?.Feedback,
            Ordered(cw, sections, keys, attempt.Id).Select(k => ToStudentQuestion(k, see.Keys)).ToList(),
            answers.Select(a => ToAnswerDto(keys, a, see.Points)).ToList(),
            cw.AnswerReview, cw.SpellingMode, attempt.ScoreUpdatedAt, ToSections(sections));
    }

    /// <summary>An attempt built from the questions for the instructor's preview: nothing saved, no keys, and the exam's title.</summary>
    public static async Task<AttemptDto> PreviewAsync(LmsDbContext db, CourseworkRow cw, DateTime now, CancellationToken ct)
    {
        var sections = await QuestionStore.SectionsAsync(db, cw.QuestionnaireId!.Value, ct);
        var keys = await SubmissionEndpoints.KeysAsync(db, cw.QuestionnaireId!.Value, ct);
        return new AttemptDto(0, 0, SubmissionStatus.InProgress, now, null, null, null, cw.MaxPoints, null,
            Ordered(cw, sections, keys, 0).Select(k => ToStudentQuestion(k, false)).ToList(), [],
            cw.AnswerReview, cw.SpellingMode, null, ToSections(sections), cw.Title);
    }

    public static IReadOnlyList<StudentSection> ToSections(IEnumerable<QuestionSection> sections) =>
        sections.Select(s => new StudentSection(s.Id, s.Title, s.Directions)).ToList();

    /// <summary>
    /// Questions grouped by section in section order. With shuffleQuestions each section's questions
    /// are shuffled, and with shuffleChoices multiple-choice options are, seeded by the attempt so a
    /// reload shows the same order.
    /// </summary>
    public static List<ScoringKey> Ordered(CourseworkRow cw, IReadOnlyList<QuestionSection> sections, IReadOnlyList<ScoringKey> keys, long seed)
    {
        var known = sections.Select(s => s.Id).ToHashSet();
        var result = new List<ScoringKey>();
        foreach (var section in sections)
        {
            var mine = keys.Where(k => k.Question.SectionId == section.Id || (section == sections[0] && (k.Question.SectionId is not { } id || !known.Contains(id))))
                .OrderBy(k => k.Question.SortOrder).ToList();
            result.AddRange(cw.ShuffleQuestions ? Shuffle.Stable(mine, seed, section.Id) : mine);
        }
        if (!cw.ShuffleChoices) return result;
        return result.Select(k => k.Question.Type == QuestionType.MultipleChoice ? k with { Options = Shuffle.Stable(k.Options, seed, k.Question.Id) } : k).ToList();
    }

    public static StudentQuestion ToStudentQuestion(ScoringKey k, bool withKey)
    {
        var q = k.Question;
        var key = withKey ? KeyOf(k) : null;
        var options = k.Options.Select(o => new StudentOption(o.Id, o.Text)).ToList();
        return q.Type switch
        {
            QuestionType.MultipleChoice or QuestionType.TrueFalse => new(q.Id, q.Type, q.Prompt, q.Points, q.TimeLimitSeconds, options, null, [], [], q.SectionId, null, key),
            QuestionType.ModifiedTrueFalse => new(q.Id, q.Type, q.Prompt, q.Points, q.TimeLimitSeconds, options, null, [], [], q.SectionId, q.Underlined, key),
            QuestionType.Enumeration => new(q.Id, q.Type, q.Prompt, q.Points, q.TimeLimitSeconds, [], k.Expected.Count, [], [], q.SectionId, null, key),
            QuestionType.Matching => new(q.Id, q.Type, q.Prompt, q.Points, q.TimeLimitSeconds, [], null, options,
                k.Expected.Select(e => e.AnswerText).OrderBy(t => t, StringComparer.OrdinalIgnoreCase).ToList(), q.SectionId, null, key),
            _ => new(q.Id, q.Type, q.Prompt, q.Points, q.TimeLimitSeconds, [], null, [], [], q.SectionId, null, key),
        };
    }

    /// <summary>The correct answer, with only the fields the type uses; null for essays.</summary>
    public static AnswerKeyDto? KeyOf(ScoringKey k)
    {
        var correct = k.Options.Where(o => o.IsCorrect).Select(o => o.Id).ToList();
        var answers = k.Expected.Select(e => e.AnswerText).ToList();
        bool? truth = k.Options.FirstOrDefault(o => o.IsCorrect) is { } c ? c.Text == "True" : null;
        return k.Question.Type switch
        {
            QuestionType.MultipleChoice => new(correct, null, null, null),
            QuestionType.TrueFalse => new(correct, null, null, truth),
            QuestionType.ModifiedTrueFalse => new(correct, truth == false ? answers : null, null, truth),
            QuestionType.Identification or QuestionType.Enumeration => new(null, answers, null, null),
            QuestionType.Matching => new(null, null, k.Options.Join(k.Expected, o => o.SortOrder, e => e.SortOrder, (o, e) => new KeyPair(o.Id, e.AnswerText)).ToList(), null),
            _ => null,
        };
    }

    /// <param name="showPoints">Points and the match note (students: per the answer review).</param>
    /// <param name="instructor">Adds the spelling decision and the manual points.</param>
    public static AnswerDto ToAnswerDto(IReadOnlyList<ScoringKey> keys, SubmissionAnswer a, bool showPoints, bool instructor = false)
    {
        var type = keys.FirstOrDefault(k => k.Question.Id == a.QuestionId)?.Question.Type;
        return new AnswerDto(a.QuestionId, a.SelectedOptionId,
            type is QuestionType.Essay or QuestionType.Identification or QuestionType.ModifiedTrueFalse ? a.AnswerText : null,
            type == QuestionType.Enumeration ? Scoring.ReadItems(a.AnswerText) : [],
            type == QuestionType.Matching ? Scoring.ReadMatches(a.AnswerText) : new Dictionary<long, string>(),
            showPoints ? a.PointsAwarded : null,
            showPoints ? a.MatchNote : null,
            instructor ? a.SpellingDecision : null,
            instructor ? a.ManualPoints : null);
    }
}

/// <summary>A stable shuffle: the same seed always gives the same order, on every machine and .NET version.</summary>
public static class Shuffle
{
    public static List<T> Stable<T>(IEnumerable<T> items, long seed, long salt)
    {
        var list = items.ToList();
        var state = unchecked((ulong)seed * 0x9E3779B97F4A7C15UL ^ (ulong)salt * 0xC2B2AE3D27D4EB4FUL);
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = (int)(Next(ref state) % (ulong)(i + 1));
            (list[i], list[j]) = (list[j], list[i]);
        }
        return list;
    }

    /// <summary>SplitMix64.</summary>
    private static ulong Next(ref ulong state)
    {
        var z = state += 0x9E3779B97F4A7C15UL;
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
        return z ^ (z >> 31);
    }
}
