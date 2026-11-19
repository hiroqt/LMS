using System.IO.Compression;
using System.Text;

namespace Lms.Api.Import;

/// <summary>What <see cref="ZipGuard.Inspect"/> found wrong with a package, if anything.</summary>
internal enum ZipProblem
{
    None,
    /// <summary>Not a zip, or a damaged one.</summary>
    Unreadable,
    /// <summary>More entries, or more bytes once unpacked, than allowed (zip bomb guard).</summary>
    TooBig,
    /// <summary>Carries macros.</summary>
    Macro,
}

/// <summary>
/// Checks an Office package (.docx, .xlsx, .pptx) before anything opens it: it must be a zip, hold
/// at most the given number of entries and bytes once unpacked (counted by actually unpacking, so a
/// lying header cannot get past), and carry no macros. The exam import refuses anything else as
/// "This file could not be read."; student uploads (Files/FileSniffer) say why.
/// </summary>
internal static class ZipGuard
{
    public static void Check(byte[] bytes, CancellationToken ct)
    {
        var (problem, _) = Inspect(new MemoryStream(bytes, writable: false), ImportLimits.MaxZipEntries, ImportLimits.MaxUnpackedBytes, ct);
        if (problem != ZipProblem.None) throw new ImportRefusedException(ImportRefusedException.Unreadable);
    }

    /// <summary>Checks the package and returns its <c>[Content_Types].xml</c> ("" when it has none). The stream is left open.</summary>
    public static (ZipProblem Problem, string ContentTypes) Inspect(Stream stream, int maxEntries, long maxUnpackedBytes, CancellationToken ct)
    {
        Span<byte> magic = stackalloc byte[4];
        stream.Position = 0;
        if (stream.ReadAtLeast(magic, 4, throwOnEndOfStream: false) < 4 || magic[0] != 'P' || magic[1] != 'K' || magic[2] != 3 || magic[3] != 4)
            return (ZipProblem.Unreadable, "");
        stream.Position = 0;
        try
        {
            using var zip = new ZipArchive(stream, ZipArchiveMode.Read, leaveOpen: true);
            if (zip.Entries.Count > maxEntries) return (ZipProblem.TooBig, "");

            var unpacked = 0L;
            var types = "";
            var buffer = new byte[81920];
            foreach (var entry in zip.Entries)
            {
                ct.ThrowIfCancellationRequested();
                if (IsMacro(entry.FullName)) return (ZipProblem.Macro, "");
                var contentTypes = entry.FullName == "[Content_Types].xml" ? new MemoryStream() : null;

                using var content = entry.Open();
                int read;
                while ((read = content.Read(buffer, 0, buffer.Length)) > 0)
                {
                    unpacked += read;
                    if (unpacked > maxUnpackedBytes) return (ZipProblem.TooBig, "");
                    contentTypes?.Write(buffer, 0, read);
                }

                // A macro-enabled document says so in its content types, whatever its name.
                if (contentTypes is not null)
                {
                    types = Encoding.UTF8.GetString(contentTypes.ToArray());
                    if (types.Contains("macroEnabled", StringComparison.OrdinalIgnoreCase) || types.Contains("vbaProject", StringComparison.OrdinalIgnoreCase))
                        return (ZipProblem.Macro, "");
                }
            }
            return (ZipProblem.None, types);
        }
        catch (InvalidDataException) { return (ZipProblem.Unreadable, ""); }
    }

    private static bool IsMacro(string name) =>
        name.Contains("vbaProject", StringComparison.OrdinalIgnoreCase) || name.Contains("vbaData", StringComparison.OrdinalIgnoreCase);
}
