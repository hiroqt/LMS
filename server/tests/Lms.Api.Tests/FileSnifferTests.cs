using Lms.Api.Files;

namespace Lms.Api.Tests;

/// <summary>What a file is comes from its bytes, never its name (D-055, contract §5).</summary>
public sealed class FileSnifferTests
{
    private static Sniffed Detect(byte[] bytes, string name) => FileSniffer.Detect(new MemoryStream(bytes), name, CancellationToken.None);

    [Fact]
    public void Each_accepted_format_is_recognized_from_its_bytes()
    {
        Assert.Equal(FileKind.Pdf, Detect(TestFiles.Pdf(), "work.pdf").Kind);
        Assert.Equal(FileKind.Docx, Detect(TestFiles.Docx(), "essay.docx").Kind);
        Assert.Equal(FileKind.Xlsx, Detect(TestFiles.Xlsx(), "table.xlsx").Kind);
        Assert.Equal(FileKind.Pptx, Detect(TestFiles.Pptx(), "slides.pptx").Kind);
        Assert.Equal(FileKind.Jpeg, Detect(TestFiles.Jpeg(), "photo.JPG").Kind);
        Assert.Equal(FileKind.Jpeg, Detect(TestFiles.Jpeg(), "photo.jpeg").Kind);
        Assert.Equal(FileKind.Png, Detect(TestFiles.Png(), "scan.png").Kind);
        Assert.Equal(FileKind.PlainText, Detect(TestFiles.Text(), "notes.txt").Kind);
    }

    [Fact]
    public void The_name_must_agree_with_what_the_bytes_are()
    {
        var renamed = Detect(TestFiles.Png(), "work.pdf");
        Assert.Null(renamed.Kind);
        Assert.Contains("a PNG image", renamed.Refusal);
        Assert.Contains(".png", renamed.Refusal);
        // A program called .pdf, .txt or .docx is still a program.
        Assert.Equal(FileSniffer.NotAccepted, Detect(TestFiles.Program(), "work.pdf").Refusal);
        Assert.Equal(FileSniffer.NotAccepted, Detect(TestFiles.Program(), "work.txt").Refusal);
        Assert.Equal(FileSniffer.NotAccepted, Detect(TestFiles.Program(), "work.docx").Refusal);
        Assert.Contains("ends in \"nothing\"", Detect(TestFiles.Pdf(), "work").Refusal);
    }

    [Fact]
    public void Old_Office_files_macros_and_other_zips_are_refused_with_the_reason()
    {
        Assert.Equal(FileSniffer.OldOffice, Detect(TestFiles.OldOffice(), "essay.doc").Refusal);
        Assert.Equal(FileSniffer.OldOffice, Detect(TestFiles.OldOffice(), "essay.docx").Refusal);
        Assert.Equal(FileSniffer.Macros, Detect(TestFiles.Docm(), "essay.docx").Refusal);
        Assert.Equal(FileSniffer.Macros, Detect(TestFiles.DocxWithVba(), "essay.docx").Refusal);
        Assert.Equal(FileSniffer.NotAccepted, Detect(TestFiles.PlainZip(), "work.zip").Refusal);
        Assert.Equal(FileSniffer.NotAccepted, Detect(TestFiles.PlainZip(), "work.docx").Refusal);
        Assert.Equal(FileSniffer.Damaged, Detect([(byte)'P', (byte)'K', 3, 4, 9, 9, 9, 9, 9], "essay.docx").Refusal);
    }

    [Fact]
    public void A_document_that_loads_its_template_from_elsewhere_is_refused()
    {
        Assert.Equal(FileSniffer.RemoteTemplate, Detect(TestFiles.DocxWithTemplate("https://example.test/macros.dotm"), "essay.docx").Refusal);
        Assert.Equal(FileSniffer.RemoteTemplate, Detect(TestFiles.DocxWithTemplate("\\\\fileserver\\share\\macros.dotm"), "essay.docx").Refusal);
        Assert.Equal(FileSniffer.RemoteTemplate, Detect(TestFiles.DocxWithTemplate("file://fileserver/share/macros.dotm"), "essay.docx").Refusal);
        // A template on the author's own disk (a school template they started from) is fine.
        Assert.Equal(FileKind.Docx, Detect(TestFiles.DocxWithTemplate("file:///C:/Users/lia/Documents/School%20report.dotx"), "essay.docx").Kind);
    }

    [Fact]
    public void Text_is_text_only_without_control_bytes()
    {
        Assert.Equal(FileKind.PlainText, Detect("Café ñ — notes"u8.ToArray(), "notes.txt").Kind);
        Assert.Equal(FileKind.PlainText, Detect([0xEF, 0xBB, 0xBF, (byte)'h', (byte)'i'], "notes.txt").Kind);
        Assert.Equal(FileSniffer.NotAccepted, Detect([(byte)'h', 0, (byte)'i'], "notes.txt").Refusal);
        // Text with no .txt name is not guessed at.
        Assert.Equal(FileSniffer.NotAccepted, Detect(TestFiles.Text(), "notes.md").Refusal);
    }

    [Theory]
    [InlineData("er diagram.pdf", "er diagram.pdf")]
    [InlineData("C:\\Users\\lia\\Desktop\\essay.docx", "essay.docx")]
    [InlineData("../../etc/passwd", "passwd")]
    [InlineData("..hidden.pdf", "hidden.pdf")]
    [InlineData("a\"b<c>d:e|f?g*.png", "a_b_c_d_e_f_g_.png")]
    [InlineData("tab\tand\nbreak.txt", "tab and break.txt")]
    [InlineData(".pdf", "pdf")]
    // A right-to-left override would make this read "report‮fdp.exe"; it is dropped.
    [InlineData("report\u202Eexe.pdf", "reportexe.pdf")]
    [InlineData("zero\u200Bwidth\u2066.txt", "zerowidth.txt")]
    [InlineData("", "file")]
    [InlineData(null, "file")]
    public void Names_are_cleaned_and_kept_as_data(string? raw, string expected) => Assert.Equal(expected, FileNames.Clean(raw));

    [Fact]
    public void A_long_name_is_cut_but_keeps_its_extension()
    {
        var name = FileNames.Clean(new string('a', 300) + ".docx");
        Assert.Equal(FileLimits.MaxNameLength, name.Length);
        Assert.EndsWith(".docx", name);
    }

    [Fact]
    public void File_types_are_stored_as_all_or_a_list()
    {
        Assert.Null(FileTypes.Store(FileTypes.All));
        Assert.Equal("pdf,image", FileTypes.Store(["image", "pdf"]));
        Assert.Equal(FileTypes.All, FileTypes.Parse(null));
        Assert.Equal(["pdf", "image"], FileTypes.Parse("image, pdf, nonsense"));
    }
}
