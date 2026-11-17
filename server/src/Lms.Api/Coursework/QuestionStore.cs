using Lms.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Coursework;

/// <summary>Reading and writing a questionnaire's sections and questions.</summary>
public static class QuestionStore
{
    /// <summary>
    /// The set's sections in order. A set saved before sections existed gets one unnamed section,
    /// and any question without a section is put in the first one.
    /// </summary>
    public static async Task<List<QuestionSection>> SectionsAsync(LmsDbContext db, long questionnaireId, CancellationToken ct)
    {
        var sections = await db.QuestionSections.AsNoTracking().Where(s => s.QuestionnaireId == questionnaireId)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Id).ToListAsync(ct);
        if (sections.Count == 0)
        {
            var unnamed = new QuestionSection { QuestionnaireId = questionnaireId, Title = "", SortOrder = 1 };
            db.QuestionSections.Add(unnamed);
            await db.SaveChangesAsync(ct);
            db.Entry(unnamed).State = EntityState.Detached;
            sections.Add(unnamed);
        }
        var first = sections[0].Id;
        var loose = db.Questions.Where(q => q.QuestionnaireId == questionnaireId && q.SectionId == null);
        if (await loose.AnyAsync(ct)) await loose.ExecuteUpdateAsync(s => s.SetProperty(q => q.SectionId, first), ct);
        return sections;
    }

    /// <summary>Adds the sections and questions of a PUT. Questions failing only content rules are saved as sent, marked incomplete.</summary>
    public static async Task AddAsync(LmsDbContext db, long questionnaireId, IReadOnlyList<SectionInput> sections, IReadOnlyList<QuestionInput> questions, CancellationToken ct)
    {
        var rows = sections.Select((s, i) => new QuestionSection
        {
            QuestionnaireId = questionnaireId, Title = s.Title?.Trim() ?? "", SortOrder = i + 1,
            Directions = string.IsNullOrWhiteSpace(s.Directions) ? null : s.Directions.Trim(), DefaultPoints = s.DefaultPoints,
        }).ToList();
        db.QuestionSections.AddRange(rows);
        await db.SaveChangesAsync(ct);

        for (var i = 0; i < questions.Count; i++)
        {
            var q = questions[i];
            var problems = QuestionRules.Problems(q);
            var question = new Question
            {
                QuestionnaireId = questionnaireId, SectionId = rows[q.Section ?? 0].Id, Type = q.Type!, Prompt = q.Prompt?.Trim() ?? "",
                Points = Math.Clamp(q.Points ?? 0, 0, 1000), SortOrder = i + 1, TimeLimitSeconds = q.TimeLimitSeconds is > 0 ? q.TimeLimitSeconds : null,
                Underlined = q.Type == QuestionType.ModifiedTrueFalse && !string.IsNullOrWhiteSpace(q.Underlined) ? q.Underlined.Trim() : null,
                AlwaysStrict = q.AlwaysStrict ?? false, CaseSensitive = q.CaseSensitive ?? false,
                Incomplete = problems.Count > 0, Problems = problems.Count > 0 ? string.Join('\n', problems.Select(p => p.Message)) : null,
            };
            db.Questions.Add(question);
            await db.SaveChangesAsync(ct);
            AddParts(db, question.Id, q);
        }
        await db.SaveChangesAsync(ct);
    }

    private static void AddParts(LmsDbContext db, long questionId, QuestionInput q)
    {
        switch (q.Type)
        {
            case QuestionType.MultipleChoice:
                var options = q.Options ?? [];
                for (var k = 0; k < options.Count; k++)
                    db.QuestionOptions.Add(new QuestionOption { QuestionId = questionId, Text = options[k].Text?.Trim() ?? "", IsCorrect = options[k].IsCorrect, SortOrder = k + 1 });
                break;
            case QuestionType.TrueFalse:
            case QuestionType.ModifiedTrueFalse:
                db.QuestionOptions.Add(new QuestionOption { QuestionId = questionId, Text = "True", IsCorrect = q.CorrectAnswer == true, SortOrder = 1 });
                db.QuestionOptions.Add(new QuestionOption { QuestionId = questionId, Text = "False", IsCorrect = q.CorrectAnswer == false, SortOrder = 2 });
                if (q.Type == QuestionType.ModifiedTrueFalse) AddAnswers(db, questionId, q.ExpectedAnswers);
                break;
            case QuestionType.Enumeration:
            case QuestionType.Identification:
                AddAnswers(db, questionId, q.ExpectedAnswers);
                break;
            case QuestionType.Matching:
                // A pair is the option (left) and the expected answer (right) with the same sort order.
                var pairs = q.Pairs ?? [];
                for (var k = 0; k < pairs.Count; k++)
                {
                    db.QuestionOptions.Add(new QuestionOption { QuestionId = questionId, Text = pairs[k].Left?.Trim() ?? "", SortOrder = k + 1 });
                    db.QuestionExpectedAnswers.Add(new QuestionExpectedAnswer { QuestionId = questionId, AnswerText = pairs[k].Right?.Trim() ?? "", SortOrder = k + 1 });
                }
                break;
        }
    }

    /// <summary>Accepted answers, trimmed; blank ones are left out.</summary>
    public static void AddAnswers(LmsDbContext db, long questionId, IEnumerable<string?>? answers)
    {
        var k = 0;
        foreach (var answer in (answers ?? []).Where(a => !string.IsNullOrWhiteSpace(a)))
            db.QuestionExpectedAnswers.Add(new QuestionExpectedAnswer { QuestionId = questionId, AnswerText = answer!.Trim(), SortOrder = ++k });
    }

    /// <summary>Copies sections, questions, choices and accepted answers into another set.</summary>
    public static async Task CopyAsync(LmsDbContext db, long fromId, long toId, CancellationToken ct)
    {
        var sections = await SectionsAsync(db, fromId, ct);
        var sectionIds = new Dictionary<long, long>();
        foreach (var s in sections)
        {
            var copy = new QuestionSection { QuestionnaireId = toId, Title = s.Title, Directions = s.Directions, DefaultPoints = s.DefaultPoints, SortOrder = s.SortOrder };
            db.QuestionSections.Add(copy);
            await db.SaveChangesAsync(ct);
            sectionIds[s.Id] = copy.Id;
        }

        var questions = await db.Questions.AsNoTracking().Where(q => q.QuestionnaireId == fromId).OrderBy(q => q.SortOrder).ToListAsync(ct);
        var ids = questions.Select(q => q.Id).ToList();
        var options = await db.QuestionOptions.AsNoTracking().Where(o => ids.Contains(o.QuestionId)).ToListAsync(ct);
        var answers = await db.QuestionExpectedAnswers.AsNoTracking().Where(a => ids.Contains(a.QuestionId)).ToListAsync(ct);
        foreach (var q in questions)
        {
            var question = new Question
            {
                QuestionnaireId = toId, SectionId = q.SectionId is { } sid ? sectionIds.GetValueOrDefault(sid, sectionIds[sections[0].Id]) : sectionIds[sections[0].Id],
                Type = q.Type, Prompt = q.Prompt, Points = q.Points, SortOrder = q.SortOrder, TimeLimitSeconds = q.TimeLimitSeconds,
                Underlined = q.Underlined, AlwaysStrict = q.AlwaysStrict, CaseSensitive = q.CaseSensitive, Incomplete = q.Incomplete, Problems = q.Problems,
            };
            db.Questions.Add(question);
            await db.SaveChangesAsync(ct);
            foreach (var o in options.Where(o => o.QuestionId == q.Id))
                db.QuestionOptions.Add(new QuestionOption { QuestionId = question.Id, Text = o.Text, IsCorrect = o.IsCorrect, SortOrder = o.SortOrder });
            foreach (var a in answers.Where(a => a.QuestionId == q.Id))
                db.QuestionExpectedAnswers.Add(new QuestionExpectedAnswer { QuestionId = question.Id, AnswerText = a.AnswerText, SortOrder = a.SortOrder });
        }
        await db.SaveChangesAsync(ct);
    }

    /// <summary>The owner's view of one question, with its answers.</summary>
    public static QuestionDto ToDto(Question q, IReadOnlyList<QuestionOption> opts, IReadOnlyList<QuestionExpectedAnswer> exp)
    {
        IReadOnlyList<string> problems = q.Incomplete && q.Problems is { } p ? p.Split('\n', StringSplitOptions.RemoveEmptyEntries) : [];
        return q.Type == QuestionType.Matching
            ? new QuestionDto(q.Id, q.Type, q.Prompt, q.Points, q.SortOrder, q.TimeLimitSeconds, q.SectionId, q.Underlined, q.AlwaysStrict, q.CaseSensitive, q.Incomplete, problems, [], [],
                opts.Join(exp, o => o.SortOrder, a => a.SortOrder, (o, a) => new PairDto(o.Text, a.AnswerText)).ToList())
            : new QuestionDto(q.Id, q.Type, q.Prompt, q.Points, q.SortOrder, q.TimeLimitSeconds, q.SectionId, q.Underlined, q.AlwaysStrict, q.CaseSensitive, q.Incomplete, problems,
                opts.Select(o => new OptionDto(o.Id, o.Text, o.IsCorrect)).ToList(), exp.Select(a => a.AnswerText).ToList(), []);
    }
}
