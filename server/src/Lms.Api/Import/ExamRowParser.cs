namespace Lms.Api.Import;

/// <summary>One spreadsheet or CSV row: its 1-based row number and its cells, left to right.</summary>
internal sealed record TableRow(int Number, IReadOnlyList<string> Cells);

/// <summary>
/// Turns Excel or CSV rows into sections and draft questions. The first row names the columns:
/// <c>Section</c>, <c>Directions</c>, <c>Type</c>, <c>Question</c>, <c>Points</c>,
/// <c>Choice 1</c> … <c>Choice 10</c>, <c>Answer</c>, <c>Underlined</c>. Rows whose first filled
/// cell starts with "#" are notes. A row with a section but no question starts that section.
/// </summary>
internal static class ExamRowParser
{
    private const int MaxChoices = 10;

    public static ExamDraft Parse(IReadOnlyList<TableRow> rows, CancellationToken ct)
    {
        var exam = new ExamDraft();
        var data = rows.Where(r => !IsBlankOrNote(r)).ToList();
        if (data.Count == 0) return exam;

        var columns = Columns(data[0]);
        if (!columns.ContainsKey("question"))
        {
            exam.Warnings.Add("The first row needs the column names from the template, including “Question”.");
            return exam;
        }

        foreach (var row in data.Skip(1))
        {
            ct.ThrowIfCancellationRequested();
            string Cell(string name) => columns.TryGetValue(name, out var i) && i < row.Cells.Count ? ExamText.Clean(row.Cells[i]).Replace('\t', ' ') : "";

            var sectionCell = Cell("section");
            if (sectionCell.Length > 0 && ExamText.Section(sectionCell) is var section && (exam.Sections.Count == 0 || section.Title != exam.Sections[^1].Title))
                exam.Sections.Add(section);
            var directions = Cell("directions");
            if (directions.Length > 0 && exam.Sections.Count > 0 && exam.Sections[^1].Directions is null)
                exam.Sections[^1].Directions = directions;

            var prompt = Cell("question");
            if (prompt.Length == 0) continue;

            var question = new QuestionDraft { Section = exam.CurrentSection(), Answer = NullIfEmpty(Cell("answer")), Underlined = NullIfEmpty(Cell("underlined")) };
            question.PromptLines.Add(prompt);
            question.SourceLines.Add($"Row {row.Number}: " + string.Join(" | ", row.Cells.Select(ExamText.Clean).Where(c => c.Length > 0)));

            var typeCell = Cell("type");
            question.Type = ImportTypes.FromWords(typeCell);
            if (typeCell.Length > 0 && question.Type is null) question.Warnings.Add($"“{typeCell}” is not a question type.");

            if (ExamText.TryPoints(Cell("points"), out var points)) question.Points = points;
            else question.Warnings.Add($"Points “{Cell("points")}” is not a number.");

            var choices = Enumerable.Range(1, MaxChoices).Select(k => Cell($"choice {k}")).ToList();
            var last = choices.FindLastIndex(c => c.Length > 0);
            var filled = choices.Take(last + 1).ToList();
            var type = question.Type ?? exam.Sections[question.Section].Type;
            var asPairs = type == ImportTypes.Matching || (type is null && filled.Count > 0 && filled.All(c => c.Contains('=')));
            for (var k = 0; k < filled.Count; k++)
            {
                if (asPairs)
                {
                    if (ExamText.TrySplitPair(filled[k], out var left, out var right)) question.Pairs.Add((left, right));
                    else question.Pairs.Add((filled[k], ""));
                }
                else question.Choices.Add((((char)('a' + k)).ToString(), filled[k]));
            }

            exam.AddQuestion(question);
        }
        return exam;
    }

    /// <summary>Column names to positions, ignoring case and spacing ("Choice1" is "choice 1").</summary>
    private static Dictionary<string, int> Columns(TableRow header)
    {
        var columns = new Dictionary<string, int>();
        for (var i = 0; i < header.Cells.Count; i++)
        {
            var name = ExamText.Clean(header.Cells[i]).ToLowerInvariant().Replace(" ", "");
            if (name.StartsWith("choice", StringComparison.Ordinal) && int.TryParse(name["choice".Length..], out var k)) name = $"choice {k}";
            if (name.Length > 0) columns.TryAdd(name, i);
        }
        return columns;
    }

    private static bool IsBlankOrNote(TableRow row)
    {
        var first = row.Cells.Select(ExamText.Clean).FirstOrDefault(c => c.Length > 0);
        return first is null || first.StartsWith('#');
    }

    private static string? NullIfEmpty(string value) => value.Length > 0 ? value : null;
}
