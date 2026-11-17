using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace Lms.Api.Import;

/// <summary>
/// Reads a Word document as lines of plain text for <see cref="ExamTextParser"/>. Underlined
/// text becomes [bracketed] text (an underlined blank becomes "_____"), Word's automatic list
/// numbers are written out ("1. ", "a. "), and a line break inside a paragraph starts a new line.
/// Only text is read: no fields, links, images, or embedded objects.
/// </summary>
internal static class DocxReader
{
    public static List<string> ReadLines(byte[] bytes, CancellationToken ct)
    {
        using var doc = WordprocessingDocument.Open(new MemoryStream(bytes, writable: false), false,
            new OpenSettings { AutoSave = false, MaxCharactersInPart = ImportLimits.MaxUnpackedBytes });
        var main = doc.MainDocumentPart ?? throw new ImportRefusedException(ImportRefusedException.Unreadable);
        var body = main.Document?.Body ?? throw new ImportRefusedException(ImportRefusedException.Unreadable);
        var numbers = new ListNumbers(main.NumberingDefinitionsPart?.Numbering);

        var lines = new List<string>();
        foreach (var paragraph in body.Descendants<Paragraph>())
        {
            ct.ThrowIfCancellationRequested();
            var parts = ParagraphText(paragraph).Split('\n');
            if (parts[0].Trim().Length > 0) parts[0] = numbers.Next(paragraph) + parts[0];
            lines.AddRange(parts);
            if (lines.Count > ImportLimits.MaxLines) throw new ImportRefusedException(ImportRefusedException.Unreadable);
        }
        return lines;
    }

    /// <summary>The paragraph's own text (a text box inside it is its own paragraph), underline as [brackets].</summary>
    private static string ParagraphText(Paragraph paragraph)
    {
        var text = new StringBuilder();
        var underlined = new StringBuilder();

        void Flush()
        {
            if (underlined.Length == 0) return;
            var phrase = underlined.ToString();
            var trimmed = phrase.Trim();
            if (trimmed.Length == 0 || trimmed.All(c => c == '_')) text.Append("_____");
            else text.Append(phrase[..(phrase.Length - phrase.TrimStart().Length)]).Append('[').Append(trimmed).Append(']').Append(phrase[phrase.TrimEnd().Length..]);
            underlined.Clear();
        }

        foreach (var run in paragraph.Descendants<Run>())
        {
            if (run.Ancestors<Paragraph>().First() != paragraph) continue;
            var target = IsUnderlined(run) ? underlined : null;
            if (target is null) Flush();
            foreach (var child in run.ChildElements)
            {
                var piece = child switch
                {
                    Text t => t.Text,
                    TabChar => "\t",
                    Break or CarriageReturn => "\n",
                    NoBreakHyphen => "-",
                    _ => "",
                };
                (target ?? text).Append(piece);
            }
        }
        Flush();
        return text.ToString();
    }

    private static bool IsUnderlined(Run run) =>
        run.RunProperties?.Underline is { } u && (u.Val is null || u.Val.Value != UnderlineValues.None);

    /// <summary>
    /// Word's automatic numbering, written out as text. A counter per list and level; a level
    /// restarts when a higher level moves on. Decimal and letter lists only; bullets become "- ".
    /// </summary>
    private sealed class ListNumbers(Numbering? numbering)
    {
        private readonly Dictionary<int, int[]> _counters = [];

        public string Next(Paragraph paragraph)
        {
            var props = paragraph.ParagraphProperties?.NumberingProperties;
            if (numbering is null || props?.NumberingId?.Val?.Value is not int numId || numId == 0) return "";
            var level = Math.Clamp(props.NumberingLevelReference?.Val?.Value ?? 0, 0, 8);

            var abstractId = numbering.Elements<NumberingInstance>().FirstOrDefault(n => n.NumberID?.Value == numId)?.AbstractNumId?.Val?.Value;
            var definition = numbering.Elements<AbstractNum>().FirstOrDefault(a => a.AbstractNumberId?.Value == abstractId)?
                .Elements<Level>().FirstOrDefault(l => l.LevelIndex?.Value == level);
            if (definition is null) return "";

            if (!_counters.TryGetValue(numId, out var counters)) _counters[numId] = counters = new int[9];
            counters[level] = counters[level] == 0 ? definition.StartNumberingValue?.Val?.Value ?? 1 : counters[level] + 1;
            for (var deeper = level + 1; deeper < counters.Length; deeper++) counters[deeper] = 0;

            var n = counters[level];
            var format = definition.NumberingFormat?.Val?.Value;
            if (format == NumberFormatValues.Decimal) return $"{n}. ";
            if (format == NumberFormatValues.LowerLetter) return $"{Letter(n)}. ";
            if (format == NumberFormatValues.UpperLetter) return $"{char.ToUpperInvariant(Letter(n))}. ";
            if (format == NumberFormatValues.Bullet) return "- ";
            return "";
        }

        private static char Letter(int n) => (char)('a' + (Math.Max(n, 1) - 1) % 26);
    }
}
