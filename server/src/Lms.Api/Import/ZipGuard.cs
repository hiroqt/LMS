using System.IO.Compression;
using System.Text;

namespace Lms.Api.Import;

/// <summary>
/// Checks a .docx or .xlsx before it is opened: it must be a zip, hold at most
/// <see cref="ImportLimits.MaxZipEntries"/> entries and <see cref="ImportLimits.MaxUnpackedBytes"/>
/// once unpacked (counted by actually unpacking, so a lying header cannot get past), and carry no
/// macros. Anything else is refused as "This file could not be read."
/// </summary>
internal static class ZipGuard
{
    public static void Check(byte[] bytes, CancellationToken ct)
    {
        if (bytes.Length < 4 || bytes[0] != 'P' || bytes[1] != 'K' || bytes[2] != 3 || bytes[3] != 4) throw Unreadable();
        try
        {
            using var zip = new ZipArchive(new MemoryStream(bytes, writable: false), ZipArchiveMode.Read);
            if (zip.Entries.Count > ImportLimits.MaxZipEntries) throw Unreadable();

            var unpacked = 0L;
            var buffer = new byte[81920];
            foreach (var entry in zip.Entries)
            {
                ct.ThrowIfCancellationRequested();
                if (IsMacro(entry.FullName)) throw Unreadable();
                var isContentTypes = entry.FullName == "[Content_Types].xml";
                var contentTypes = isContentTypes ? new MemoryStream() : null;

                using var stream = entry.Open();
                int read;
                while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
                {
                    unpacked += read;
                    if (unpacked > ImportLimits.MaxUnpackedBytes) throw Unreadable();
                    contentTypes?.Write(buffer, 0, read);
                }

                // A macro-enabled document says so in its content types, whatever its name.
                if (contentTypes is not null)
                {
                    var types = Encoding.UTF8.GetString(contentTypes.ToArray());
                    if (types.Contains("macroEnabled", StringComparison.OrdinalIgnoreCase) || types.Contains("vbaProject", StringComparison.OrdinalIgnoreCase))
                        throw Unreadable();
                }
            }
        }
        catch (InvalidDataException) { throw Unreadable(); }
    }

    private static bool IsMacro(string name) =>
        name.Contains("vbaProject", StringComparison.OrdinalIgnoreCase) || name.Contains("vbaData", StringComparison.OrdinalIgnoreCase);

    private static ImportRefusedException Unreadable() => new(ImportRefusedException.Unreadable);
}
