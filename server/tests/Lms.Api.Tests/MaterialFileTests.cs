using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Content;
using Lms.Api.Data;
using Lms.Api.Files;
using Lms.Api.Identity;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

/// <summary>Class material files and their previews (D-067): upload, replace, remove, who can download, Office previews.</summary>
public sealed class MaterialFileTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    // Fictional records only.
    private const string Teacher = "EMP-1";
    private const string OtherTeacher = "EMP-2";
    private const string Enrolled = "STU-1";
    private const string Dropped = "STU-2";
    private const string Outsider = "STU-9";
    private const string Base = "/api/classes/class-a/materials";

    private async Task<long> SeedAsync() => await _factory.WithDbAsync(async db =>
    {
        db.IsmsClasses.AddRange(
            new IsmsClass { Id = "class-a", ScheduleId = "SCH-1", SubjectName = "Database Systems 1", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = true },
            new IsmsClass { Id = "class-b", ScheduleId = "SCH-2", SubjectName = "Web Development 1", InstructorId = OtherTeacher, InstructorName = "Ben Cruz", IsActive = true });
        db.IsmsClassStudents.AddRange(
            new IsmsClassStudent { ClassId = "class-a", StudentId = Enrolled, EnrollmentId = "E-1", FirstName = "Lia", LastName = "Abad", IsActive = true },
            new IsmsClassStudent { ClassId = "class-a", StudentId = Dropped, EnrollmentId = "E-2", FirstName = "Mia", LastName = "Bas", IsActive = false });
        var module = new Module { ClassId = "class-a", Title = "Unit 1", SortOrder = 1 };
        db.Modules.Add(module);
        await db.SaveChangesAsync();
        return module.Id;
    });

    private HttpClient As(string id, string role)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(DemoIdentity.UserHeader, id);
        client.DefaultRequestHeaders.Add(DemoIdentity.RoleHeader, role);
        return client;
    }

    private HttpClient Instructor => As(Teacher, CurrentUser.Instructor);
    private HttpClient Student => As(Enrolled, CurrentUser.Student);

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement;

    private static async Task<string> Expect(HttpResponseMessage response, HttpStatusCode expected)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == expected, $"{(int)response.StatusCode}: {text}");
        return text;
    }

    /// <summary>The fields first, then the file, as the Instructor form sends them.</summary>
    private static MultipartFormDataContent Form(long moduleId, byte[]? bytes, string name, string title = "Week 1 slides", string kind = "Lecture Slides", string? description = null)
    {
        var form = new MultipartFormDataContent
        {
            { new StringContent(moduleId.ToString(System.Globalization.CultureInfo.InvariantCulture)), "moduleId" },
            { new StringContent(title), "title" },
            { new StringContent(kind), "kind" },
        };
        if (description is not null) form.Add(new StringContent(description), "description");
        if (bytes is not null)
        {
            var file = new ByteArrayContent(bytes);
            // What the browser claims is ignored: the server decides from the bytes.
            file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            form.Add(file, "file", name);
        }
        return form;
    }

    private async Task<JsonElement> UploadAsync(long moduleId, byte[] bytes, string name, string title = "Week 1 slides")
    {
        using var form = Form(moduleId, bytes, name, title);
        var response = await Instructor.PostAsync($"{Base}/upload", form);
        await Expect(response, HttpStatusCode.Created);
        return await Json(response);
    }

    private Task<HttpResponseMessage> ReplaceAsync(HttpClient client, long id, byte[] bytes, string name) =>
        client.PutAsync($"{Base}/{id}/file", TestFiles.Form(bytes, name));

    /// <summary>Kept files on disk (not counting uploads still on their way in).</summary>
    private int StoredFileCount() => Directory.Exists(_factory.FilesRoot)
        ? Directory.GetFiles(_factory.FilesRoot, "*", SearchOption.AllDirectories).Count(f => Path.GetFileName(Path.GetDirectoryName(f)) != "tmp") : 0;

    private int PendingFileCount() => Directory.Exists(Path.Combine(_factory.FilesRoot, "tmp")) ? Directory.GetFiles(Path.Combine(_factory.FilesRoot, "tmp")).Length : 0;

    [Fact]
    public async Task An_instructor_adds_a_material_with_its_file_and_downloads_the_same_bytes()
    {
        var module = await SeedAsync();
        var bytes = TestFiles.Pdf("Normal forms");
        var dto = await UploadAsync(module, bytes, "normal-forms.pdf", "Normal forms guide");

        Assert.Equal(("Normal forms guide", "Lecture Slides"), (dto.GetProperty("title").GetString(), dto.GetProperty("kind").GetString()));
        var file = dto.GetProperty("file");
        Assert.Equal(("normal-forms.pdf", "application/pdf", "pdf", bytes.Length), (file.GetProperty("name").GetString(), file.GetProperty("contentType").GetString(), file.GetProperty("type").GetString(), file.GetProperty("size").GetInt32()));
        // A PDF is its own preview, so there is no copy and no converter call.
        Assert.Equal(JsonValueKind.Null, file.GetProperty("preview").ValueKind);
        Assert.Empty(_factory.Converter.Calls);
        // The old text columns are filled for clients that still read them.
        Assert.Equal(("normal-forms.pdf", "pdf", "1 KB"), (dto.GetProperty("fileName").GetString(), dto.GetProperty("fileType").GetString(), dto.GetProperty("fileSize").GetString()));

        var id = dto.GetProperty("id").GetInt64();
        var download = await Instructor.GetAsync($"{Base}/{id}/file");
        await Expect(download, HttpStatusCode.OK);
        Assert.Equal(bytes, await download.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/pdf", download.Content.Headers.ContentType?.MediaType);
        Assert.Equal("attachment", download.Content.Headers.ContentDisposition?.DispositionType);
        Assert.Equal("nosniff", download.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("sandbox", download.Headers.GetValues("Content-Security-Policy").Single());
        Assert.True(download.Headers.CacheControl is { Private: true, NoCache: true });
        Assert.NotNull(download.Headers.ETag);

        // Owned by the instructor, belonging to no assignment, and recorded in the audit log by id only.
        await _factory.WithDbAsync(async db =>
        {
            var stored = await db.StoredFiles.SingleAsync();
            Assert.Equal((Teacher, (long?)null, "class-a"), (stored.OwnerId, stored.CourseworkId, stored.ClassId));
            var audit = await db.AuditLog.SingleAsync(a => a.Target == "Material");
            Assert.Equal(("created", id.ToString(System.Globalization.CultureInfo.InvariantCulture)), (audit.Action, audit.TargetId));
            Assert.DoesNotContain("normal-forms", audit.Summary);
            return 0;
        });
        Assert.Equal(1, StoredFileCount());
    }

    [Fact]
    public async Task Only_the_instructor_and_enrolled_students_can_download_and_archiving_hides_it_from_students()
    {
        var module = await SeedAsync();
        var id = (await UploadAsync(module, TestFiles.Pdf(), "guide.pdf")).GetProperty("id").GetInt64();
        var path = $"{Base}/{id}/file";

        await Expect(await Student.GetAsync(path), HttpStatusCode.OK);
        // Everyone else gets the same 404 as for a file that does not exist.
        await Expect(await As(Dropped, CurrentUser.Student).GetAsync(path), HttpStatusCode.NotFound);
        await Expect(await As(Outsider, CurrentUser.Student).GetAsync(path), HttpStatusCode.NotFound);
        await Expect(await As(OtherTeacher, CurrentUser.Instructor).GetAsync(path), HttpStatusCode.NotFound);
        await Expect(await Student.GetAsync($"/api/classes/class-a/materials/{id + 100}/file"), HttpStatusCode.NotFound);
        await Expect(await As(OtherTeacher, CurrentUser.Instructor).GetAsync($"/api/classes/class-b/materials/{id}/file"), HttpStatusCode.NotFound);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _factory.CreateClient().GetAsync(path)).StatusCode);
        // A PDF has no separate preview copy.
        await Expect(await Instructor.GetAsync($"{Base}/{id}/preview"), HttpStatusCode.NotFound);

        await Expect(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { status = "archived" }), HttpStatusCode.OK);
        await Expect(await Student.GetAsync(path), HttpStatusCode.NotFound);
        await Expect(await Instructor.GetAsync(path), HttpStatusCode.OK);
    }

    [Fact]
    public async Task Students_cannot_add_replace_or_remove_files()
    {
        var module = await SeedAsync();
        var id = (await UploadAsync(module, TestFiles.Pdf(), "guide.pdf")).GetProperty("id").GetInt64();
        using (var form = Form(module, TestFiles.Pdf("Mine"), "mine.pdf"))
            await Expect(await Student.PostAsync($"{Base}/upload", form), HttpStatusCode.Forbidden);
        await Expect(await ReplaceAsync(Student, id, TestFiles.Pdf("Mine"), "mine.pdf"), HttpStatusCode.Forbidden);
        await Expect(await Student.DeleteAsync($"{Base}/{id}/file"), HttpStatusCode.Forbidden);
        Assert.Equal(1, StoredFileCount());
    }

    [Fact]
    public async Task A_refused_upload_saves_neither_the_material_nor_the_file()
    {
        var module = await SeedAsync();
        async Task<string> Refused(MultipartFormDataContent form, HttpStatusCode expected)
        {
            using (form) return await Expect(await Instructor.PostAsync($"{Base}/upload", form), expected);
        }

        Assert.Contains("Enter a title", await Refused(Form(module, TestFiles.Pdf(), "guide.pdf", title: " "), HttpStatusCode.BadRequest));
        Assert.Contains("Choose one of", await Refused(Form(module, TestFiles.Pdf(), "guide.pdf", kind: "Poster"), HttpStatusCode.BadRequest));
        Assert.Contains("Choose a module", await Refused(Form(module + 50, TestFiles.Pdf(), "guide.pdf"), HttpStatusCode.BadRequest));
        Assert.Contains("at most 10000", await Refused(Form(module, TestFiles.Pdf(), "guide.pdf", description: new string('a', 70_000)), HttpStatusCode.BadRequest));
        Assert.Contains("Choose a file", await Refused(Form(module, null, ""), HttpStatusCode.UnprocessableEntity));
        Assert.Contains("Choose a file", await Expect(await Instructor.PostAsJsonAsync($"{Base}/upload", new { moduleId = module, title = "Guide", kind = "Reading" }), HttpStatusCode.UnprocessableEntity));
        Assert.Contains("empty", await Refused(Form(module, [], "guide.pdf"), HttpStatusCode.UnprocessableEntity));
        Assert.Contains("not accepted", await Refused(Form(module, TestFiles.Program(), "guide.pdf"), HttpStatusCode.UnprocessableEntity));
        Assert.Contains("Old Office", await Refused(Form(module, TestFiles.OldOffice(), "slides.ppt"), HttpStatusCode.UnprocessableEntity));
        Assert.Contains("not accepted", await Refused(Form(module, TestFiles.PlainZip(), "code.zip"), HttpStatusCode.UnprocessableEntity));
        Assert.Contains("macros", await Refused(Form(module, TestFiles.DocxWithVba(), "notes.docx"), HttpStatusCode.UnprocessableEntity));
        Assert.Contains("larger than 25 MB", await Refused(Form(module, new byte[FileLimits.MaxFileBytes + 1], "big.pdf"), HttpStatusCode.UnprocessableEntity));

        _factory.Scanner.Verdict = ScanVerdict.Infected;
        Assert.Contains("virus scan flagged", await Refused(Form(module, TestFiles.Pdf(), "guide.pdf"), HttpStatusCode.UnprocessableEntity));
        _factory.Scanner.Verdict = ScanVerdict.Unavailable;
        Assert.Contains("not available", await Refused(Form(module, TestFiles.Pdf(), "guide.pdf"), HttpStatusCode.ServiceUnavailable));

        Assert.Equal((0, 0), (StoredFileCount(), PendingFileCount()));
        Assert.Equal((0, 0), await _factory.WithDbAsync(async db => (await db.Materials.CountAsync(), await db.StoredFiles.CountAsync())));
        // The flagged upload leaves a metadata-only audit row.
        var refusal = await _factory.WithDbAsync(db => db.AuditLog.SingleAsync(a => a.Category == "files"));
        Assert.Equal(("refused", "class-a"), (refusal.Action, refusal.TargetId));
    }

    [Fact]
    public async Task Office_files_get_a_pdf_copy_for_their_preview_and_still_download_as_the_original()
    {
        var module = await SeedAsync();
        var docx = TestFiles.Docx();
        var ready = await UploadAsync(module, docx, "lab-manual.docx");
        Assert.Equal("ready", ready.GetProperty("file").GetProperty("preview").GetString());
        Assert.Equal("word", ready.GetProperty("file").GetProperty("type").GetString());
        Assert.Equal([".docx"], _factory.Converter.Calls);
        // The preview loads the copy, so its size is what the page warns about.
        var copySize = TestFiles.Pdf("Preview copy").Length;
        Assert.Equal(copySize, ready.GetProperty("file").GetProperty("previewSize").GetInt64());

        var id = ready.GetProperty("id").GetInt64();
        var listed = (await Json(await Student.GetAsync(Base))).GetProperty("items").EnumerateArray().Single(m => m.GetProperty("id").GetInt64() == id);
        Assert.Equal(copySize, listed.GetProperty("file").GetProperty("previewSize").GetInt64());
        var preview = await Student.GetAsync($"{Base}/{id}/preview");
        await Expect(preview, HttpStatusCode.OK);
        Assert.Equal(TestFiles.Pdf("Preview copy"), await preview.Content.ReadAsByteArrayAsync());
        Assert.Equal(("application/pdf", "lab-manual.pdf"), (preview.Content.Headers.ContentType?.MediaType, preview.Content.Headers.ContentDisposition?.FileName?.Trim('"')));
        Assert.Equal(docx, await (await Student.GetAsync($"{Base}/{id}/file")).Content.ReadAsByteArrayAsync());
        Assert.Equal(2, StoredFileCount());

        // No PDF: the material is saved and downloadable, without a preview.
        _factory.Converter.Convert = _ => null;
        var failed = await UploadAsync(module, TestFiles.Xlsx(), "grades.xlsx", "Grade sheet");
        Assert.Equal("failed", failed.GetProperty("file").GetProperty("preview").GetString());
        Assert.Equal(JsonValueKind.Null, failed.GetProperty("file").GetProperty("previewSize").ValueKind);
        await Expect(await Student.GetAsync($"{Base}/{failed.GetProperty("id").GetInt64()}/preview"), HttpStatusCode.NotFound);
        await Expect(await Student.GetAsync($"{Base}/{failed.GetProperty("id").GetInt64()}/file"), HttpStatusCode.OK);

        // What comes back must really be a PDF.
        _factory.Converter.Convert = _ => TestFiles.Text("not a pdf");
        Assert.Equal("failed", (await UploadAsync(module, TestFiles.Pptx(), "deck.pptx", "Deck")).GetProperty("file").GetProperty("preview").GetString());

        // Without a converter, nothing is attempted.
        _factory.Converter.Enabled = false;
        var calls = _factory.Converter.Calls.Count;
        Assert.Equal("off", (await UploadAsync(module, TestFiles.Pptx(), "deck-2.pptx", "Deck 2")).GetProperty("file").GetProperty("preview").GetString());
        Assert.Equal(calls, _factory.Converter.Calls.Count);
        Assert.Equal((5, 0), (StoredFileCount(), PendingFileCount()));
    }

    [Fact]
    public async Task Replacing_or_removing_a_file_deletes_the_old_bytes_once_saved()
    {
        var module = await SeedAsync();
        var first = await UploadAsync(module, TestFiles.Docx(), "week1.docx");
        var id = first.GetProperty("id").GetInt64();
        var oldFile = first.GetProperty("file").GetProperty("id").GetInt64();
        Assert.Equal(2, StoredFileCount());

        var replaced = await Json(await ReplaceAsync(Instructor, id, TestFiles.Pdf("Week 1 v2"), "week1-v2.pdf"));
        var file = replaced.GetProperty("file");
        Assert.Equal(("week1-v2.pdf", JsonValueKind.Null), (file.GetProperty("name").GetString(), file.GetProperty("preview").ValueKind));
        Assert.NotEqual(oldFile, file.GetProperty("id").GetInt64());
        Assert.Equal(TestFiles.Pdf("Week 1 v2"), await (await Student.GetAsync($"{Base}/{id}/file")).Content.ReadAsByteArrayAsync());
        await Expect(await Student.GetAsync($"{Base}/{id}/preview"), HttpStatusCode.NotFound);
        // The Word file and its PDF copy are gone; their rows stay as a record, marked deleted.
        Assert.Equal(1, StoredFileCount());
        Assert.Equal(2, await _factory.WithDbAsync(db => db.StoredFiles.CountAsync(f => f.DeletedAt != null)));

        var removed = await Json(await Instructor.DeleteAsync($"{Base}/{id}/file"));
        Assert.Equal(JsonValueKind.Null, removed.GetProperty("file").ValueKind);
        Assert.Equal(JsonValueKind.Null, removed.GetProperty("fileName").ValueKind);
        Assert.Equal(0, StoredFileCount());
        await Expect(await Student.GetAsync($"{Base}/{id}/file"), HttpStatusCode.NotFound);
        await Expect(await Instructor.DeleteAsync($"{Base}/{id}/file"), HttpStatusCode.NotFound);

        // A material made before uploads (a name only) gets its real file the same way.
        var legacy = (await Json(await Instructor.PostAsJsonAsync(Base, new { moduleId = module, title = "Old slides", kind = "Lecture Slides", fileName = "old.pdf", fileSize = "1.8 MB" }))).GetProperty("id").GetInt64();
        await Expect(await Student.GetAsync($"{Base}/{legacy}/file"), HttpStatusCode.NotFound);
        await Expect(await ReplaceAsync(Instructor, legacy, TestFiles.Pdf("Old slides"), "old.pdf"), HttpStatusCode.OK);
        await Expect(await Student.GetAsync($"{Base}/{legacy}/file"), HttpStatusCode.OK);
    }

    [Fact]
    public async Task A_pdf_copy_that_cannot_be_read_saves_the_file_without_a_preview()
    {
        var module = await SeedAsync();
        _factory.Converter.CopyUnreadable = true;
        var saved = await UploadAsync(module, TestFiles.Docx(), "lab-manual.docx");
        Assert.Equal("failed", saved.GetProperty("file").GetProperty("preview").GetString());
        Assert.Equal((1, 0), (StoredFileCount(), PendingFileCount()));
    }

    [Fact]
    public async Task An_upload_cancelled_while_its_preview_is_made_leaves_nothing_behind()
    {
        var module = await SeedAsync();
        // What the converter does when the instructor's request is cancelled mid-conversion.
        _factory.Converter.Convert = _ => throw new OperationCanceledException();
        using var form = Form(module, TestFiles.Pptx(), "deck.pptx", "Deck");
        try { await Instructor.PostAsync($"{Base}/upload", form); }
        catch (OperationCanceledException) { }
        Assert.Equal((0, 0), (StoredFileCount(), PendingFileCount()));
        Assert.Equal(0, await _factory.WithDbAsync(db => db.Materials.CountAsync()));
    }

    [Fact]
    public async Task Two_replacements_at_the_same_moment_keep_one_file_and_no_stray_bytes()
    {
        var module = await SeedAsync();
        var id = (await UploadAsync(module, TestFiles.Pdf(), "guide.pdf")).GetProperty("id").GetInt64();

        // While the first replacement is being scanned, a second one finishes.
        HttpResponseMessage? second = null;
        var nested = false;
        _factory.Scanner.DuringScan = async () =>
        {
            if (nested) return;
            nested = true;
            second = await ReplaceAsync(Instructor, id, TestFiles.Pdf("Second"), "second.pdf");
        };
        var first = await ReplaceAsync(Instructor, id, TestFiles.Pdf("First"), "first.pdf");
        _factory.Scanner.DuringScan = null;

        await Expect(second!, HttpStatusCode.OK);
        Assert.Contains("changed at the same moment", await Expect(first, HttpStatusCode.Conflict));
        Assert.Equal(TestFiles.Pdf("Second"), await (await Student.GetAsync($"{Base}/{id}/file")).Content.ReadAsByteArrayAsync());
        Assert.Equal((1, 0), (StoredFileCount(), PendingFileCount()));
    }

    [Fact]
    public async Task Deleting_a_material_deletes_its_file_and_preview()
    {
        var module = await SeedAsync();
        var id = (await UploadAsync(module, TestFiles.Pptx(), "deck.pptx")).GetProperty("id").GetInt64();
        Assert.Equal(2, StoredFileCount());
        await Expect(await Instructor.DeleteAsync($"{Base}/{id}"), HttpStatusCode.NoContent);
        Assert.Equal(0, StoredFileCount());
        Assert.Equal(2, await _factory.WithDbAsync(db => db.StoredFiles.CountAsync(f => f.DeletedAt != null)));
    }

    [Fact]
    public async Task A_file_the_browser_already_has_comes_back_as_304()
    {
        var module = await SeedAsync();
        var id = (await UploadAsync(module, TestFiles.Pdf(), "guide.pdf")).GetProperty("id").GetInt64();
        var tag = (await Student.GetAsync($"{Base}/{id}/file")).Headers.ETag!;

        using var again = new HttpRequestMessage(HttpMethod.Get, $"{Base}/{id}/file");
        again.Headers.IfNoneMatch.Add(tag);
        Assert.Equal(HttpStatusCode.NotModified, (await Student.SendAsync(again)).StatusCode);

        // The check still runs for each person: someone not on the class list gets nothing.
        using var outsider = new HttpRequestMessage(HttpMethod.Get, $"{Base}/{id}/file");
        outsider.Headers.IfNoneMatch.Add(tag);
        Assert.Equal(HttpStatusCode.NotFound, (await As(Outsider, CurrentUser.Student).SendAsync(outsider)).StatusCode);
    }

    [Fact]
    public async Task Lists_and_the_overview_carry_each_material_file()
    {
        var module = await SeedAsync();
        var id = (await UploadAsync(module, TestFiles.Pptx(), "deck.pptx")).GetProperty("id").GetInt64();
        await Instructor.PostAsJsonAsync(Base, new { moduleId = module, title = "Reading list", kind = "Reading" });

        var listed = (await Json(await Student.GetAsync(Base))).GetProperty("items");
        Assert.Equal(2, listed.GetArrayLength());
        Assert.Equal(("deck.pptx", "powerpoint", "ready"), (listed[0].GetProperty("file").GetProperty("name").GetString(), listed[0].GetProperty("file").GetProperty("type").GetString(), listed[0].GetProperty("file").GetProperty("preview").GetString()));
        Assert.Equal(JsonValueKind.Null, listed[1].GetProperty("file").ValueKind);

        var overview = (await Json(await Student.GetAsync("/api/me/overview"))).GetProperty("materials");
        Assert.Equal(id, overview[0].GetProperty("id").GetInt64());
        Assert.Equal("deck.pptx", overview[0].GetProperty("file").GetProperty("name").GetString());

        var patched = await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { title = "Deck, week 2" }));
        Assert.Equal("deck.pptx", patched.GetProperty("file").GetProperty("name").GetString());
    }

    [Theory]
    [InlineData("libreoffice", "/no/such/soffice", "does not exist")]
    [InlineData("pdfmaker", null, "Use libreoffice or none")]
    public void A_converter_that_cannot_run_stops_the_API_from_starting(string converter, string? path, string message)
    {
        using var factory = new LmsApiFactory().With("Lms:Files:Converter", converter).With("Lms:Files:LibreOffice:Path", path);
        // The host may wrap the startup error, so every message in the chain counts.
        var messages = new List<string>();
        for (Exception? e = Assert.ThrowsAny<Exception>(() => factory.CreateClient()); e is not null; e = e.InnerException) messages.Add(e.Message);
        Assert.Contains(messages, m => m.Contains(message, StringComparison.Ordinal));
    }
}
