using System.Diagnostics;
using Microsoft.Extensions.Options;

namespace Lms.Api.Files;

/// <summary>A PDF the converter made, in a folder of its own that disposing deletes.</summary>
public interface IConvertedFile : IAsyncDisposable
{
    /// <summary>A new read-only stream over the PDF.</summary>
    Stream OpenRead();
}

/// <summary>
/// Turns a Word, PowerPoint or Excel file into a PDF for its preview (D-067). Office files can't be
/// shown in a browser, so the preview of a material is a PDF copy; the download is always the original.
/// </summary>
public interface IDocumentConverter
{
    /// <summary>False when the server has no converter: Office files then get no preview.</summary>
    bool Enabled { get; }

    /// <summary>
    /// Null when no PDF could be made in time. Never throws for a file it can't convert; it throws
    /// only when <paramref name="ct"/> is cancelled.
    /// </summary>
    /// <param name="content">Seekable; read from the start and left open.</param>
    /// <param name="extension">The file's checked extension, e.g. ".pptx".</param>
    Task<IConvertedFile?> ToPdfAsync(Stream content, string extension, CancellationToken ct);
}

public sealed class LibreOfficeOptions
{
    /// <summary>The <c>soffice</c> program. Empty: looked for on the PATH and in the usual install folders.</summary>
    public string? Path { get; set; }
    /// <summary>For one file, including the wait for a free slot.</summary>
    public int TimeoutSeconds { get; set; } = 45;
    /// <summary>Conversions that may run at the same time.</summary>
    public int MaxConcurrent { get; set; } = 2;
}

/// <summary>No converter: Office files are downloaded, not previewed (<c>Lms:Files:Converter = none</c>).</summary>
public sealed class NoConverter : IDocumentConverter
{
    public bool Enabled => false;
    public Task<IConvertedFile?> ToPdfAsync(Stream content, string extension, CancellationToken ct) => Task.FromResult<IConvertedFile?>(null);
}

/// <summary>
/// Runs LibreOffice headless, one process per file. The file was already checked (no macros, no
/// remote template) and scanned. Each run gets its own throwaway profile and folder, so runs can't
/// see each other or a previous file, and it is stopped once the time is up.
/// </summary>
public sealed class LibreOfficeConverter(string program, LibreOfficeOptions options, ILogger<LibreOfficeConverter> logger) : IDocumentConverter
{
    private readonly SemaphoreSlim _slots = new(Math.Max(1, options.MaxConcurrent));

    public bool Enabled => true;

    /// <summary>The configured program, else <c>soffice</c> on the PATH or in the usual install folders. Null when there is none.</summary>
    public static string? Find(string? configured)
    {
        if (!string.IsNullOrWhiteSpace(configured)) return File.Exists(configured) ? configured : null;
        var names = OperatingSystem.IsWindows() ? new[] { "soffice.exe" } : ["soffice", "libreoffice"];
        var folders = (Environment.GetEnvironmentVariable("PATH") ?? "").Split(System.IO.Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries).ToList();
        if (OperatingSystem.IsMacOS()) folders.Add("/Applications/LibreOffice.app/Contents/MacOS");
        if (OperatingSystem.IsLinux()) folders.AddRange(["/usr/bin", "/usr/lib/libreoffice/program", "/opt/libreoffice/program"]);
        if (OperatingSystem.IsWindows()) folders.Add(@"C:\Program Files\LibreOffice\program");
        return folders.SelectMany(folder => names.Select(name => System.IO.Path.Combine(folder, name))).FirstOrDefault(File.Exists);
    }

    public async Task<IConvertedFile?> ToPdfAsync(Stream content, string extension, CancellationToken ct)
    {
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(ct);
        limit.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, options.TimeoutSeconds)));
        try { await _slots.WaitAsync(limit.Token); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("No preview: every conversion slot stayed busy for {Seconds} s", options.TimeoutSeconds);
            return null;
        }

        DirectoryInfo? work = null;
        var kept = false;
        try
        {
            // Inside the try, so the slot is given back even when the folder can't be made.
            work = Directory.CreateTempSubdirectory("lms-convert-");
            // The input's name is fixed: the uploaded name never reaches the command line.
            var input = System.IO.Path.Combine(work.FullName, "input" + extension);
            content.Position = 0;
            await using (var file = File.Create(input)) await content.CopyToAsync(file, limit.Token);
            var output = System.IO.Path.Combine(work.FullName, "out");
            Directory.CreateDirectory(output);

            var start = new ProcessStartInfo(program) { UseShellExecute = false, RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = work.FullName };
            foreach (var argument in new[]
            {
                $"-env:UserInstallation={new Uri(System.IO.Path.Combine(work.FullName, "profile")).AbsoluteUri}",
                "--headless", "--invisible", "--nodefault", "--nolockcheck", "--nologo", "--norestore",
                "--convert-to", "pdf", "--outdir", output, input,
            }) start.ArgumentList.Add(argument);
            // Anything LibreOffice writes outside its profile lands here, not in the service account's home.
            start.Environment["HOME"] = work.FullName;

            using var process = Process.Start(start) ?? throw new InvalidOperationException($"{program} did not start.");
            var stdout = process.StandardOutput.ReadToEndAsync(CancellationToken.None);
            var stderr = process.StandardError.ReadToEndAsync(CancellationToken.None);
            try
            {
                await process.WaitForExitAsync(limit.Token);
            }
            catch (OperationCanceledException)
            {
                try { process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { }
                throw;
            }

            var pdf = System.IO.Path.Combine(output, "input.pdf");
            if (process.ExitCode != 0 || !File.Exists(pdf))
            {
                // LibreOffice's own messages, never the file or its name.
                logger.LogWarning("No preview: LibreOffice exited with {Code} for a {Extension} file. {Output} {Error}", process.ExitCode, extension, Trim(await stdout), Trim(await stderr));
                return null;
            }
            kept = true;
            return new Converted(work, pdf);
        }
        // The time ran out: while copying the file in, or while LibreOffice ran (the wait for a slot counts too).
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("No preview: LibreOffice did not finish a {Extension} file within {Seconds} s", extension, options.TimeoutSeconds);
            return null;
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException or InvalidOperationException or System.ComponentModel.Win32Exception && !ct.IsCancellationRequested)
        {
            logger.LogError(e, "No preview: LibreOffice could not be run for a {Extension} file", extension);
            return null;
        }
        finally
        {
            _slots.Release();
            if (!kept && work is not null) Delete(work);
        }
    }

    private static string Trim(string text) => text.Length > 500 ? text[..500] : text.Trim();

    private static void Delete(DirectoryInfo folder)
    {
        try { folder.Delete(recursive: true); } catch (IOException) { } catch (UnauthorizedAccessException) { }
    }

    private sealed class Converted(DirectoryInfo folder, string pdf) : IConvertedFile
    {
        public Stream OpenRead() => new FileStream(pdf, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);

        public ValueTask DisposeAsync()
        {
            Delete(folder);
            return ValueTask.CompletedTask;
        }
    }
}
