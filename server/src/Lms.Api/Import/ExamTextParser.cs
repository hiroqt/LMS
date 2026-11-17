namespace Lms.Api.Import;

/// <summary>
/// Turns lines (from pasted text, a .txt file, or a Word document) into sections and draft
/// questions, following the format in the contract:
/// <code>
/// Midterm Examination
/// Test I. Multiple choice (1 point each)
/// Directions: Choose the best answer.
/// 1. Which keyword declares a constant in C#?
/// a. var
/// b. const
/// Answer: b
/// …
/// Answer key
/// 1. b
/// </code>
/// It only reads structure; <see cref="ExamBuilder"/> works out types, answers, and warnings.
/// </summary>
internal static class ExamTextParser
{
    public static ExamDraft Parse(IEnumerable<string> lines, CancellationToken ct)
    {
        var exam = new ExamDraft();
        var key = new List<(int Number, string Answer)>();
        QuestionDraft? question = null;
        var inKey = false;
        var firstLine = true;

        foreach (var raw in lines)
        {
            ct.ThrowIfCancellationRequested();
            var line = ExamText.Clean(raw);
            if (line.Length == 0) continue;
            var isFirst = firstLine;
            firstLine = false;

            // Everything after an "Answer key" heading is "N. answer".
            if (inKey)
            {
                if (ExamText.TryNumbered(line, out var n, out var answer)) key.Add((n, answer));
                continue;
            }
            if (ExamText.IsAnswerKeyHeading(line))
            {
                inKey = true;
                question = null;
                continue;
            }

            if (ExamText.TrySection(line) is { } section)
            {
                exam.Sections.Add(section);
                question = null;
                continue;
            }

            if (ExamText.TryNumbered(line, out var number, out var prompt))
            {
                question = StartQuestion(exam, number, prompt, line);
                continue;
            }

            if (question is null)
            {
                if (isFirst) exam.Title = line.Replace('\t', ' ');
                else if (ExamText.TryDirections(line, out var directions) && exam.Sections.Count > 0)
                    exam.Sections[^1].Directions = directions;
                // Other lines outside a question (instructions, "Name: ____") are not questions.
                continue;
            }

            question.SourceLines.Add(line);
            ReadQuestionLine(question, line);
        }

        ApplyKey(exam, key);
        return exam;
    }

    private static QuestionDraft StartQuestion(ExamDraft exam, int number, string prompt, string line)
    {
        var (text, points, _) = ExamText.SplitPoints(prompt);
        var question = new QuestionDraft { Number = number, Section = exam.CurrentSection(), Points = points };
        if (text.Length > 0) question.PromptLines.Add(text);
        question.SourceLines.Add(line);
        exam.AddQuestion(question);
        return question;
    }

    private static void ReadQuestionLine(QuestionDraft question, string line)
    {
        if (ExamText.TryAnswer(line, out var answer))
        {
            question.Answer = answer.Length > 0 ? answer : null;
        }
        else if (ExamText.TryChoice(line, out var letter, out var rest))
        {
            question.Choices.AddRange(ExamText.Choices(letter, rest));
        }
        else if (ExamText.TryPair(line, out var left, out var right))
        {
            question.Pairs.Add((left, right));
        }
        else if (question.Choices.Count == 0 && question.Pairs.Count == 0 && question.Answer is null)
        {
            question.PromptLines.Add(line.Replace('\t', ' '));
        }
        else
        {
            question.Warnings.Add($"Check this line: “{line}”.");
        }
    }

    /// <summary>
    /// Fills answers from an "Answer key" at the end. Each "N. answer" goes to the next question
    /// numbered N that has no answer yet, so a key that restarts its numbering per test still lines up.
    /// An answer written under the question wins over the key.
    /// </summary>
    private static void ApplyKey(ExamDraft exam, List<(int Number, string Answer)> key)
    {
        var used = new HashSet<QuestionDraft>();
        foreach (var (number, answer) in key)
        {
            var target = exam.Questions.FirstOrDefault(q => q.Number == number && !used.Contains(q));
            if (target is null)
            {
                exam.Warnings.Add($"The answer key has an answer for {number}, but there is no question {number}.");
                continue;
            }
            used.Add(target);
            if (target.Answer is null && answer.Length > 0) target.Answer = answer;
        }
    }
}
