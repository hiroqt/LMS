using System.Globalization;
using System.Text;

namespace Lms.Api.Submissions;

/// <summary>How a typed answer compares with an accepted answer.</summary>
public enum MatchKind { None, Near, Exact }

/// <summary>
/// Comparing typed answers (contract §5). Pure functions, no database.
/// Normalize: Unicode NFC, trim and collapse spaces, drop trailing <c>. , ; : ! ?</c>, and
/// lowercase unless case-sensitive. A near miss is a small spelling slip: never for answers of
/// three characters or fewer or with a digit; otherwise a difference only in accents, or a
/// Damerau-Levenshtein distance of at most 1 (accepted answer of 4–7 characters) or 2 (8 or more).
/// </summary>
public static class Spelling
{
    private static readonly char[] TrailingPunctuation = ['.', ',', ';', ':', '!', '?'];

    public static string Normalize(string? text, bool caseSensitive = false)
    {
        var value = (text ?? "").Normalize(NormalizationForm.FormC);
        value = string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        value = value.TrimEnd(TrailingPunctuation).TrimEnd();
        return caseSensitive ? value : value.ToLowerInvariant();
    }

    /// <summary>The best match of <paramref name="given"/> among <paramref name="accepted"/>: exact first, then a near miss when allowed.</summary>
    public static MatchKind Match(string? given, IEnumerable<string> accepted, bool caseSensitive, bool nearMisses)
    {
        var answer = Normalize(given, caseSensitive);
        if (answer.Length == 0) return MatchKind.None;
        var keys = accepted.Select(a => Normalize(a, caseSensitive)).Where(a => a.Length > 0).ToList();
        if (keys.Contains(answer)) return MatchKind.Exact;
        return nearMisses && keys.Any(k => IsNearMiss(answer, k)) ? MatchKind.Near : MatchKind.None;
    }

    /// <summary>Both arguments already normalized. Equal strings are not a near miss (they are exact).</summary>
    public static bool IsNearMiss(string given, string accepted)
    {
        if (given == accepted) return false;
        if (given.Length <= 3 || accepted.Length <= 3) return false;
        if (given.Any(char.IsDigit) || accepted.Any(char.IsDigit)) return false;
        var a = StripAccents(given);
        var b = StripAccents(accepted);
        if (a == b) return true;
        var allowed = b.Length >= 8 ? 2 : 1;
        return Math.Abs(a.Length - b.Length) <= allowed && Distance(a, b) <= allowed;
    }

    public static string StripAccents(string text)
    {
        var decomposed = text.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(decomposed.Length);
        foreach (var c in decomposed)
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) sb.Append(c);
        return sb.ToString().Normalize(NormalizationForm.FormC);
    }

    /// <summary>Damerau-Levenshtein distance (optimal string alignment): insert, delete, substitute, swap neighbours.</summary>
    public static int Distance(string a, string b)
    {
        var d = new int[a.Length + 1, b.Length + 1];
        for (var i = 0; i <= a.Length; i++) d[i, 0] = i;
        for (var j = 0; j <= b.Length; j++) d[0, j] = j;
        for (var i = 1; i <= a.Length; i++)
        {
            for (var j = 1; j <= b.Length; j++)
            {
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + cost);
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1])
                    d[i, j] = Math.Min(d[i, j], d[i - 2, j - 2] + 1);
            }
        }
        return d[a.Length, b.Length];
    }
}
