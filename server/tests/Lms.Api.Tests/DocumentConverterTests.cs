using System.Text;
using Lms.Api.Files;
using Microsoft.Extensions.Logging.Abstractions;

namespace Lms.Api.Tests;

/// <summary>
/// Runs only where LibreOffice is installed. API CI installs it and sets LMS_REQUIRE_LIBREOFFICE=1,
/// so there a missing install fails the test instead of skipping it.
/// </summary>
public sealed class LibreOfficeTheoryAttribute : TheoryAttribute
{
    public LibreOfficeTheoryAttribute()
    {
        if (LibreOfficeConverter.Find(null) is null && Environment.GetEnvironmentVariable("LMS_REQUIRE_LIBREOFFICE") != "1")
            Skip = "LibreOffice is not installed here; API CI runs this test.";
    }
}

/// <summary>Needs a POSIX shell for the stand-in programs.</summary>
public sealed class PosixFactAttribute : FactAttribute
{
    public PosixFactAttribute()
    {
        if (OperatingSystem.IsWindows()) Skip = "The stand-in converters are shell scripts.";
    }
}

/// <summary>The Office-to-PDF converter for material previews (D-067).</summary>
public sealed class DocumentConverterTests : IDisposable
{
    private readonly string _scripts = Directory.CreateTempSubdirectory("lms-converter-test-").FullName;
    public void Dispose() => Directory.Delete(_scripts, recursive: true);

    private static string DemoFile(string name) => Path.Combine(AppContext.BaseDirectory, "Demo", "files", name);

    /// <summary>A program that stands in for soffice: <paramref name="body"/> runs with LibreOffice's arguments.</summary>
    private string Program(string body)
    {
        var path = Path.Combine(_scripts, $"soffice-{Guid.NewGuid():N}");
        File.WriteAllText(path, "#!/bin/sh\n" + body + "\n");
        if (!OperatingSystem.IsWindows()) File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        return path;
    }

    private static LibreOfficeConverter Converter(string program, int timeoutSeconds = 30) =>
        new(program, new LibreOfficeOptions { TimeoutSeconds = timeoutSeconds }, NullLogger<LibreOfficeConverter>.Instance);

    private static int WorkFolders() => Directory.GetDirectories(Path.GetTempPath(), "lms-convert-*").Length;

    private static async Task<byte[]> ReadAsync(IConvertedFile file)
    {
        await using var content = file.OpenRead();
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer);
        return buffer.ToArray();
    }

    [LibreOfficeTheory]
    [InlineData("relational-database-design.pptx")]
    [InlineData("semantic-html-reference.docx")]
    [InlineData("sql-query-workbook.xlsx")]
    public async Task LibreOffice_turns_each_office_format_into_a_pdf(string name)
    {
        var program = LibreOfficeConverter.Find(null) ?? throw new InvalidOperationException("LMS_REQUIRE_LIBREOFFICE is set, but soffice was not found.");
        await using var source = File.OpenRead(DemoFile(name));
        await using var pdf = await Converter(program, timeoutSeconds: 120).ToPdfAsync(source, Path.GetExtension(name), CancellationToken.None);
        Assert.NotNull(pdf);
        using var bytes = new MemoryStream(await ReadAsync(pdf));
        Assert.Equal(FileKind.Pdf, FileSniffer.Detect(bytes, "preview.pdf", CancellationToken.None).Kind);
    }

    [PosixFact]
    public async Task It_converts_a_copy_with_a_fixed_name_reads_the_result_and_cleans_up()
    {
        // Writes "<input name>.pdf" into the --outdir folder, recording what it was given.
        var log = Path.Combine(_scripts, "arguments.txt");
        var program = Program($$"""
            printf '%s\n' "$@" > '{{log}}'
            out=""; prev=""; for a in "$@"; do [ "$prev" = "--outdir" ] && out="$a"; prev="$a"; done
            for input in "$@"; do :; done
            name=$(basename "$input"); printf '%%PDF-1.7 made from %s' "$(cat "$input")" > "$out/${name%.*}.pdf"
            """);
        var before = WorkFolders();
        await using (var source = new MemoryStream(Encoding.UTF8.GetBytes("slides")))
        await using (var pdf = await Converter(program).ToPdfAsync(source, ".pptx", CancellationToken.None))
        {
            Assert.NotNull(pdf);
            Assert.Equal("%PDF-1.7 made from slides", Encoding.UTF8.GetString(await ReadAsync(pdf)));
        }
        var arguments = File.ReadAllLines(log);
        Assert.Contains("--headless", arguments);
        Assert.Contains("--convert-to", arguments);
        Assert.StartsWith("-env:UserInstallation=file://", arguments[0]);
        // The uploaded name never reaches the command line: the input is always "input.<ext>".
        Assert.Equal("input.pptx", Path.GetFileName(arguments[^1]));
        Assert.Equal(before, WorkFolders());
    }

    [PosixFact]
    public async Task A_program_that_fails_or_never_finishes_gives_no_pdf()
    {
        var before = WorkFolders();
        await using (var source = new MemoryStream([1, 2, 3]))
            Assert.Null(await Converter(Program("exit 3")).ToPdfAsync(source, ".docx", CancellationToken.None));
        // Exits cleanly but writes nothing.
        await using (var source = new MemoryStream([1, 2, 3]))
            Assert.Null(await Converter(Program("exit 0")).ToPdfAsync(source, ".docx", CancellationToken.None));

        var started = DateTime.UtcNow;
        await using (var source = new MemoryStream([1, 2, 3]))
            Assert.Null(await Converter(Program("sleep 30"), timeoutSeconds: 1).ToPdfAsync(source, ".xlsx", CancellationToken.None));
        Assert.True(DateTime.UtcNow - started < TimeSpan.FromSeconds(15), "The stuck conversion was not stopped at its time limit.");
        Assert.Equal(before, WorkFolders());
    }

    [PosixFact]
    public async Task Time_that_runs_out_while_the_file_is_copied_in_gives_no_pdf_and_frees_the_slot()
    {
        var program = Program("""
            out=""; prev=""; for a in "$@"; do [ "$prev" = "--outdir" ] && out="$a"; prev="$a"; done
            printf '%%PDF-1.7' > "$out/input.pdf"
            """);
        // One slot: the second run only starts if the first gave it back.
        var converter = new LibreOfficeConverter(program, new LibreOfficeOptions { TimeoutSeconds = 1, MaxConcurrent = 1 }, NullLogger<LibreOfficeConverter>.Instance);
        var before = WorkFolders();
        await using (var stuck = new StuckStream())
            Assert.Null(await converter.ToPdfAsync(stuck, ".docx", CancellationToken.None));
        await using (var source = new MemoryStream([1, 2, 3]))
        await using (var pdf = await converter.ToPdfAsync(source, ".docx", CancellationToken.None))
            Assert.NotNull(pdf);
        Assert.Equal(before, WorkFolders());
    }

    /// <summary>A source whose bytes never arrive.</summary>
    private sealed class StuckStream : MemoryStream
    {
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default)
        {
            await Task.Delay(Timeout.Infinite, ct);
            return 0;
        }

        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken ct) => ReadAsync(buffer.AsMemory(offset, count), ct).AsTask();
    }

    [Fact]
    public void A_configured_program_must_exist()
    {
        Assert.Null(LibreOfficeConverter.Find("/no/such/soffice"));
        Assert.Equal(DemoFile("control-flow-practice.txt"), LibreOfficeConverter.Find(DemoFile("control-flow-practice.txt")));
    }
}
