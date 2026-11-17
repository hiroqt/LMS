using System.Globalization;
using System.Text;

namespace Lms.Api.Import;

/// <summary>
/// How one line of an exam reads: a numbered question, a choice, a pair, an answer, a section
/// heading. Each check is a small hand-written test, so the rules stay readable. Shared by the
/// text parser (Word and plain text) and the row parser (Excel and CSV cells).
/// </summary>
internal static class ExamText
{
    private static readonly string[] SectionWords = ["test", "part", "section"];
    private static readonly string[] Romans =
        ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];
    private static readonly HashSet<string> BareTypeHeadings =
    [
        "multiple choice", "true or false", "true false", "modified true or false", "modified true false",
        "identification", "enumeration", "matching", "matching type", "essay",
    ];

    /// <summary>Plain text only: control characters dropped (tabs and line breaks kept), non-breaking spaces made plain, trimmed.</summary>
    public static string Clean(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        var text = new StringBuilder(value.Length);
        foreach (var c in value)
        {
            if (c is '\t' or '\n') text.Append(c);
            else if (c == '\u00A0') text.Append(' ');
            else if (char.IsControl(c) || c is '\u200B' or '\uFEFF') continue;
            else text.Append(c);
        }
        return text.ToString().Trim();
    }

    /// <summary>Splits pasted or decoded text into lines (CRLF, LF, CR, or Word's vertical tab).</summary>
    public static List<string> Lines(string text)
    {
        var lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Replace('\v', '\n').Split('\n').ToList();
        if (lines.Count > ImportLimits.MaxLines)
            throw new ImportRefusedException("This file has more than 20,000 lines.");
        return lines;
    }

    /// <summary>"12. Prompt" or "12) Prompt".</summary>
    public static bool TryNumbered(string line, out int number, out string rest)
    {
        number = 0;
        rest = "";
        var digits = 0;
        while (digits < line.Length && char.IsAsciiDigit(line[digits])) digits++;
        if (digits is 0 or > 4 || digits >= line.Length || line[digits] is not ('.' or ')')) return false;
        var after = digits + 1;
        if (after < line.Length && !char.IsWhiteSpace(line[after])) return false; // "3.14 is pi" is not question 3
        number = int.Parse(line[..digits], CultureInfo.InvariantCulture);
        rest = line[after..].Trim();
        return true;
    }

    /// <summary>"a. text", "a) text", "A. text", or "(a) text", for the letters a–j. The text may be blank.</summary>
    public static bool TryChoice(string line, out char letter, out string rest)
    {
        letter = '\0';
        rest = "";
        int at;
        if (line.Length >= 3 && line[0] == '(' && IsChoiceLetter(line[1]) && line[2] == ')') { letter = line[1]; at = 3; }
        else if (line.Length >= 2 && IsChoiceLetter(line[0]) && line[1] is '.' or ')') { letter = line[0]; at = 2; }
        else return false;
        if (at < line.Length && !char.IsWhiteSpace(line[at])) return false; // "a.m." or "A)B" are text
        rest = line[at..].Trim();
        return true;
    }

    /// <summary>
    /// The choices on one choice line. Printed exams often put several on one line, separated by
    /// a tab or two or more spaces: "a. var    b. const".
    /// </summary>
    public static List<(string Letter, string Text)> Choices(char letter, string rest)
    {
        var choices = new List<(string, string)>();
        while (true)
        {
            var at = NextChoiceAt(rest, (char)(letter + 1));
            if (at < 0)
            {
                choices.Add((letter.ToString(), rest.Trim()));
                return choices;
            }
            choices.Add((letter.ToString(), rest[..at].Trim()));
            TryChoice(rest[at..], out letter, out rest);
        }
    }

    private static int NextChoiceAt(string text, char next)
    {
        for (var i = 1; i < text.Length; i++)
        {
            if (char.IsWhiteSpace(text[i]) || !char.IsWhiteSpace(text[i - 1])) continue;
            var gapStart = i - 1;
            while (gapStart > 0 && char.IsWhiteSpace(text[gapStart - 1])) gapStart--;
            var gap = text[gapStart..i];
            if (gap.Length < 2 && !gap.Contains('\t')) continue;
            if (TryChoice(text[i..], out var found, out _) && found == next) return i;
        }
        return -1;
    }

    private static bool IsChoiceLetter(char c) => c is >= 'a' and <= 'j' or >= 'A' and <= 'J';

    /// <summary>"- left = right" (also with "–", "•", or "*").</summary>
    public static bool TryPair(string line, out string left, out string right)
    {
        left = right = "";
        if (line.Length < 2 || line[0] is not ('-' or '–' or '•' or '*') || !char.IsWhiteSpace(line[1])) return false;
        return TrySplitPair(line[2..], out left, out right);
    }

    /// <summary>"left = right", as in a matching cell.</summary>
    public static bool TrySplitPair(string text, out string left, out string right)
    {
        left = right = "";
        var equals = text.IndexOf('=');
        if (equals < 0) return false;
        left = text[..equals].Trim();
        right = text[(equals + 1)..].Trim();
        return true;
    }

    /// <summary>"Answer: b", "Ans: b", or "Ans. b".</summary>
    public static bool TryAnswer(string line, out string answer)
    {
        answer = "";
        foreach (var label in new[] { "answers:", "answer:", "ans:", "ans." })
        {
            if (!line.StartsWith(label, StringComparison.OrdinalIgnoreCase)) continue;
            answer = line[label.Length..].Trim();
            return true;
        }
        return false;
    }

    /// <summary>"Answer key", "Answer Key:", or "Answers".</summary>
    public static bool IsAnswerKeyHeading(string line) =>
        line.TrimEnd(':', '.').Trim().ToLowerInvariant() is "answer key" or "answer keys" or "answers";

    /// <summary>"Directions: …" (also "Direction:" and "Instructions:").</summary>
    public static bool TryDirections(string line, out string directions)
    {
        directions = "";
        foreach (var label in new[] { "directions:", "direction:", "instructions:" })
        {
            if (!line.StartsWith(label, StringComparison.OrdinalIgnoreCase)) continue;
            directions = line[label.Length..].Trim();
            return true;
        }
        return false;
    }

    /// <summary>
    /// A section heading: it starts with "Test", "Part", or "Section"; or it starts with a roman
    /// numeral ("II.") and names a question type; or it is only a type name ("MATCHING TYPE").
    /// </summary>
    public static SectionDraft? TrySection(string line)
    {
        if (TryNumbered(line, out _, out _)) return null;
        var (title, _, _) = SplitPoints(line);
        var words = title.ToLowerInvariant().Split([' ', '\t'], StringSplitOptions.RemoveEmptyEntries);
        if (words.Length == 0) return null;

        var first = words[0].TrimEnd('.', ':', ')');
        var isHeading = (SectionWords.Contains(first) && words.Length > 1 && IsSectionMark(words[1].TrimEnd('.', ':', ')')))
            || (Romans.Contains(first) && words[0].Length > first.Length && ImportTypes.FromWords(title) is not null)
            || BareTypeHeadings.Contains(string.Join(' ', words).TrimEnd('.', ':'));
        return isHeading ? Section(line) : null;
    }

    /// <summary>"I", "2", or "A": what follows "Test", "Part", or "Section" in a heading.</summary>
    private static bool IsSectionMark(string word) =>
        Romans.Contains(word) || (word.Length is > 0 and <= 2 && word.All(char.IsAsciiDigit)) || (word.Length == 1 && char.IsAsciiLetter(word[0]));

    /// <summary>A section from its heading: "Test I. Multiple choice (1 point each)".</summary>
    public static SectionDraft Section(string heading)
    {
        var (title, points, each) = SplitPoints(Clean(heading).Replace('\t', ' '));
        return new SectionDraft
        {
            Title = title,
            Type = ImportTypes.FromWords(title),
            PointsEach = each ? points : null,
            PointsTotal = each ? null : points,
        };
    }

    /// <summary>
    /// Takes a trailing "(N point(s) [each])" or "(N pts)" off a heading or a question:
    /// "Test I. Multiple choice (1 point each)" is ("Test I. Multiple choice", 1, each).
    /// </summary>
    public static (string Text, decimal? Points, bool Each) SplitPoints(string text)
    {
        var trimmed = text.TrimEnd();
        if (!trimmed.EndsWith(')')) return (text, null, false);
        var open = trimmed.LastIndexOf('(');
        if (open < 0) return (text, null, false);
        var inside = trimmed[(open + 1)..^1].ToLowerInvariant();
        if (!inside.Contains("point") && !inside.Contains("pt")) return (text, null, false);
        var points = FirstNumber(inside);
        if (points is null) return (text, null, false);
        return (trimmed[..open].TrimEnd(), points, inside.Contains("each"));
    }

    private static decimal? FirstNumber(string text)
    {
        var start = 0;
        while (start < text.Length && !char.IsAsciiDigit(text[start])) start++;
        var end = start;
        while (end < text.Length && (char.IsAsciiDigit(text[end]) || text[end] == '.')) end++;
        return decimal.TryParse(text[start..end].TrimEnd('.'), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var n) ? n : null;
    }

    /// <summary>"20", "1.5", or blank (null). Anything else is not a number.</summary>
    public static bool TryPoints(string? text, out decimal? points)
    {
        points = null;
        if (string.IsNullOrWhiteSpace(text)) return true;
        if (!decimal.TryParse(text.Trim(), NumberStyles.AllowDecimalPoint | NumberStyles.AllowLeadingSign, CultureInfo.InvariantCulture, out var n)) return false;
        points = n;
        return true;
    }

    /// <summary>"Test I. Multiple choice" is "Test I"; a title without that shape is used whole.</summary>
    public static string SectionName(string title)
    {
        var dot = title.IndexOf(". ", StringComparison.Ordinal);
        return dot > 0 ? title[..dot] : title.Length > 0 ? title : "The first part";
    }

    public static string Number(decimal value) => value.ToString("0.##", CultureInfo.InvariantCulture);
}
