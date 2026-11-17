using System.Text;

namespace Lms.Api.Import;

/// <summary>Decodes an uploaded .txt or .csv file.</summary>
internal static class PlainText
{
    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    /// <summary>
    /// UTF-8, with or without a byte order mark. A file with NUL bytes is binary (or UTF-16) and
    /// is refused. Bytes that are not UTF-8 are read as Windows-1252, which is what Excel's plain
    /// "CSV (Comma delimited)" saves on Windows, and <paramref name="notUtf8"/> says so.
    /// </summary>
    public static string Decode(byte[] bytes, out bool notUtf8)
    {
        notUtf8 = false;
        if (Array.IndexOf(bytes, (byte)0) >= 0) throw new ImportRefusedException(ImportRefusedException.Unreadable);
        var start = bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF ? 3 : 0;
        try
        {
            return StrictUtf8.GetString(bytes, start, bytes.Length - start);
        }
        catch (DecoderFallbackException)
        {
            notUtf8 = true;
            return Windows1252.GetString(bytes);
        }
    }

    public const string NotUtf8Warning = "This file is not saved as UTF-8, so check letters such as ñ and é. In Excel, save as “CSV UTF-8”.";

    private static Encoding Windows1252
    {
        get
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(1252);
        }
    }
}
