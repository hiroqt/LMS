using System.Globalization;
using System.Text;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using W = DocumentFormat.OpenXml.Wordprocessing;
using X = DocumentFormat.OpenXml.Spreadsheet;

namespace Lms.Api.Import;

/// <summary>
/// Sample files for <c>GET /api/questionnaires/import/template</c>: one question of every type
/// and the rules, built in code so no binary is kept in the repository. Each imports cleanly.
/// </summary>
internal static class ImportTemplates
{
    private sealed record Sample(string Section, string PointsNote, string Directions, string Type, string Prompt, decimal Points,
        string[] Choices, string? Answer, string? Underlined = null);

    private static readonly Sample[] Samples =
    [
        new("Test I. Multiple choice", "(1 point each)", "Choose the best answer.", "Multiple choice",
            "Which keyword declares a constant in C#?", 1, ["var", "const", "let", "static"], "b"),
        new("Test II. True or false", "(1 point each)", "Write True if the statement is correct and False if it is not.", "True or false",
            "HTML is a programming language.", 1, [], "False"),
        new("Test III. Modified true or false", "(2 points each)", "Write True if the statement is correct. If it is not, write False and the word that makes it correct.", "Modified true or false",
            "The CPU stores data permanently.", 2, [], "False – storage / hard disk", "CPU"),
        new("Test IV. Identification", "(1 point each)", "Write the word or name being described.", "Identification",
            "The father of computers.", 1, [], "Charles Babbage / Babbage"),
        new("Test V. Enumeration", "(3 points)", "List what is asked.", "Enumeration",
            "Give the three primary colors of light.", 3, [], "red; green; blue"),
        new("Test VI. Matching", "(4 points)", "Match each item on the left to its use on the right.", "Matching",
            "Match the device to its use.", 4, ["Keyboard = input", "Monitor = output"], null),
        new("Test VII. Essay", "(10 points)", "Answer in one paragraph.", "Essay",
            "Explain why backups matter.", 10, [], null),
    ];

    private static readonly string[] DocumentRules =
    [
        "How to write an exam for import. You may delete these notes: lines before the first test are not read as questions.",
        "Start each test with a heading such as “Test I. Multiple choice (1 point each)”. Its words give the question type, and “(N points each)” or “(N points)” gives the points.",
        "Question types: multiple choice, true or false, modified true or false, identification, enumeration, matching, essay.",
        "Number each question “1.” or “1)”, and put each choice on its own line as “a.”, “a)”, “A.”, or “(a)”.",
        "Give the key under each question as “Answer: b” (a letter or the choice's text), or list the keys at the end under the heading “Answer key”, one “1. b” per line.",
        "Separate accepted answers with “/” (Charles Babbage / Babbage), and enumeration items with “;”.",
        "For modified true or false, underline the word or phrase that may be wrong (or put it in [brackets]). When the statement is false, write the correct word after False: “Answer: False – storage”.",
        "For matching, write each pair on its own line as “- left = right”. Essays need no key.",
    ];

    private static readonly string[] TableRules =
    [
        "One question per row. Rows whose first cell starts with # are notes and are not imported.",
        "Section: the test's heading, such as “Test I. Multiple choice”. Directions: the test's directions (the first row of a test is enough).",
        "Type: multiple choice, true or false, modified true or false, identification, enumeration, matching, or essay. Points: a number.",
        "Choice 1 to Choice 10: the choices of a multiple choice question. For matching, one pair per cell as “left = right”.",
        "Answer: a choice letter (b) or the choice's text; True or False; for modified true or false, “False – correction”; accepted answers separated by “/”; enumeration items separated by “;”. Essays need no answer.",
        "Underlined: for modified true or false, the word or phrase in the question that may be wrong.",
    ];

    private static readonly string[] Columns =
        ["Section", "Directions", "Type", "Question", "Points", .. Enumerable.Range(1, 10).Select(k => $"Choice {k}"), "Answer", "Underlined"];

    public static byte[] Docx()
    {
        using var stream = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(stream, WordprocessingDocumentType.Document))
        {
            var body = new W.Body();
            body.Append(Paragraph(new W.Run(new W.RunProperties(new W.Bold()), WordText("Midterm Examination"))));
            foreach (var rule in DocumentRules) body.Append(Paragraph(new W.Run(new W.RunProperties(new W.Italic()), WordText(rule))));

            for (var i = 0; i < Samples.Length; i++)
            {
                var s = Samples[i];
                body.Append(Paragraph(new W.Run(new W.RunProperties(new W.Bold()), WordText($"{s.Section} {s.PointsNote}"))));
                body.Append(Line($"Directions: {s.Directions}"));
                body.Append(PromptParagraph($"{i + 1}. ", s.Prompt, s.Underlined));
                foreach (var (choice, k) in s.Choices.Select((c, k) => (c, k)))
                    body.Append(Line(s.Type == "Matching" ? $"- {choice}" : $"{(char)('a' + k)}. {choice}"));
                if (s.Answer is not null) body.Append(Line($"Answer: {s.Answer}"));
            }
            doc.AddMainDocumentPart().Document = new W.Document(body);
        }
        return stream.ToArray();
    }

    /// <summary>The prompt, with the underlined phrase in a real Word underline.</summary>
    private static W.Paragraph PromptParagraph(string number, string prompt, string? underlined)
    {
        var at = underlined is null ? -1 : prompt.IndexOf(underlined, StringComparison.Ordinal);
        if (at < 0) return Line(number + prompt);
        return Paragraph(
            new W.Run(WordText(number + prompt[..at])),
            new W.Run(new W.RunProperties(new W.Underline { Val = W.UnderlineValues.Single }), WordText(underlined!)),
            new W.Run(WordText(prompt[(at + underlined!.Length)..])));
    }

    private static W.Paragraph Line(string text) => Paragraph(new W.Run(WordText(text)));
    private static W.Paragraph Paragraph(params OpenXmlElement[] runs) => new(runs);
    private static W.Text WordText(string text) => new(text) { Space = SpaceProcessingModeValues.Preserve };

    public static byte[] Xlsx()
    {
        using var stream = new MemoryStream();
        using (var doc = SpreadsheetDocument.Create(stream, SpreadsheetDocumentType.Workbook))
        {
            var workbook = doc.AddWorkbookPart();
            workbook.Workbook = new X.Workbook(new X.Sheets());
            AddSheet(workbook, 1, "Questions", Rows());
            AddSheet(workbook, 2, "Rules", TableRules.Prepend("Only the first sheet is imported.").Select(r => new object[] { r }));
        }
        return stream.ToArray();
    }

    private static void AddSheet(WorkbookPart workbook, uint id, string name, IEnumerable<object[]> rows)
    {
        var data = new X.SheetData();
        uint r = 0;
        foreach (var row in rows)
        {
            r++;
            var cells = row.Select((value, c) => (Value: value, Reference: $"{(char)('A' + c)}{r}"))
                .Where(x => x.Value is not "")
                .Select(x => x.Value is decimal n
                    ? new X.Cell { CellReference = x.Reference, CellValue = new X.CellValue(n) }
                    : new X.Cell { CellReference = x.Reference, DataType = X.CellValues.InlineString, InlineString = new X.InlineString(new X.Text(x.Value.ToString()!)) });
            data.Append(new X.Row(cells) { RowIndex = r });
        }
        var sheet = workbook.AddNewPart<WorksheetPart>();
        sheet.Worksheet = new X.Worksheet(data);
        workbook.Workbook!.Sheets!.Append(new X.Sheet { Id = workbook.GetIdOfPart(sheet), SheetId = id, Name = name });
    }

    public static byte[] Csv()
    {
        var csv = new StringBuilder();
        foreach (var rule in TableRules) csv.Append(CsvLine(["# " + rule]));
        foreach (var row in Rows()) csv.Append(CsvLine(row));
        // A byte order mark, so Excel opens the dashes and accents as UTF-8.
        return [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(csv.ToString())];
    }

    /// <summary>The header row and one row per sample question; blank cells are empty strings.</summary>
    private static IEnumerable<object[]> Rows()
    {
        yield return Columns;
        foreach (var s in Samples)
        {
            var choices = Enumerable.Range(0, 10).Select(k => k < s.Choices.Length ? s.Choices[k] : "");
            yield return [s.Section, s.Directions, s.Type, s.Prompt, s.Points, .. choices, s.Answer ?? "", s.Underlined ?? ""];
        }
    }

    private static string CsvLine(IEnumerable<object> cells) =>
        string.Join(',', cells.Select(c => Quote(Convert.ToString(c, CultureInfo.InvariantCulture) ?? ""))) + "\r\n";

    private static string Quote(string value) =>
        value.IndexOfAny([',', '"', '\r', '\n']) >= 0 ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
}
