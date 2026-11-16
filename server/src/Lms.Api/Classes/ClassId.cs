using System.Buffers.Text;
using System.Globalization;
using System.Text;

namespace Lms.Api.Classes;

/// <summary>
/// The LMS class key: one section + subject + instructor offering from ISMS. It is the
/// base64url (no padding) of "scheduleId␟subjectId␟instructorId", so it is stable for the
/// same ISMS offering, safe in a URL path, and reversible without a lookup table.
/// </summary>
public static class ClassId
{
    private const char Separator = '\u001F'; // ASCII unit separator; never part of an ISMS id.

    public static string Create(string scheduleId, int subjectId, string instructorId)
    {
        var raw = string.Join(Separator, scheduleId, subjectId.ToString(CultureInfo.InvariantCulture), instructorId);
        return Base64Url.EncodeToString(Encoding.UTF8.GetBytes(raw));
    }

    public static bool TryParse(string? id, out (string ScheduleId, int SubjectId, string InstructorId) parts)
    {
        parts = default;
        if (string.IsNullOrWhiteSpace(id) || id.Length > 1024) return false;

        string raw;
        try
        {
            raw = Encoding.UTF8.GetString(Base64Url.DecodeFromChars(id));
        }
        catch (FormatException)
        {
            return false;
        }

        var split = raw.Split(Separator);
        if (split.Length != 3
            || string.IsNullOrEmpty(split[0])
            || string.IsNullOrEmpty(split[2])
            || !int.TryParse(split[1], NumberStyles.None, CultureInfo.InvariantCulture, out var subjectId))
        {
            return false;
        }

        parts = (split[0], subjectId, split[2]);
        return true;
    }
}
