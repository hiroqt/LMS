using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Lms.Api.Data;
using Lms.Api.Files;
using Lms.Api.Submissions;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

/// <summary>Assignments Phase 2 through the API: hand-in settings, drafts, files, the receipt, taking work back (D-055, D-058; contract §5–§8).</summary>
public sealed class AssignmentDraftTests : AssessmentTestBase
{
    private DateTimeOffset Now => Factory.Time.Now;

    private async Task<long> AssignmentAsync(object? extra = null)
    {
        await SeedAsync();
        var body = new Dictionary<string, object?> { ["type"] = "assignment", ["moduleId"] = ModuleId, ["title"] = "ER diagram", ["maxPoints"] = 20, ["status"] = "published" };
        foreach (var p in (extra ?? new { }).GetType().GetProperties()) body[p.Name] = p.GetValue(extra);
        return (await Json(await Instructor.PostAsJsonAsync(Base, body))).GetProperty("id").GetInt64();
    }

    private static async Task<HttpResponseMessage> Upload(HttpClient client, long id, byte[] bytes, string name)
    {
        using var form = TestFiles.Form(bytes, name);
        return await client.PostAsync($"{Base}/{id}/draft/files", form);
    }

    private async Task<long> UploadedAsync(HttpClient client, long id, byte[] bytes, string name)
    {
        var response = await Upload(client, id, bytes, name);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Json(response)).GetProperty("files").EnumerateArray().Last().GetProperty("id").GetInt64();
    }

    private static Task<HttpResponseMessage> TurnIn(HttpClient client, long id, object? body = null) => client.PostAsJsonAsync($"{Base}/{id}/draft/turn-in", body ?? new { });

    private static async Task<string> Refused(HttpResponseMessage response, HttpStatusCode expected)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == expected, $"{(int)response.StatusCode}: {text}");
        return text;
    }

    private async Task<JsonElement> VerdictAsync(HttpClient client, long id) => (await Json(await client.GetAsync($"{Base}/{id}"))).GetProperty("turnIn");

    private async Task<List<JsonElement>> MineAsync(HttpClient client, long id) => (await Json(await client.GetAsync($"{Base}/{id}/my-submissions"))).EnumerateArray().ToList();

    private static string[] Strings(JsonElement array) => array.EnumerateArray().Select(x => x.GetString()!).ToArray();

    private int StoredFileCount() => Directory.Exists(Factory.FilesRoot)
        ? Directory.GetFiles(Factory.FilesRoot, "*", SearchOption.AllDirectories).Count(f => Path.GetFileName(Path.GetDirectoryName(f)) != "tmp") : 0;

    private int PendingFileCount() => Directory.Exists(Path.Combine(Factory.FilesRoot, "tmp")) ? Directory.GetFiles(Path.Combine(Factory.FilesRoot, "tmp")).Length : 0;

    // ------------------------------------------------------------------------- §5 hand-in settings

    [Fact]
    public async Task Hand_in_settings_have_defaults_are_checked_and_are_for_assignments_only()
    {
        var id = await AssignmentAsync();
        var dto = await Json(await Instructor.GetAsync($"{Base}/{id}"));
        Assert.Equal(["text", "file"], Strings(dto.GetProperty("submissionKinds")));
        Assert.Equal(["pdf", "word", "powerpoint", "excel", "image", "text"], Strings(dto.GetProperty("allowedFileTypes")));
        Assert.Equal((5, false), (dto.GetProperty("maxFiles").GetInt32(), dto.GetProperty("honorStatement").GetBoolean()));

        var changed = await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { submissionKinds = new[] { "link", "file" }, allowedFileTypes = new[] { "image", "pdf" }, maxFiles = 2, honorStatement = true }));
        Assert.Equal(["file", "link"], Strings(changed.GetProperty("submissionKinds")));
        Assert.Equal(["pdf", "image"], Strings(changed.GetProperty("allowedFileTypes")));
        Assert.Equal((2, true), (changed.GetProperty("maxFiles").GetInt32(), changed.GetProperty("honorStatement").GetBoolean()));
        // Students read the same settings.
        Assert.Equal(["file", "link"], Strings((await Json(await StudentA.GetAsync($"{Base}/{id}"))).GetProperty("submissionKinds")));
        // Choosing every type again means "all", so the list is whole.
        Assert.Equal(6, (await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { allowedFileTypes = FileTypes.All }))).GetProperty("allowedFileTypes").GetArrayLength());
        Assert.Null(await Factory.WithDbAsync(db => db.Coursework.Where(c => c.Id == id).Select(c => c.AllowedFileTypes).SingleAsync()));

        var bad = await Refused(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { submissionKinds = new string[0], allowedFileTypes = new[] { "zip" }, maxFiles = 6 }), HttpStatusCode.BadRequest);
        Assert.Contains("submissionKinds", bad);
        Assert.Contains("allowedFileTypes", bad);
        Assert.Contains("Allow 1 to 5 files", bad);

        var set = await SetAsync(EveryType());
        var exam = await Refused(await Instructor.PostAsJsonAsync(Base, new { type = "exam", moduleId = ModuleId, title = "Quiz", questionnaireId = set, submissionKinds = new[] { "text" }, allowedFileTypes = new[] { "pdf" }, maxFiles = 1, honorStatement = true }), HttpStatusCode.BadRequest);
        foreach (var field in new[] { "submissionKinds", "allowedFileTypes", "maxFiles", "honorStatement" }) Assert.Contains(field, exam);
    }

    // ------------------------------------------------------------------------- §7 drafts

    [Fact]
    public async Task Saving_creates_a_private_draft_that_the_student_reads_back()
    {
        var id = await AssignmentAsync(new { submissionKinds = new[] { "text", "file", "link" } });
        Assert.Empty(await MineAsync(StudentA, id));

        var saved = await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "  Entities: Student, Class.  ", link = "https://example.edu/diagram" }));
        Assert.Equal(("in_progress", "Entities: Student, Class.", "https://example.edu/diagram"), (saved.GetProperty("status").GetString(), saved.GetProperty("text").GetString(), saved.GetProperty("link").GetString()));
        Assert.Empty(saved.GetProperty("files").EnumerateArray());
        // Autosave replaces both fields; null clears one.
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Entities: Student, Class, Enrollment.", link = (string?)null }));
        var mine = Assert.Single(await MineAsync(StudentA, id));
        Assert.Equal(("Entities: Student, Class, Enrollment.", JsonValueKind.Null), (mine.GetProperty("text").GetString(), mine.GetProperty("link").ValueKind));
        Assert.Equal("draft", (await VerdictAsync(StudentA, id)).GetProperty("state").GetString());

        // POST …/draft returns the same draft, and nobody else sees it.
        var again = await StudentA.PostAsync($"{Base}/{id}/draft", null);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(saved.GetProperty("id").GetInt64(), (await Json(again)).GetProperty("id").GetInt64());
        Assert.Empty((await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"))).GetProperty("items").EnumerateArray());
        Assert.Empty(await MineAsync(StudentB, id));
        Assert.Equal(HttpStatusCode.Created, (await StudentB.PostAsync($"{Base}/{id}/draft", null)).StatusCode);
    }

    [Fact]
    public async Task A_draft_is_checked_on_save()
    {
        var id = await AssignmentAsync(new { submissionKinds = new[] { "text", "link" } });
        Assert.Contains("https://", await Refused(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { link = "javascript:alert(1)" }), HttpStatusCode.BadRequest));
        Assert.Contains("https://", await Refused(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { link = "example.edu/diagram" }), HttpStatusCode.BadRequest));
        Assert.Contains("at most 20000", await Refused(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = new string('a', 20_001) }), HttpStatusCode.BadRequest));
        // Nothing was created by the refused saves.
        Assert.Empty(await MineAsync(StudentA, id));

        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { submissionKinds = new[] { "file" } }));
        var refused = await Refused(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "An answer", link = "https://example.edu" }), HttpStatusCode.BadRequest);
        Assert.Contains("doesn't take a written answer", refused);
        Assert.Contains("doesn't take a link", refused);

        // Instructors and exams have no drafts.
        Assert.Equal(HttpStatusCode.Forbidden, (await Instructor.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "x" })).StatusCode);
        var (exam, _) = await ExamAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await StudentA.PutAsJsonAsync($"{Base}/{exam}/draft", new { text = "x" })).StatusCode);
    }

    [Fact]
    public async Task A_draft_changes_only_while_it_could_be_turned_in()
    {
        var due = Now.AddHours(1);
        var id = await AssignmentAsync(new { dueAt = due });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Half done" }));
        var fileId = await UploadedAsync(StudentA, id, TestFiles.Pdf(), "er.pdf");

        Factory.Time.Now = due.AddMinutes(1);
        Assert.Contains("past its due date", await Refused(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "More" }), HttpStatusCode.Conflict));
        Assert.Contains("past its due date", await Refused(await Upload(StudentA, id, TestFiles.Png(), "scan.png"), HttpStatusCode.Conflict));
        Assert.Contains("past its due date", await Refused(await TurnIn(StudentA, id), HttpStatusCode.Conflict));
        Assert.Contains("past its due date", await Refused(await StudentB.PostAsync($"{Base}/{id}/draft", null), HttpStatusCode.Conflict));
        // The student can still read the draft and take a file off it.
        Assert.Equal("Half done", Assert.Single(await MineAsync(StudentA, id)).GetProperty("text").GetString());
        Assert.Empty((await Json(await StudentA.DeleteAsync($"{Base}/{id}/draft/files/{fileId}"))).GetProperty("files").EnumerateArray());
    }

    // ------------------------------------------------------------------------- §7 uploads

    [Fact]
    public async Task An_upload_is_stored_under_a_random_key_with_its_type_decided_from_the_bytes()
    {
        var id = await AssignmentAsync();
        var bytes = TestFiles.Pdf();
        var response = await Upload(StudentA, id, bytes, "C:\\Users\\lia\\My ER diagram.pdf");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var file = Assert.Single((await Json(response)).GetProperty("files").EnumerateArray().ToList());
        var hash = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(bytes));
        Assert.Equal(("My ER diagram.pdf", "application/pdf", (long)bytes.Length, $"{hash[..4]}-{hash[4..8]}".ToUpperInvariant()),
            (file.GetProperty("name").GetString(), file.GetProperty("contentType").GetString(), file.GetProperty("size").GetInt64(), file.GetProperty("code").GetString()));
        Assert.Equal(JsonValueKind.Null, file.GetProperty("sameAsAnotherStudent").ValueKind);

        var row = await Factory.WithDbAsync(db => db.StoredFiles.SingleAsync());
        Assert.Equal((Lia, "class-a", id, hash, ScanStatus.Clean, 1), (row.OwnerId, row.ClassId, row.CourseworkId, row.ContentHash, row.ScanStatus, Factory.Scanner.Scans));
        // The bytes are on disk under the key, which has nothing of the name in it; nothing is left in tmp.
        Assert.Matches("^[0-9a-f]{32}$", row.StorageKey);
        Assert.Equal(bytes, await File.ReadAllBytesAsync(Path.Combine(Factory.FilesRoot, row.StorageKey[..2], row.StorageKey)));
        Assert.Equal((1, 0), (StoredFileCount(), PendingFileCount()));
        Assert.Equal("draft", (await VerdictAsync(StudentA, id)).GetProperty("state").GetString());
    }

    [Fact]
    public async Task Files_that_are_not_accepted_are_refused_and_nothing_is_kept()
    {
        var id = await AssignmentAsync();
        async Task<string> Refusal(byte[] bytes, string name) => await Refused(await Upload(StudentA, id, bytes, name), HttpStatusCode.UnprocessableEntity);

        Assert.Contains("not accepted", await Refusal(TestFiles.Program(), "work.pdf"));
        Assert.Contains("Old Office files", await Refusal(TestFiles.OldOffice(), "essay.doc"));
        Assert.Contains("contains macros", await Refusal(TestFiles.Docm(), "essay.docx"));
        Assert.Contains("not accepted", await Refusal(TestFiles.PlainZip(), "work.zip"));
        Assert.Contains("a PNG image", await Refusal(TestFiles.Png(), "work.pdf"));
        Assert.Contains("empty", await Refusal([], "nothing.pdf"));
        Assert.Contains("larger than 25 MB", await Refusal([.. TestFiles.Pdf(), .. new byte[FileLimits.MaxFileBytes]], "huge.pdf"));
        using (var noFile = TestFiles.Form(TestFiles.Pdf(), "er.pdf", field: "attachment"))
            Assert.Contains("Choose a file", await Refused(await StudentA.PostAsync($"{Base}/{id}/draft/files", noFile), HttpStatusCode.UnprocessableEntity));
        Assert.Contains("Choose a file", await Refused(await StudentA.PostAsJsonAsync($"{Base}/{id}/draft/files", new { file = "er.pdf" }), HttpStatusCode.UnprocessableEntity));

        // A refused upload starts no draft, stores no row, and leaves no bytes behind; none of them was scanned.
        Assert.Empty(await MineAsync(StudentA, id));
        Assert.Equal((0, 0, 0, 0), (await Factory.WithDbAsync(db => db.StoredFiles.CountAsync()), StoredFileCount(), PendingFileCount(), Factory.Scanner.Scans));
    }

    [Fact]
    public async Task The_assignments_settings_decide_which_and_how_many_files()
    {
        var id = await AssignmentAsync(new { allowedFileTypes = new[] { "pdf", "image" }, maxFiles = 2 });
        var wrongType = await Refused(await Upload(StudentA, id, TestFiles.Docx(), "essay.docx"), HttpStatusCode.UnprocessableEntity);
        Assert.Contains("a Word document", wrongType);
        Assert.Contains("PDF, JPEG or PNG images", wrongType);

        await UploadedAsync(StudentA, id, TestFiles.Pdf(), "er.pdf");
        Assert.Contains("already added", await Refused(await Upload(StudentA, id, TestFiles.Pdf(), "copy.pdf"), HttpStatusCode.UnprocessableEntity));
        await UploadedAsync(StudentA, id, TestFiles.Jpeg(), "photo.jpg");
        Assert.Contains("at most 2 files", await Refused(await Upload(StudentA, id, TestFiles.Png(), "scan.png"), HttpStatusCode.Conflict));
        // Another student has their own room, and may hand in the same bytes.
        await UploadedAsync(StudentB, id, TestFiles.Pdf(), "mine.pdf");

        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { submissionKinds = new[] { "text" } }));
        Assert.Contains("doesn't take files", await Refused(await Upload(StudentB, id, TestFiles.Png(), "scan.png"), HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task A_flagged_file_is_refused_and_an_unreachable_scanner_stops_the_upload()
    {
        var id = await AssignmentAsync();
        Factory.Scanner.Verdict = ScanVerdict.Infected;
        Assert.Contains("virus scan flagged this file", await Refused(await Upload(StudentA, id, TestFiles.Pdf(), "er.pdf"), HttpStatusCode.UnprocessableEntity));
        var audit = await Factory.WithDbAsync(db => db.AuditLog.SingleAsync(a => a.Category == "files"));
        Assert.Equal((Lia, "refused", "Upload flagged by the virus scan refused"), (audit.ActorId, audit.Action, audit.Summary));
        Assert.DoesNotContain("er.pdf", audit.Summary + audit.Target);

        Factory.Scanner.Verdict = ScanVerdict.Unavailable;
        Assert.Contains("virus scan is not available", await Refused(await Upload(StudentA, id, TestFiles.Pdf(), "er.pdf"), HttpStatusCode.ServiceUnavailable));
        Assert.Equal((0, 0, 0), (await Factory.WithDbAsync(db => db.StoredFiles.CountAsync()), StoredFileCount(), PendingFileCount()));
        Assert.Empty(await MineAsync(StudentA, id));

        Factory.Scanner.Verdict = ScanVerdict.Clean;
        await UploadedAsync(StudentA, id, TestFiles.Pdf(), "er.pdf");
    }

    [Fact]
    public async Task Uploads_are_limited_per_student()
    {
        Factory.With("Lms:Files:UploadsPerMinute", "2");
        var id = await AssignmentAsync();
        await UploadedAsync(StudentA, id, TestFiles.Pdf("one"), "one.pdf");
        await UploadedAsync(StudentA, id, TestFiles.Pdf("two"), "two.pdf");
        var limited = await Upload(StudentA, id, TestFiles.Pdf("three"), "three.pdf");
        Assert.Contains("Too many uploads", await Refused(limited, HttpStatusCode.TooManyRequests));
        Assert.Equal("60", limited.Headers.RetryAfter?.ToString());
        // The limit is each student's own.
        await UploadedAsync(StudentB, id, TestFiles.Pdf("three"), "three.pdf");
    }

    [Fact]
    public async Task Removing_a_file_deletes_its_bytes_once_nothing_uses_it()
    {
        var id = await AssignmentAsync();
        var fileId = await UploadedAsync(StudentA, id, TestFiles.Pdf(), "er.pdf");
        Assert.Equal(HttpStatusCode.NotFound, (await StudentB.DeleteAsync($"{Base}/{id}/draft/files/{fileId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await StudentA.DeleteAsync($"{Base}/{id}/draft/files/999")).StatusCode);

        Assert.Empty((await Json(await StudentA.DeleteAsync($"{Base}/{id}/draft/files/{fileId}"))).GetProperty("files").EnumerateArray());
        Assert.NotNull(await Factory.WithDbAsync(db => db.StoredFiles.Where(f => f.Id == fileId).Select(f => f.DeletedAt).SingleAsync()));
        Assert.Equal(0, StoredFileCount());
        Assert.Equal(HttpStatusCode.NotFound, (await StudentA.GetAsync($"/api/files/{fileId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await StudentA.DeleteAsync($"{Base}/{id}/draft/files/{fileId}")).StatusCode);
    }

    // ------------------------------------------------------------------------- §8 downloads

    [Fact]
    public async Task A_file_goes_only_to_its_owner_and_once_handed_in_to_the_class_instructor()
    {
        var id = await AssignmentAsync();
        var bytes = TestFiles.Pdf();
        var fileId = await UploadedAsync(StudentA, id, bytes, "ER diagram – final.pdf");

        var mine = await StudentA.GetAsync($"/api/files/{fileId}");
        Assert.Equal(HttpStatusCode.OK, mine.StatusCode);
        Assert.Equal(bytes, await mine.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/pdf", mine.Content.Headers.ContentType!.MediaType);
        Assert.Equal("attachment", mine.Content.Headers.ContentDisposition!.DispositionType);
        Assert.Equal("ER diagram – final.pdf", mine.Content.Headers.ContentDisposition.FileNameStar);
        Assert.Equal("nosniff", mine.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("sandbox", mine.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Contains("no-store", mine.Headers.CacheControl!.ToString());

        // A draft is the student's own: not the instructor's yet, never a classmate's, and not for someone outside the class.
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor.GetAsync($"/api/files/{fileId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await StudentB.GetAsync($"/api/files/{fileId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, "instructor").GetAsync($"/api/files/{fileId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await As("STU-9", "student").GetAsync($"/api/files/{fileId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Factory.CreateClient().GetAsync($"/api/files/{fileId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await StudentA.GetAsync("/api/files/999")).StatusCode);

        await Json(await TurnIn(StudentA, id));
        Assert.Equal(bytes, await (await Instructor.GetAsync($"/api/files/{fileId}")).Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await StudentB.GetAsync($"/api/files/{fileId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await As(OtherTeacher, "instructor").GetAsync($"/api/files/{fileId}")).StatusCode);
    }

    // ------------------------------------------------------------------------- §7 turning in

    [Fact]
    public async Task Turning_in_gives_a_receipt_and_a_repeat_gives_the_same_one()
    {
        var due = Now.AddHours(2);
        var id = await AssignmentAsync(new { dueAt = due });
        Assert.Contains("Add your work", await Refused(await TurnIn(StudentA, id), HttpStatusCode.BadRequest));
        await Json(await StudentA.PostAsync($"{Base}/{id}/draft", null));
        Assert.Contains("Add your work", await Refused(await TurnIn(StudentA, id), HttpStatusCode.BadRequest));

        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "See the attached diagram." }));
        var fileId = await UploadedAsync(StudentA, id, TestFiles.Pdf(), "er.pdf");
        Factory.Time.Now = Now.AddMinutes(30);
        var turnedIn = await Json(await TurnIn(StudentA, id));
        var receipt = turnedIn.GetProperty("receipt");
        var submission = turnedIn.GetProperty("submission");
        Assert.Equal((submission.GetProperty("id").GetInt64(), 1, Factory.Time.Now.UtcDateTime, false),
            (receipt.GetProperty("submissionId").GetInt64(), receipt.GetProperty("attemptNumber").GetInt32(), receipt.GetProperty("submittedAt").GetDateTime(), receipt.GetProperty("late").GetBoolean()));
        var listed = Assert.Single(receipt.GetProperty("files").EnumerateArray().ToList());
        Assert.Equal((fileId, "er.pdf"), (listed.GetProperty("id").GetInt64(), listed.GetProperty("name").GetString()));
        Assert.Matches("^[0-9A-F]{4}-[0-9A-F]{4}$", listed.GetProperty("code").GetString()!);
        Assert.Equal(("submitted", "See the attached diagram."), (submission.GetProperty("status").GetString(), submission.GetProperty("text").GetString()));

        // A retry after a lost answer changes nothing and answers the same receipt.
        Factory.Time.Now = Now.AddMinutes(5);
        var repeat = await Json(await TurnIn(StudentA, id));
        Assert.Equal(receipt.GetRawText(), repeat.GetProperty("receipt").GetRawText());
        Assert.Equal(1, await Factory.WithDbAsync(db => db.Submissions.CountAsync(s => s.CourseworkId == id)));
        Assert.Equal(1, await Factory.WithDbAsync(db => db.AuditLog.CountAsync(a => a.Action == "submitted")));

        // The instructor now sees the work and its file, and the student can't change it.
        var item = Assert.Single((await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"))).GetProperty("items").EnumerateArray().ToList());
        Assert.False(Assert.Single(item.GetProperty("files").EnumerateArray().ToList()).GetProperty("sameAsAnotherStudent").GetBoolean());
        Assert.Equal(("turned_in", "already_turned_in"), ((await VerdictAsync(StudentA, id)).GetProperty("state").GetString(), (await VerdictAsync(StudentA, id)).GetProperty("reason").GetString()));
        Assert.Contains("already handed this in", await Refused(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Changed" }), HttpStatusCode.Conflict));
        Assert.Equal(HttpStatusCode.NotFound, (await StudentA.DeleteAsync($"{Base}/{id}/draft/files/{fileId}")).StatusCode);
    }

    [Fact]
    public async Task The_honor_statement_must_be_confirmed_when_the_assignment_asks_for_it()
    {
        var id = await AssignmentAsync(new { honorStatement = true });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "My answer" }));
        Assert.Contains("your own work", await Refused(await TurnIn(StudentA, id), HttpStatusCode.BadRequest));
        Assert.Contains("your own work", await Refused(await TurnIn(StudentA, id, new { honorStatement = false }), HttpStatusCode.BadRequest));
        await Json(await TurnIn(StudentA, id, new { honorStatement = true }));
        Assert.Equal(Now.UtcDateTime, await Factory.WithDbAsync(db => db.Submissions.Where(s => s.StudentId == Lia).Select(s => s.HonorAcceptedAt).SingleAsync()));
        // The older route asks for it too.
        Assert.Contains("your own work", await Refused(await StudentB.PostAsJsonAsync($"{Base}/{id}/submissions", new { text = "Mine" }), HttpStatusCode.BadRequest));
        await Json(await StudentB.PostAsJsonAsync($"{Base}/{id}/submissions", new { text = "Mine", honorStatement = true }));
    }

    [Fact]
    public async Task A_draft_is_checked_against_todays_settings_at_turn_in()
    {
        var id = await AssignmentAsync(new { submissionKinds = new[] { "text", "file", "link" } });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Answer", link = "https://example.edu/a" }));
        var docx = await UploadedAsync(StudentA, id, TestFiles.Docx(), "essay.docx");
        var pdf = await UploadedAsync(StudentA, id, TestFiles.Pdf(), "er.pdf");

        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { submissionKinds = new[] { "file" }, allowedFileTypes = new[] { "pdf" }, maxFiles = 1 }));
        Assert.Contains("no longer takes a written answer", await Refused(await TurnIn(StudentA, id), HttpStatusCode.BadRequest));
        // The written answer can't be cleared through a save any more than added, so the instructor lets text back in.
        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { submissionKinds = new[] { "file", "text" } }));
        Assert.Contains("no longer takes a link", await Refused(await TurnIn(StudentA, id), HttpStatusCode.BadRequest));
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Answer", link = (string?)null }));
        Assert.Contains("at most 1 file", await Refused(await TurnIn(StudentA, id), HttpStatusCode.BadRequest));
        await Json(await StudentA.DeleteAsync($"{Base}/{id}/draft/files/{pdf}"));
        Assert.Contains("no longer takes files like essay.docx", await Refused(await TurnIn(StudentA, id), HttpStatusCode.BadRequest));
        await Json(await StudentA.DeleteAsync($"{Base}/{id}/draft/files/{docx}"));
        await Json(await TurnIn(StudentA, id));
    }

    [Fact]
    public async Task The_older_turn_in_route_follows_the_hand_in_settings()
    {
        var id = await AssignmentAsync(new { submissionKinds = new[] { "link" } });
        var refused = await Refused(await StudentA.PostAsJsonAsync($"{Base}/{id}/submissions", new { text = "Answer", fileName = "er.pdf" }), HttpStatusCode.BadRequest);
        Assert.Contains("doesn't take a written answer", refused);
        Assert.Contains("doesn't take files", refused);
    }

    // ------------------------------------------------------------------------- §7 resubmitting and taking work back

    [Fact]
    public async Task A_new_version_starts_as_a_copy_and_shares_its_files()
    {
        var id = await AssignmentAsync(new { allowResubmission = true, submissionKinds = new[] { "text", "file", "link" } });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "First try", link = "https://example.edu/v1" }));
        var first = await UploadedAsync(StudentA, id, TestFiles.Pdf("v1"), "v1.pdf");
        await Json(await TurnIn(StudentA, id));

        var started = await StudentA.PostAsync($"{Base}/{id}/draft", null);
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var draft = await Json(started);
        Assert.Equal((2, "in_progress", "First try", "https://example.edu/v1"), (draft.GetProperty("attemptNumber").GetInt32(), draft.GetProperty("status").GetString(), draft.GetProperty("text").GetString(), draft.GetProperty("link").GetString()));
        Assert.Equal(first, Assert.Single(draft.GetProperty("files").EnumerateArray().ToList()).GetProperty("id").GetInt64());

        // Taking the shared file off the draft leaves version 1 whole; the new file is the draft's own.
        await Json(await StudentA.DeleteAsync($"{Base}/{id}/draft/files/{first}"));
        var second = await UploadedAsync(StudentA, id, TestFiles.Pdf("v2"), "v2.pdf");
        Assert.Equal(HttpStatusCode.OK, (await Instructor.GetAsync($"/api/files/{first}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor.GetAsync($"/api/files/{second}")).StatusCode);
        // The instructor still sees version 1 only, until version 2 is turned in.
        var before = Assert.Single((await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"))).GetProperty("items").EnumerateArray().ToList());
        Assert.Equal(1, before.GetProperty("attemptNumber").GetInt32());

        var receipt = (await Json(await TurnIn(StudentA, id))).GetProperty("receipt");
        Assert.Equal((2, second), (receipt.GetProperty("attemptNumber").GetInt32(), receipt.GetProperty("files")[0].GetProperty("id").GetInt64()));
        Assert.Equal(2, (await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"))).GetProperty("items").GetArrayLength());
        Assert.Equal(2, StoredFileCount());
    }

    [Fact]
    public async Task Uploading_with_no_draft_after_turned_in_work_counts_the_files_it_will_copy()
    {
        var id = await AssignmentAsync(new { allowResubmission = true, maxFiles = 2 });
        await UploadedAsync(StudentA, id, TestFiles.Pdf("v1"), "v1.pdf");
        await Json(await TurnIn(StudentA, id));
        // The new draft will start with version 1's file, so the same bytes are "already added" and no draft is started.
        Assert.Contains("already added", await Refused(await Upload(StudentA, id, TestFiles.Pdf("v1"), "again.pdf"), HttpStatusCode.UnprocessableEntity));
        Assert.Single(await MineAsync(StudentA, id));

        var draft = await Json(await Upload(StudentA, id, TestFiles.Pdf("v2"), "v2.pdf"));
        Assert.Equal((2, "in_progress"), (draft.GetProperty("attemptNumber").GetInt32(), draft.GetProperty("status").GetString()));
        Assert.Equal(["v1.pdf", "v2.pdf"], draft.GetProperty("files").EnumerateArray().Select(f => f.GetProperty("name").GetString()!).ToArray());
        Assert.Contains("at most 2 files", await Refused(await Upload(StudentA, id, TestFiles.Pdf("v3"), "v3.pdf"), HttpStatusCode.Conflict));
    }

    [Fact]
    public async Task Taking_work_back_keeps_the_version_and_hides_it_from_the_instructor()
    {
        var due = Now.AddDays(1);
        var id = await AssignmentAsync(new { allowResubmission = true, dueAt = due });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "First try" }));
        var fileId = await UploadedAsync(StudentA, id, TestFiles.Pdf(), "er.pdf");
        Assert.False((await VerdictAsync(StudentA, id)).GetProperty("canUnsubmit").GetBoolean());
        Assert.Contains("can no longer be taken back", await Refused(await StudentA.PostAsync($"{Base}/{id}/unsubmit", null), HttpStatusCode.Conflict));
        var version = (await Json(await TurnIn(StudentA, id))).GetProperty("submission").GetProperty("id").GetInt64();
        Assert.True((await VerdictAsync(StudentA, id)).GetProperty("canUnsubmit").GetBoolean());
        Assert.Equal(1, (await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"))).GetProperty("items").GetArrayLength());

        var draft = await Json(await StudentA.PostAsync($"{Base}/{id}/unsubmit", null));
        Assert.Equal((2, "in_progress", "First try"), (draft.GetProperty("attemptNumber").GetInt32(), draft.GetProperty("status").GetString(), draft.GetProperty("text").GetString()));
        Assert.Equal(fileId, Assert.Single(draft.GetProperty("files").EnumerateArray().ToList()).GetProperty("id").GetInt64());
        var verdict = await VerdictAsync(StudentA, id);
        Assert.Equal(("draft", true, false), (verdict.GetProperty("state").GetString(), verdict.GetProperty("canTurnIn").GetBoolean(), verdict.GetProperty("canUnsubmit").GetBoolean()));

        // The student keeps both rows; the instructor gets neither the version nor its file.
        Assert.Equal(["withdrawn", "in_progress"], (await MineAsync(StudentA, id)).Select(s => s.GetProperty("status").GetString()!).ToArray());
        var list = await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"));
        Assert.Empty(list.GetProperty("items").EnumerateArray());
        Assert.Contains(list.GetProperty("missing").EnumerateArray(), s => s.GetProperty("studentId").GetString() == Lia);
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor.GetAsync($"{Base}/{id}/submissions/{version}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor.PutAsJsonAsync($"{Base}/{id}/submissions/{version}/grade", new { points = 5 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor.GetAsync($"/api/files/{fileId}")).StatusCode);
        Assert.Equal(0, (await Json(await Instructor.GetAsync($"{Base}/{id}"))).GetProperty("gradedCount").GetInt32());
        var overview = await Json(await Instructor.GetAsync("/api/me/overview"));
        Assert.DoesNotContain(overview.GetProperty("submissions").EnumerateArray(), s => s.GetProperty("courseworkId").GetInt64() == id);
        Assert.Equal(0, (await Json(await Instructor.PostAsJsonAsync($"{Base}/{id}/return", new { }))).GetProperty("returned").GetInt32());
        Assert.Equal("unsubmitted", (await Factory.WithDbAsync(db => db.AuditLog.OrderBy(a => a.Id).Select(a => a.Action).ToListAsync())).Last());

        // After the last day, the student counts as having handed in nothing.
        Factory.Time.Now = due.AddMinutes(1);
        var graded = await Json(await Instructor.PutAsJsonAsync($"{Base}/{id}/students/{Lia}/grade", new { points = 0 }));
        Assert.Equal((true, 3), (graded.GetProperty("notHandedIn").GetBoolean(), graded.GetProperty("attemptNumber").GetInt32()));
    }

    [Fact]
    public async Task Taken_back_work_can_be_turned_in_again()
    {
        var id = await AssignmentAsync(new { allowResubmission = true, dueAt = Now.AddDays(1) });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "First try" }));
        await Json(await TurnIn(StudentA, id));
        await Json(await StudentA.PostAsync($"{Base}/{id}/unsubmit", null));
        // A repeat of turn-in must not answer the receipt of the version that was taken back: there is a draft.
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Second try" }));
        var receipt = (await Json(await TurnIn(StudentA, id))).GetProperty("receipt");
        Assert.Equal(2, receipt.GetProperty("attemptNumber").GetInt32());
        var item = Assert.Single((await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"))).GetProperty("items").EnumerateArray().ToList());
        Assert.Equal("Second try", item.GetProperty("text").GetString());
        Assert.Equal(["withdrawn", "submitted"], (await MineAsync(StudentA, id)).Select(s => s.GetProperty("status").GetString()!).ToArray());
    }

    [Fact]
    public async Task Work_cannot_be_taken_back_once_graded_past_due_or_without_resubmission()
    {
        var due = Now.AddDays(1);
        var id = await AssignmentAsync(new { allowResubmission = true, allowLate = true, dueAt = due, gradeRelease = "returned" });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Lia's answer" }));
        var graded = (await Json(await TurnIn(StudentA, id))).GetProperty("submission").GetProperty("id").GetInt64();
        await Json(await Instructor.PutAsJsonAsync($"{Base}/{id}/submissions/{graded}/grade", new { points = 18 }));
        // The grade is held, so the work still looks ungraded to the student; the refusal doesn't say why.
        var verdict = await VerdictAsync(StudentA, id);
        Assert.Equal(("turned_in", false), (verdict.GetProperty("state").GetString(), verdict.GetProperty("canUnsubmit").GetBoolean()));
        var refusal = await Refused(await StudentA.PostAsync($"{Base}/{id}/unsubmit", null), HttpStatusCode.Conflict);
        Assert.Contains("can no longer be taken back", refusal);
        Assert.DoesNotContain("grade", refusal);

        await Json(await StudentB.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Max's answer" }));
        await Json(await TurnIn(StudentB, id));
        Factory.Time.Now = due.AddMinutes(1);
        Assert.Contains("can no longer be taken back", await Refused(await StudentB.PostAsync($"{Base}/{id}/unsubmit", null), HttpStatusCode.Conflict));

        Factory.Time.Now = due.AddHours(-1);
        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { allowResubmission = false }));
        Assert.Contains("can no longer be taken back", await Refused(await StudentB.PostAsync($"{Base}/{id}/unsubmit", null), HttpStatusCode.Conflict));
        Assert.Equal(HttpStatusCode.Forbidden, (await Instructor.PostAsync($"{Base}/{id}/unsubmit", null)).StatusCode);
    }

    // ------------------------------------------------------------------------- work turned in a moment ago stays as it was

    [Fact]
    public async Task An_upload_that_finishes_after_the_draft_was_turned_in_is_not_added_to_it()
    {
        var id = await AssignmentAsync();
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Done" }));
        // The student turns in while the file is still being scanned.
        Factory.Scanner.DuringScan = async () => await Json(await TurnIn(StudentA, id));
        var late = await Upload(StudentA, id, TestFiles.Pdf(), "late.pdf");
        Factory.Scanner.DuringScan = null;
        Assert.Contains("turned in a moment ago", await Refused(late, HttpStatusCode.Conflict));

        var turnedIn = Assert.Single(await MineAsync(StudentA, id));
        Assert.Equal("submitted", turnedIn.GetProperty("status").GetString());
        Assert.Empty(turnedIn.GetProperty("files").EnumerateArray());
        Assert.Equal((0, 0, 0), (await Factory.WithDbAsync(db => db.StoredFiles.CountAsync()), StoredFileCount(), PendingFileCount()));
    }

    [Fact]
    public async Task A_save_or_a_grade_that_read_the_row_before_it_changed_does_not_overwrite_it()
    {
        var id = await AssignmentAsync(new { allowResubmission = true });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Done" }));
        var draftId = (await MineAsync(StudentA, id))[0].GetProperty("id").GetInt64();

        // An autosave that loaded the draft, then the turn-in, then the autosave's write.
        await Factory.WithDbAsync(async stale =>
        {
            var row = await stale.Submissions.SingleAsync(s => s.Id == draftId);
            await Json(await TurnIn(StudentA, id));
            row.Text = "Typed after turning in";
            await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => stale.SaveChangesAsync());
            return 0;
        });
        Assert.Equal("Done", await Factory.WithDbAsync(db => db.Submissions.Where(s => s.Id == draftId).Select(s => s.Text).SingleAsync()));
        // The draft's files are locked the same way: once it is turned in, it is no longer a draft to add to or take from.
        Assert.False(await Factory.WithDbAsync(db => AssignmentFiles.LockDraftAsync(db, draftId, DateTime.UtcNow, CancellationToken.None)));

        // A grade that loaded the work, then the student took it back, then the grade's write: the version stays withdrawn and ungraded.
        await Factory.WithDbAsync(async stale =>
        {
            var row = await stale.Submissions.SingleAsync(s => s.Id == draftId);
            await Json(await StudentA.PostAsync($"{Base}/{id}/unsubmit", null));
            row.Status = SubmissionStatus.Graded;
            stale.Grades.Add(new Grade { SubmissionId = row.Id, Points = 20, GradedBy = Teacher });
            await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => stale.SaveChangesAsync());
            return 0;
        });
        Assert.Equal((SubmissionStatus.Withdrawn, 0), await Factory.WithDbAsync(async db => ((await db.Submissions.SingleAsync(s => s.Id == draftId)).Status, await db.Grades.CountAsync())));
    }

    [Fact]
    public async Task The_older_turn_in_route_checks_a_drafts_files_as_the_draft_route_does()
    {
        var id = await AssignmentAsync();
        await UploadedAsync(StudentA, id, TestFiles.Pdf("one"), "one.pdf");
        await UploadedAsync(StudentA, id, TestFiles.Pdf("two"), "two.pdf");
        await Json(await Instructor.PatchAsJsonAsync($"{Base}/{id}", new { maxFiles = 1 }));
        Assert.Contains("at most 1 file", await Refused(await StudentA.PostAsJsonAsync($"{Base}/{id}/submissions", new { text = "Here" }), HttpStatusCode.BadRequest));
        // Refused whole: still a draft, and its text was not replaced.
        var draft = Assert.Single(await MineAsync(StudentA, id));
        Assert.Equal(("in_progress", JsonValueKind.Null, 2), (draft.GetProperty("status").GetString(), draft.GetProperty("text").ValueKind, draft.GetProperty("files").GetArrayLength()));
    }

    // ------------------------------------------------------------------------- a held grade stays held everywhere

    [Fact]
    public async Task A_held_grade_does_not_show_in_the_students_gradebook_average()
    {
        var id = await AssignmentAsync(new { gradeRelease = "returned" });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Done" }));
        var submission = (await Json(await TurnIn(StudentA, id))).GetProperty("submission").GetProperty("id").GetInt64();
        await Json(await Instructor.PutAsJsonAsync($"{Base}/{id}/submissions/{submission}/grade", new { points = 5 }));

        JsonElement Activities(JsonElement gradebook) => gradebook.GetProperty("students").EnumerateArray().Single(s => s.GetProperty("studentId").GetString() == Lia).GetProperty("activities");
        var mine = Activities(await Json(await StudentA.GetAsync("/api/classes/class-a/gradebook")));
        Assert.Equal((0, JsonValueKind.Null), (mine.GetProperty("graded").GetInt32(), mine.GetProperty("average").ValueKind));
        // The instructor's gradebook counts it, and the student's does once it is returned.
        Assert.Equal(25m, Activities(await Json(await Instructor.GetAsync("/api/classes/class-a/gradebook"))).GetProperty("average").GetDecimal());
        await Json(await Instructor.PostAsJsonAsync($"{Base}/{id}/return", new { }));
        Assert.Equal(25m, Activities(await Json(await StudentA.GetAsync("/api/classes/class-a/gradebook"))).GetProperty("average").GetDecimal());
    }

    // ------------------------------------------------------------------------- §6 the same file from two students

    [Fact]
    public async Task The_instructor_is_told_when_two_students_hand_in_the_same_file()
    {
        var id = await AssignmentAsync();
        await UploadedAsync(StudentA, id, TestFiles.Pdf("shared"), "lia.pdf");
        await UploadedAsync(StudentA, id, TestFiles.Pdf("lia only"), "extra.pdf");
        await Json(await TurnIn(StudentA, id));
        await UploadedAsync(StudentB, id, TestFiles.Pdf("shared"), "max.pdf");

        // Max's copy is still a draft, so nothing is flagged yet.
        JsonElement[] Files(JsonElement list, string student) => list.GetProperty("items").EnumerateArray().Single(s => s.GetProperty("studentId").GetString() == student).GetProperty("files").EnumerateArray().ToArray();
        var before = await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"));
        Assert.All(Files(before, Lia), f => Assert.False(f.GetProperty("sameAsAnotherStudent").GetBoolean()));

        await Json(await TurnIn(StudentB, id));
        var after = await Json(await Instructor.GetAsync($"{Base}/{id}/submissions"));
        Assert.Equal([true, false], Files(after, Lia).Select(f => f.GetProperty("sameAsAnotherStudent").GetBoolean()).ToArray());
        Assert.True(Assert.Single(Files(after, Max)).GetProperty("sameAsAnotherStudent").GetBoolean());
        // Students are never told.
        Assert.All((await MineAsync(StudentA, id))[0].GetProperty("files").EnumerateArray(), f => Assert.Equal(JsonValueKind.Null, f.GetProperty("sameAsAnotherStudent").ValueKind));
    }

    // ------------------------------------------------------------------------- retention (D-042)

    [Fact]
    public async Task Retention_deletes_old_files_and_keeps_the_grade()
    {
        var id = await AssignmentAsync(new { submissionKinds = new[] { "text", "file", "link" } });
        await Json(await StudentA.PutAsJsonAsync($"{Base}/{id}/draft", new { text = "Answer", link = "https://example.edu/a" }));
        var fileId = await UploadedAsync(StudentA, id, TestFiles.Pdf(), "lia-abad-er.pdf");
        var submission = (await Json(await TurnIn(StudentA, id))).GetProperty("submission").GetProperty("id").GetInt64();
        await Json(await Instructor.PutAsJsonAsync($"{Base}/{id}/submissions/{submission}/grade", new { points = 17 }));

        // Three terms later the class is no longer offered, and another class is the current one.
        await Factory.WithDbAsync(async db =>
        {
            (await db.IsmsClasses.SingleAsync(c => c.Id == "class-a")).IsActive = false;
            db.IsmsClasses.Add(new IsmsClass { Id = "class-now", ScheduleId = "SCH-9", SubjectName = "Computing 2", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = true, SchoolYearId = 2, SemesterId = 2 });
            db.IsmsClasses.Add(new IsmsClass { Id = "class-mid", ScheduleId = "SCH-8", SubjectName = "Computing 2", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = false, SchoolYearId = 1, SemesterId = 2 });
            db.IsmsClasses.Add(new IsmsClass { Id = "class-mid2", ScheduleId = "SCH-7", SubjectName = "Computing 2", InstructorId = Teacher, InstructorName = "Ana Reyes", IsActive = false, SchoolYearId = 2, SemesterId = 1 });
            return await db.SaveChangesAsync();
        });
        var result = await Factory.WithServiceAsync<AttemptRetention, RetentionResult>(r => r.RunAsync(CancellationToken.None));
        Assert.Equal(new RetentionResult(1, 1, 0, 1), result);

        Assert.Equal(0, StoredFileCount());
        var (file, row, grade) = await Factory.WithDbAsync(async db => (await db.StoredFiles.SingleAsync(f => f.Id == fileId), await db.Submissions.SingleAsync(s => s.Id == submission), await db.Grades.SingleAsync(g => g.SubmissionId == submission)));
        Assert.Equal(("", true), (file.Name, file.DeletedAt is not null));
        Assert.Equal((null, null, true, 17m), (row.Text, row.Link, row.AnonymizedAt is not null, grade.Points));
        Assert.Equal(HttpStatusCode.NotFound, (await Instructor.GetAsync($"/api/files/{fileId}")).StatusCode);
        Assert.Contains("deleted 1 files", await Factory.WithDbAsync(db => db.AuditLog.Where(a => a.Category == "retention").Select(a => a.Summary).SingleAsync()));
    }

    // ------------------------------------------------------------------------- §9 configuration

    private static string Messages(Exception error)
    {
        var text = new StringBuilder();
        for (var e = error; e is not null; e = e.InnerException) text.Append(e.Message).Append(" | ");
        return text.ToString();
    }

    [Fact]
    public void Startup_fails_fast_without_a_scanner_or_a_folder_for_files()
    {
        using var noScanner = new LmsApiFactory().With("Lms:Files:Scanner", "");
        Assert.Contains("Lms:Files:Scanner is not set", Messages(Assert.ThrowsAny<Exception>(() => noScanner.CreateClient())));
        using var none = new LmsApiFactory().With("Lms:Files:Scanner", "none");
        Assert.Contains("allowed only in Development and Demo mode", Messages(Assert.ThrowsAny<Exception>(() => none.CreateClient())));
        using var unknown = new LmsApiFactory().With("Lms:Files:Scanner", "defender");
        Assert.Contains("Use clamav", Messages(Assert.ThrowsAny<Exception>(() => unknown.CreateClient())));
        using var noRoot = new LmsApiFactory().With("Lms:Files:Root", "");
        Assert.Contains("Lms:Files:Root is not set", Messages(Assert.ThrowsAny<Exception>(() => noRoot.CreateClient())));
    }
}
