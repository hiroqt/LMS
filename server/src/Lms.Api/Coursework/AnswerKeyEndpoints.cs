using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Identity;
using Lms.Api.Submissions;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Coursework;

/// <summary>A corrected key for one question; send only the field its type uses.</summary>
public sealed record AnswerKeyItem(long QuestionId, long? CorrectOptionId, bool? CorrectAnswer, IReadOnlyList<string?>? ExpectedAnswers, IReadOnlyList<PairInput>? Pairs);
public sealed record AnswerKeyInput(IReadOnlyList<AnswerKeyItem>? Questions);
public sealed record AnswerKeyResult(QuestionnaireDto Questionnaire, int Regraded, int Changed);

/// <summary>
/// Fixing a wrong answer key (D-042): a narrow exception to locking. It works on a locked set too,
/// but changes only keys (never prompts, choices' text, left items, types, points or order), then
/// re-scores every handed-in attempt of every exam that uses the set, with one audit row.
/// </summary>
public static class AnswerKeyEndpoints
{
    public static IEndpointRouteBuilder MapAnswerKeyEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGroup("/api/questionnaires").RequireDemoUser().MapPut("/{id:long}/answer-key", async Task<IResult> (long id, AnswerKeyInput input, HttpContext http, LmsDbContext db, TimeProvider time, CancellationToken ct) =>
        {
            var user = http.CurrentUser();
            var (set, denied) = await QuestionnaireEndpoints.OwnedAsync(db, id, user, ct);
            if (denied is not null) return denied;

            var items = input.Questions ?? [];
            var questions = await db.Questions.Where(q => q.QuestionnaireId == id).ToDictionaryAsync(q => q.Id, ct);
            var ids = questions.Keys.ToList();
            var options = await db.QuestionOptions.Where(o => ids.Contains(o.QuestionId)).OrderBy(o => o.SortOrder).ToListAsync(ct);
            var expected = await db.QuestionExpectedAnswers.Where(e => ids.Contains(e.QuestionId)).OrderBy(e => e.SortOrder).ToListAsync(ct);

            var errors = new Errors();
            if (items.Count == 0) errors.Add("questions", "Name at least one question to fix.");
            if (items.GroupBy(i => i.QuestionId).Any(g => g.Count() > 1)) errors.Add("questions", "Name each question once.");
            for (var i = 0; i < items.Count; i++)
            {
                if (!questions.TryGetValue(items[i].QuestionId, out var q)) { errors.Add($"questions[{i}].questionId", "This question is not part of the set."); continue; }
                Check(errors, $"questions[{i}]", q, items[i], options.Where(o => o.QuestionId == q.Id).ToList(), expected.Where(e => e.QuestionId == q.Id).ToList());
            }
            if (errors.Any) return errors.Result();

            db.Actor = user.Id;
            var now = time.GetUtcNow().UtcDateTime;
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            foreach (var item in items)
            {
                var q = questions[item.QuestionId];
                Apply(db, q, item, options.Where(o => o.QuestionId == q.Id).ToList(), expected.Where(e => e.QuestionId == q.Id).ToList());
            }
            await db.SaveChangesAsync(ct);

            // A fixed key can complete a question, so its problems are checked again.
            foreach (var item in items)
            {
                var q = questions[item.QuestionId];
                var problems = QuestionRules.Problems(QuestionRules.ToInput(q,
                    await db.QuestionOptions.AsNoTracking().Where(o => o.QuestionId == q.Id).OrderBy(o => o.SortOrder).ToListAsync(ct),
                    await db.QuestionExpectedAnswers.AsNoTracking().Where(e => e.QuestionId == q.Id).OrderBy(e => e.SortOrder).ToListAsync(ct)));
                q.Incomplete = problems.Count > 0;
                q.Problems = problems.Count > 0 ? string.Join('\n', problems.Select(p => p.Message)) : null;
            }
            await db.SaveChangesAsync(ct);

            var keys = await SubmissionEndpoints.KeysAsync(db, id, ct);
            int regraded = 0, changed = 0;
            foreach (var exam in await db.Coursework.Where(c => c.QuestionnaireId == id).ToListAsync(ct))
            {
                var result = await AttemptGrading.RegradeAsync(db, exam, keys, now, ct);
                regraded += result.Regraded;
                changed += result.Changed;
            }
            db.AuditLog.Add(new AuditLogEntry
            {
                ActorId = user.Id, ActorRole = user.Role, Category = "grading", Action = "key_fixed", Target = "Answer key",
                TargetId = id.ToString(System.Globalization.CultureInfo.InvariantCulture),
                Summary = $"Answer key fixed for {items.Count} questions; {regraded} attempts re-scored, {changed} changed",
            });
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return TypedResults.Ok(new AnswerKeyResult(await QuestionnaireEndpoints.LoadAsync(db, set!, ct), regraded, changed));
        }).WithName("FixAnswerKey");
        return app;
    }

    private static void Check(Errors errors, string at, Question q, AnswerKeyItem item, List<QuestionOption> options, List<QuestionExpectedAnswer> expected)
    {
        var answers = item.ExpectedAnswers;
        void Unused(string field, object? value) { if (value is not null) errors.Add($"{at}.{field}", $"A {q.Type.Replace('_', ' ')} question has no {field} to fix."); }
        switch (q.Type)
        {
            case QuestionType.MultipleChoice:
                Unused("correctAnswer", item.CorrectAnswer); Unused("expectedAnswers", answers); Unused("pairs", item.Pairs);
                if (item.CorrectOptionId is not { } option || options.All(o => o.Id != option)) errors.Add($"{at}.correctOptionId", "Choose one of this question's choices.");
                break;
            case QuestionType.TrueFalse:
                Unused("correctOptionId", item.CorrectOptionId); Unused("expectedAnswers", answers); Unused("pairs", item.Pairs);
                if (item.CorrectAnswer is null) errors.Add($"{at}.correctAnswer", "Say whether the statement is true or false.");
                break;
            case QuestionType.Identification:
            case QuestionType.Enumeration:
                Unused("correctOptionId", item.CorrectOptionId); Unused("correctAnswer", item.CorrectAnswer); Unused("pairs", item.Pairs);
                var max = QuestionRules.MaxAnswers(q.Type);
                if (answers is null || answers.Count < 1 || answers.Count > max || answers.Any(a => string.IsNullOrWhiteSpace(a) || a.Trim().Length > QuestionRules.OptionMax))
                    errors.Add($"{at}.expectedAnswers", $"Give 1 to {max} accepted answers, none blank.");
                break;
            case QuestionType.ModifiedTrueFalse:
                Unused("correctOptionId", item.CorrectOptionId); Unused("pairs", item.Pairs);
                if (item.CorrectAnswer is null && answers is null) errors.Add($"{at}.correctAnswer", "Send whether the statement is true or false, or its accepted corrections.");
                if (answers is not null && (answers.Count > 10 || answers.Any(a => string.IsNullOrWhiteSpace(a) || a.Trim().Length > QuestionRules.OptionMax)))
                    errors.Add($"{at}.expectedAnswers", "Give 1 to 10 accepted corrections, none blank.");
                else
                {
                    var isFalse = item.CorrectAnswer is { } truth ? !truth : options.Any(o => o.IsCorrect && o.Text == "False");
                    if (isFalse && (answers?.Count ?? expected.Count) == 0)
                        errors.Add($"{at}.expectedAnswers", "A false statement needs 1 to 10 accepted corrections.");
                }
                break;
            case QuestionType.Matching:
                Unused("correctOptionId", item.CorrectOptionId); Unused("correctAnswer", item.CorrectAnswer); Unused("expectedAnswers", answers);
                var pairs = item.Pairs ?? [];
                if (pairs.Count != options.Count || pairs.Where((p, k) => p.Left?.Trim() != options[k].Text).Any())
                    errors.Add($"{at}.pairs", "Keep the left items as they are, in the same order; only the right-hand answers can change.");
                else if (pairs.Any(p => string.IsNullOrWhiteSpace(p.Right) || p.Right.Trim().Length > QuestionRules.OptionMax))
                    errors.Add($"{at}.pairs", "Fill in every right-hand answer.");
                break;
            default:
                errors.Add($"{at}.questionId", "Essays have no answer key.");
                break;
        }
    }

    private static void Apply(LmsDbContext db, Question q, AnswerKeyItem item, List<QuestionOption> options, List<QuestionExpectedAnswer> expected)
    {
        switch (q.Type)
        {
            case QuestionType.MultipleChoice:
                foreach (var o in options) o.IsCorrect = o.Id == item.CorrectOptionId;
                break;
            case QuestionType.TrueFalse:
            case QuestionType.ModifiedTrueFalse:
                if (item.CorrectAnswer is { } truth)
                    foreach (var o in options) o.IsCorrect = o.Text == (truth ? "True" : "False");
                if (q.Type == QuestionType.ModifiedTrueFalse && item.ExpectedAnswers is not null) Replace(db, q.Id, expected, item.ExpectedAnswers);
                break;
            case QuestionType.Identification:
            case QuestionType.Enumeration:
                Replace(db, q.Id, expected, item.ExpectedAnswers!);
                break;
            case QuestionType.Matching:
                for (var k = 0; k < options.Count; k++)
                {
                    var right = expected.FirstOrDefault(e => e.SortOrder == options[k].SortOrder);
                    if (right is not null) right.AnswerText = item.Pairs![k].Right!.Trim();
                }
                break;
        }
    }

    private static void Replace(LmsDbContext db, long questionId, List<QuestionExpectedAnswer> expected, IReadOnlyList<string?> answers)
    {
        db.QuestionExpectedAnswers.RemoveRange(expected);
        QuestionStore.AddAnswers(db, questionId, answers);
    }
}
