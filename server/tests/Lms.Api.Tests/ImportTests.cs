using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DocumentFormat.OpenXml.Packaging;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;
using W = DocumentFormat.OpenXml.Wordprocessing;

namespace Lms.Api.Tests;

/// <summary>Exam import (D-041): Word, Excel, CSV, and text become draft questions; nothing is saved.</summary>
public sealed class ImportTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    // Fictional records only.
    private const string Teacher = "EMP-1";
    private const string WrongFile = "Upload a .docx, .xlsx, .csv, or .txt file of at most 5 MB.";
    private const string Unreadable = "This file could not be read.";

    private HttpClient As(string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, role == CurrentUser.Instructor ? Teacher : "STU-1");
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, role);
        return client;
    }

    private HttpClient Instructor() => As(CurrentUser.Instructor);

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private async Task<JsonElement> ImportTextAsync(string text)
    {
        var response = await Instructor().PostAsJsonAsync("/api/questionnaires/import", new { text });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await Json(response);
    }

    private async Task<HttpResponseMessage> UploadAsync(byte[] bytes, string fileName, HttpClient? client = null)
    {
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        form.Add(file, "file", fileName);
        return await (client ?? Instructor()).PostAsync("/api/questionnaires/import", form);
    }

    private async Task<JsonElement> ImportFileAsync(byte[] bytes, string fileName)
    {
        var response = await UploadAsync(bytes, fileName);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await Json(response);
    }

    private static async Task AssertRefusedAsync(HttpResponseMessage response, string field, string message)
    {
        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var errors = (await Json(response)).GetProperty("errors");
        Assert.Equal(message, errors.GetProperty(field)[0].GetString());
    }

    private static string[] Strings(JsonElement array) => array.EnumerateArray().Select(e => e.GetString()!).ToArray();

    /// <summary>Every warning in the response: the document's and each question's.</summary>
    private static string[] AllWarnings(JsonElement result) =>
        [.. Strings(result.GetProperty("warnings")), .. result.GetProperty("questions").EnumerateArray().SelectMany(q => Strings(q.GetProperty("warnings")))];

    // The contract's sample (§2), with the multiple choice key moved to an answer key at the end.
    private const string ContractSample = """
        Midterm Examination

        Test I. Multiple choice (1 point each)
        Directions: Choose the best answer.
        1. Which keyword declares a constant in C#?
        a. var
        b. const

        Test II. True or false (1 point each)
        2. HTML is a programming language.
        Answer: False

        Test III. Modified true or false (2 points each)
        3. The [CPU] stores data permanently.
        Answer: False – storage / hard disk

        Test IV. Identification (1 point each)
        4. The father of computers.
        Answer: Charles Babbage / Babbage

        Test V. Enumeration (3 points)
        5. Give the three primary colors of light.
        Answer: red; green; blue

        Test VI. Matching (4 points)
        6. Match the device to its use.
        - Keyboard = input
        - Monitor = output

        Test VII. Essay (10 points)
        7. Explain why backups matter.

        Answer key
        1. b
        """;

    [Fact]
    public async Task A_text_exam_with_every_type_and_section_imports_cleanly_with_the_key_at_the_end()
    {
        var result = await ImportTextAsync(ContractSample);

        Assert.Equal("text", result.GetProperty("format").GetString());
        Assert.Equal("Midterm Examination", result.GetProperty("title").GetString());
        Assert.Empty(AllWarnings(result));

        var sections = result.GetProperty("sections");
        Assert.Equal(7, sections.GetArrayLength());
        Assert.Equal("Test I. Multiple choice", sections[0].GetProperty("title").GetString());
        Assert.Equal("Choose the best answer.", sections[0].GetProperty("directions").GetString());
        Assert.Equal(1, sections[0].GetProperty("defaultPoints").GetDecimal());
        Assert.Equal(JsonValueKind.Null, sections[4].GetProperty("defaultPoints").ValueKind);

        var q = result.GetProperty("questions");
        Assert.Equal(["multiple_choice", "true_false", "modified_true_false", "identification", "enumeration", "matching", "essay"],
            q.EnumerateArray().Select(x => x.GetProperty("type").GetString()!).ToArray());
        Assert.Equal([1m, 1m, 2m, 1m, 3m, 4m, 10m], q.EnumerateArray().Select(x => x.GetProperty("points").GetDecimal()).ToArray());
        Assert.Equal([0, 1, 2, 3, 4, 5, 6], q.EnumerateArray().Select(x => x.GetProperty("section").GetInt32()).ToArray());
        Assert.Equal([1, 2, 3, 4, 5, 6, 7], q.EnumerateArray().Select(x => x.GetProperty("number").GetInt32()).ToArray());

        var mc = q[0];
        Assert.Equal("Which keyword declares a constant in C#?", mc.GetProperty("prompt").GetString());
        Assert.Equal(["var", "const"], mc.GetProperty("options").EnumerateArray().Select(o => o.GetProperty("text").GetString()!).ToArray());
        Assert.Equal([false, true], mc.GetProperty("options").EnumerateArray().Select(o => o.GetProperty("isCorrect").GetBoolean()).ToArray());
        Assert.Equal("1. Which keyword declares a constant in C#?\na. var\nb. const", mc.GetProperty("source").GetString());

        Assert.False(q[1].GetProperty("correctAnswer").GetBoolean());

        var mtf = q[2];
        Assert.Equal("The CPU stores data permanently.", mtf.GetProperty("prompt").GetString());
        Assert.Equal("CPU", mtf.GetProperty("underlined").GetString());
        Assert.False(mtf.GetProperty("correctAnswer").GetBoolean());
        Assert.Equal(["storage", "hard disk"], Strings(mtf.GetProperty("expectedAnswers")));

        Assert.Equal(["Charles Babbage", "Babbage"], Strings(q[3].GetProperty("expectedAnswers")));
        Assert.Equal(["red", "green", "blue"], Strings(q[4].GetProperty("expectedAnswers")));
        Assert.Equal("Monitor", q[5].GetProperty("pairs")[1].GetProperty("left").GetString());
        Assert.Equal("output", q[5].GetProperty("pairs")[1].GetProperty("right").GetString());
        Assert.Equal(JsonValueKind.Null, q[6].GetProperty("correctAnswer").ValueKind);
        Assert.False(q[6].GetProperty("alwaysStrict").GetBoolean());
        Assert.False(q[6].GetProperty("caseSensitive").GetBoolean());
    }

    [Fact]
    public async Task Choices_on_one_line_and_restarted_numbering_are_read()
    {
        var result = await ImportTextAsync("""
            Test I. Multiple choice (1 point each)
            1. Pick the odd one.
            a. 2    b. 4	c. 7
            Answer: c
            Test II. True or false (1 point each)
            1. Two is even.
            Answer: T
            """);
        Assert.Empty(AllWarnings(result));
        Assert.Equal(JsonValueKind.Null, result.GetProperty("title").ValueKind);
        var q = result.GetProperty("questions");
        Assert.Equal(["2", "4", "7"], q[0].GetProperty("options").EnumerateArray().Select(o => o.GetProperty("text").GetString()!).ToArray());
        Assert.True(q[0].GetProperty("options")[2].GetProperty("isCorrect").GetBoolean());
        Assert.True(q[1].GetProperty("correctAnswer").GetBoolean());
    }

    [Fact]
    public async Task Brackets_and_Word_underline_mark_the_phrase()
    {
        var text = await ImportTextAsync("""
            Test I. Modified true or false (1 point each)
            1. [Water] boils at 50 °C.
            Answer: False – 100 °C
            """);
        Assert.Equal("Water", text.GetProperty("questions")[0].GetProperty("underlined").GetString());
        Assert.Equal("Water boils at 50 °C.", text.GetProperty("questions")[0].GetProperty("prompt").GetString());

        var docx = Docx(
            Line("Science quiz"),
            Line("Test I. Modified true or false (2 points each)"),
            new W.Paragraph(Run("1. The "), Run("CPU", underline: true), Run(" stores data permanently.")),
            Line("Answer: False – storage"),
            Line("Test II. Identification (1 point each)"),
            new W.Paragraph(Run("2. "), Run("        ", underline: true), Run(" is the brain of the computer.")),
            Line("Answer: CPU"));
        var result = await ImportFileAsync(docx, "science.docx");

        Assert.Equal("docx", result.GetProperty("format").GetString());
        Assert.Equal("Science quiz", result.GetProperty("title").GetString());
        Assert.Empty(AllWarnings(result));
        var q = result.GetProperty("questions");
        Assert.Equal("modified_true_false", q[0].GetProperty("type").GetString());
        Assert.Equal("CPU", q[0].GetProperty("underlined").GetString());
        Assert.Equal("The CPU stores data permanently.", q[0].GetProperty("prompt").GetString());
        Assert.Equal("1. The [CPU] stores data permanently.\nAnswer: False – storage", q[0].GetProperty("source").GetString());
        // An underlined blank is a blank to fill in, not a phrase.
        Assert.Equal("_____ is the brain of the computer.", q[1].GetProperty("prompt").GetString());
        Assert.Equal(["CPU"], Strings(q[1].GetProperty("expectedAnswers")));
    }

    [Fact]
    public async Task Word_automatic_numbering_is_read_as_question_numbers_and_letters()
    {
        var docx = Docx(Line("Test I. Multiple choice (1 point each)"),
            Numbered(1, 0, "Which is a prime?"), Numbered(1, 1, "4"), Numbered(1, 1, "5"), Line("Answer: b"),
            Numbered(1, 0, "Which is even?"), Numbered(1, 1, "3"), Numbered(1, 1, "8"), Line("Answer: b"));
        AddListNumbering(docx, out var bytes);

        var result = await ImportFileAsync(bytes, "numbered.docx");
        Assert.Empty(AllWarnings(result));
        var q = result.GetProperty("questions");
        Assert.Equal([1, 2], q.EnumerateArray().Select(x => x.GetProperty("number").GetInt32()).ToArray());
        Assert.True(q[1].GetProperty("options")[1].GetProperty("isCorrect").GetBoolean());
    }

    [Fact]
    public async Task Each_check_gives_its_warning()
    {
        var result = await ImportTextAsync("""
            Quiz 1
            Test I. Multiple choice (5 points)
            1. Which is a vowel? (1 point)
            a. b
            b. a
            c.
            Answer: b
            2. Which is a  VOWEL? (1 point)
            a. e
            b. f
            Answer: e
            4. Pick one. (1 point)
            a. x
            b. y
            Part B
            5. The capital of France.
            Answer: Paris
            Answer key
            9. a
            """);

        Assert.Equal([
            "The answer key has an answer for 9, but there is no question 9.",
            "Your document numbers questions 1–5, but 4 were found. Missing: 3.",
            "Test I says 5 points, but its questions add up to 3.",
        ], Strings(result.GetProperty("warnings")));

        var q = result.GetProperty("questions");
        Assert.Equal(["Choice c is blank."], Strings(q[0].GetProperty("warnings")));
        Assert.Equal(["The answer “e” matches no choice.", "This question repeats question 1."], Strings(q[1].GetProperty("warnings")));
        Assert.Equal(["No answer found."], Strings(q[2].GetProperty("warnings")));
        Assert.Equal(["Choose the type.", "Enter the points."], Strings(q[3].GetProperty("warnings")));
        Assert.Equal(JsonValueKind.Null, q[3].GetProperty("type").ValueKind);
        Assert.Equal(["Paris"], Strings(q[3].GetProperty("expectedAnswers")));
        Assert.Equal("Part B", result.GetProperty("sections")[1].GetProperty("title").GetString());
    }

    [Theory]
    [InlineData("xlsx")]
    [InlineData("csv")]
    [InlineData("docx")]
    public async Task The_template_imports_cleanly(string format)
    {
        var template = await Instructor().GetAsync($"/api/questionnaires/import/template?format={format}");
        Assert.Equal(HttpStatusCode.OK, template.StatusCode);
        Assert.Equal($"exam-import-template.{format}", template.Content.Headers.ContentDisposition?.FileName);

        var result = await ImportFileAsync(await template.Content.ReadAsByteArrayAsync(), $"exam-import-template.{format}");
        Assert.Equal(format, result.GetProperty("format").GetString());
        Assert.Empty(AllWarnings(result));
        Assert.Equal(7, result.GetProperty("sections").GetArrayLength());

        var q = result.GetProperty("questions");
        Assert.Equal(["multiple_choice", "true_false", "modified_true_false", "identification", "enumeration", "matching", "essay"],
            q.EnumerateArray().Select(x => x.GetProperty("type").GetString()!).ToArray());
        Assert.Equal([1m, 1m, 2m, 1m, 3m, 4m, 10m], q.EnumerateArray().Select(x => x.GetProperty("points").GetDecimal()).ToArray());
        Assert.True(q[0].GetProperty("options")[1].GetProperty("isCorrect").GetBoolean());
        Assert.Equal("CPU", q[2].GetProperty("underlined").GetString());
        Assert.Equal("The CPU stores data permanently.", q[2].GetProperty("prompt").GetString());
        Assert.Equal(["storage", "hard disk"], Strings(q[2].GetProperty("expectedAnswers")));
        Assert.Equal(["red", "green", "blue"], Strings(q[4].GetProperty("expectedAnswers")));
        Assert.Equal(2, q[5].GetProperty("pairs").GetArrayLength());
    }

    [Fact]
    public async Task The_template_needs_a_known_format()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await Instructor().GetAsync("/api/questionnaires/import/template?format=pdf")).StatusCode);
    }

    [Fact]
    public async Task Csv_follows_rfc_4180_quoting_with_or_without_a_byte_order_mark()
    {
        const string csv = "Type,Question,Points,Choice 1,Choice 2,Answer\r\n"
            + "Multiple choice,\"Pick \"\"one\"\", please,\nthen explain\",2,\"x, y\",z,a\r\n"
            + "True or false,Señor is Spanish.,1,,,True\n";
        foreach (var bytes in new[] { Encoding.UTF8.GetBytes(csv), [.. Encoding.UTF8.GetPreamble(), .. Encoding.UTF8.GetBytes(csv)] })
        {
            var result = await ImportFileAsync(bytes, "quiz.csv");
            Assert.Empty(AllWarnings(result));
            Assert.Equal("quiz", result.GetProperty("title").GetString());
            var q = result.GetProperty("questions");
            Assert.Equal("Pick \"one\", please,\nthen explain", q[0].GetProperty("prompt").GetString());
            Assert.Equal("x, y", q[0].GetProperty("options")[0].GetProperty("text").GetString());
            Assert.True(q[0].GetProperty("options")[0].GetProperty("isCorrect").GetBoolean());
            Assert.Equal("Señor is Spanish.", q[1].GetProperty("prompt").GetString());
            Assert.Equal(JsonValueKind.Null, q[0].GetProperty("number").ValueKind);
        }
    }

    [Fact]
    public async Task Wrong_types_and_files_over_5_mb_are_refused()
    {
        await AssertRefusedAsync(await UploadAsync([1, 2, 3], "exam.pdf"), "file", WrongFile);
        await AssertRefusedAsync(await UploadAsync([], "exam"), "file", WrongFile);
        await AssertRefusedAsync(await UploadAsync(Encoding.UTF8.GetBytes(new string('a', 5 * 1024 * 1024 + 1)), "big.txt"), "file", WrongFile);
        await AssertRefusedAsync(await Instructor().PostAsync("/api/questionnaires/import", new StringContent("1. Hi", Encoding.UTF8, "text/plain")), "file", WrongFile);
        await AssertRefusedAsync(await Instructor().PostAsJsonAsync("/api/questionnaires/import", new { text = new string('a', 200_001) }), "text", "Paste at most 200,000 characters.");
        await AssertRefusedAsync(await Instructor().PostAsJsonAsync("/api/questionnaires/import", new { text = " " }), "text", "Paste the exam's text.");

        var many = string.Join('\n', Enumerable.Range(1, 201).Select(n => $"{n}. Question {n}?"));
        await AssertRefusedAsync(await Instructor().PostAsJsonAsync("/api/questionnaires/import", new { text = many }), "text",
            "Import at most 200 questions at a time. Split this file and import each part.");

        var rows = "Question\n" + string.Concat(Enumerable.Range(1, 2001).Select(n => $"Q{n}\n"));
        await AssertRefusedAsync(await UploadAsync(Encoding.UTF8.GetBytes(rows), "rows.csv"), "file", "This file has more than 2,000 rows. Split it and import each part.");
    }

    [Fact]
    public async Task Macro_enabled_files_are_refused()
    {
        var docx = Docx(Line("1. Hello?"));
        await AssertRefusedAsync(await UploadAsync(docx, "exam.docm"), "file", Unreadable);
        await AssertRefusedAsync(await UploadAsync(docx, "exam.xlsm"), "file", Unreadable);
        await AssertRefusedAsync(await UploadAsync(WithEntry(docx, "word/vbaProject.bin", new byte[100]), "exam.docx"), "file", Unreadable);

        var macroTypes = WithEntry(docx, "[Content_Types].xml", Encoding.UTF8.GetBytes(
            """<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.ms-word.document.macroEnabled.main+xml"/></Types>"""));
        await AssertRefusedAsync(await UploadAsync(macroTypes, "exam.docx"), "file", Unreadable);
    }

    [Fact]
    public async Task Corrupt_zips_and_zip_bombs_are_refused()
    {
        await AssertRefusedAsync(await UploadAsync([.. "PK\u0003\u0004"u8.ToArray(), .. new byte[200]], "exam.docx"), "file", Unreadable);
        await AssertRefusedAsync(await UploadAsync(Encoding.UTF8.GetBytes("1. Not a zip"), "exam.xlsx"), "file", Unreadable);
        // A real zip that is not a Word document.
        await AssertRefusedAsync(await UploadAsync(WithEntry(Zip(), "readme.txt", "hi"u8.ToArray()), "exam.docx"), "file", Unreadable);
        // 21 MB of zeros packs into a few kilobytes but unpacks past the 20 MB cap.
        await AssertRefusedAsync(await UploadAsync(WithEntry(Docx(Line("1. Hi?")), "word/media/big.bin", new byte[21 * 1024 * 1024]), "exam.docx"), "file", Unreadable);
        // Binary bytes in a text file.
        await AssertRefusedAsync(await UploadAsync([0x31, 0x2E, 0x00, 0x41], "exam.txt"), "file", Unreadable);
    }

    [Fact]
    public async Task Only_instructors_may_import_or_download_the_template()
    {
        var student = As(CurrentUser.Student);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.PostAsJsonAsync("/api/questionnaires/import", new { text = ContractSample })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await UploadAsync(Docx(Line("1. Hi?")), "exam.docx", student)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync("/api/questionnaires/import/template?format=csv")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().PostAsJsonAsync("/api/questionnaires/import", new { text = ContractSample })).StatusCode);
    }

    [Fact]
    public async Task Nothing_is_saved_and_the_audit_row_holds_only_metadata()
    {
        async Task<int[]> CountsAsync() => await _factory.WithDbAsync(async db => new[]
        {
            await db.Questionnaires.CountAsync(), await db.Questions.CountAsync(), await db.QuestionOptions.CountAsync(),
            await db.QuestionExpectedAnswers.CountAsync(), await db.Coursework.CountAsync(),
        });
        var before = await CountsAsync();

        var template = await (await Instructor().GetAsync("/api/questionnaires/import/template?format=docx")).Content.ReadAsByteArrayAsync();
        await ImportFileAsync(template, "midterm.docx");
        await ImportTextAsync(ContractSample);

        Assert.Equal(before, await CountsAsync());
        var audit = await _factory.WithDbAsync(db => db.AuditLog.Where(a => a.Action == "imported").OrderBy(a => a.Id).ToListAsync());
        Assert.Equal(2, audit.Count);
        Assert.Equal("Questions imported from midterm.docx (docx, 7 questions)", audit[0].Summary);
        Assert.Equal("Questions imported from pasted text (text, 7 questions)", audit[1].Summary);
        Assert.All(audit, a => Assert.Equal(Teacher, a.ActorId));
    }

    // ---------------------------------------------------------------- fixtures, built with OpenXml

    private static W.Run Run(string text, bool underline = false)
    {
        var run = new W.Run(new W.Text(text) { Space = DocumentFormat.OpenXml.SpaceProcessingModeValues.Preserve });
        if (underline) run.PrependChild(new W.RunProperties(new W.Underline { Val = W.UnderlineValues.Single }));
        return run;
    }

    private static W.Paragraph Line(string text) => new(Run(text));

    private static W.Paragraph Numbered(int numId, int level, string text) =>
        new(new W.ParagraphProperties(new W.NumberingProperties(new W.NumberingLevelReference { Val = level }, new W.NumberingId { Val = numId })), Run(text));

    private static byte[] Docx(params W.Paragraph[] paragraphs)
    {
        using var stream = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(stream, DocumentFormat.OpenXml.WordprocessingDocumentType.Document))
            doc.AddMainDocumentPart().Document = new W.Document(new W.Body(paragraphs));
        return stream.ToArray();
    }

    /// <summary>Adds a list definition: level 0 "1.", level 1 "a.".</summary>
    private static void AddListNumbering(byte[] docx, out byte[] bytes)
    {
        using var stream = new MemoryStream();
        stream.Write(docx);
        using (var doc = WordprocessingDocument.Open(stream, true))
        {
            var part = doc.MainDocumentPart!.AddNewPart<NumberingDefinitionsPart>();
            part.Numbering = new W.Numbering(
                new W.AbstractNum(
                    new W.Level(new W.StartNumberingValue { Val = 1 }, new W.NumberingFormat { Val = W.NumberFormatValues.Decimal }, new W.LevelText { Val = "%1." }) { LevelIndex = 0 },
                    new W.Level(new W.StartNumberingValue { Val = 1 }, new W.NumberingFormat { Val = W.NumberFormatValues.LowerLetter }, new W.LevelText { Val = "%2." }) { LevelIndex = 1 })
                { AbstractNumberId = 7 },
                new W.NumberingInstance(new W.AbstractNumId { Val = 7 }) { NumberID = 1 });
        }
        bytes = stream.ToArray();
    }

    private static byte[] Zip()
    {
        using var stream = new MemoryStream();
        using (new ZipArchive(stream, ZipArchiveMode.Create, leaveOpen: true)) { }
        return stream.ToArray();
    }

    /// <summary>The zip with one entry added or replaced.</summary>
    private static byte[] WithEntry(byte[] zip, string name, byte[] content)
    {
        using var stream = new MemoryStream();
        stream.Write(zip);
        using (var archive = new ZipArchive(stream, ZipArchiveMode.Update, leaveOpen: true))
        {
            archive.GetEntry(name)?.Delete();
            using var entry = archive.CreateEntry(name, CompressionLevel.SmallestSize).Open();
            entry.Write(content);
        }
        return stream.ToArray();
    }
}
