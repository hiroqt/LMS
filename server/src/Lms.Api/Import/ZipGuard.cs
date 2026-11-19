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
    /// <summary>Attaches a template from the web or a network share, which can bring macros in when the file is opened.</summary>
    RemoteTemplate,
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
                // Relationship parts are small; they say whether a template is attached from elsewhere.
                var keep = entry.FullName == "[Content_Types].xml" || entry.FullName.EndsWith(".rels", StringComparison.OrdinalIgnoreCase);
                var contentTypes = keep ? new MemoryStream() : null;

                using var content = entry.Open();
                int read;
                while ((read = content.Read(buffer, 0, buffer.Length)) > 0)
                {
                    unpacked += read;
                    if (unpacked > maxUnpackedBytes) return (ZipProblem.TooBig, "");
                    if (contentTypes is { Length: < 1024 * 1024 }) contentTypes.Write(buffer, 0, read);
                }
                if (contentTypes is null) continue;
                var text = Encoding.UTF8.GetString(contentTypes.ToArray());
                if (entry.FullName != "[Content_Types].xml")
                {
                    if (AttachesRemoteTemplate(text)) return (ZipProblem.RemoteTemplate, "");
                    continue;
                }

                // A macro-enabled document says so in its content types, whatever its name.
                types = text;
                if (types.Contains("macroEnabled", StringComparison.OrdinalIgnoreCase) || types.Contains("vbaProject", StringComparison.OrdinalIgnoreCase))
                    return (ZipProblem.Macro, "");
            }
            return (ZipProblem.None, types);
        }
        catch (InvalidDataException) { return (ZipProblem.Unreadable, ""); }
    }

    /// <summary>
    /// An <c>attachedTemplate</c> relationship whose target is a web address or a network share.
    /// A template on the author's own disk (a school template they started from) is left alone:
    /// it is not fetched from anywhere a stranger controls.
    /// </summary>
    internal static bool AttachesRemoteTemplate(string relationships)
    {
        foreach (var relationship in relationships.Split("<Relationship ", StringSplitOptions.RemoveEmptyEntries).Skip(1))
        {
            if (!relationship.Contains("attachedTemplate", StringComparison.OrdinalIgnoreCase) || !relationship.Contains("External", StringComparison.OrdinalIgnoreCase)) continue;
            var at = relationship.IndexOf("Target=\"", StringComparison.OrdinalIgnoreCase);
            if (at < 0) continue;
            var target = relationship[(at + 8)..].TrimStart();
            if (target.StartsWith("http:", StringComparison.OrdinalIgnoreCase) || target.StartsWith("https:", StringComparison.OrdinalIgnoreCase)
                || target.StartsWith("ftp:", StringComparison.OrdinalIgnoreCase) || target.StartsWith("\\\\", StringComparison.Ordinal)
                || target.StartsWith("file://", StringComparison.OrdinalIgnoreCase) && !target.StartsWith("file:///", StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private static bool IsMacro(string name) =>
        name.Contains("vbaProject", StringComparison.OrdinalIgnoreCase) || name.Contains("vbaData", StringComparison.OrdinalIgnoreCase);
}
