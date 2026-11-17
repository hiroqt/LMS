using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Lms.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Lms.Api.Tests;

/// <summary>Contract §1–§2: the new types, sections, and incomplete sets.</summary>
public sealed class QuestionSetTests : AssessmentTestBase
{
    [Fact]
    public async Task A_set_stores_sections_and_the_new_types()
    {
        await SeedAsync();
        var id = await SetAsync(EveryType());
        var set = await Json(await Instructor.GetAsync($"/api/questionnaires/{id}"));

        var sections = set.GetProperty("sections").EnumerateArray().ToList();
        Assert.Equal(["Test I. Choose", "Test II. Write"], sections.Select(s => s.GetProperty("title").GetString()!).ToArray());
        Assert.Equal("Choose the best answer.", sections[0].GetProperty("directions").GetString());
        Assert.Equal(1m, sections[0].GetProperty("defaultPoints").GetDecimal());
        Assert.Equal(JsonValueKind.Null, sections[1].GetProperty("defaultPoints").ValueKind);

        var q = set.GetProperty("questions").EnumerateArray().ToList();
        Assert.Equal(sections[0].GetProperty("id").GetInt64(), q[0].GetProperty("sectionId").GetInt64());
        Assert.Equal(sections[1].GetProperty("id").GetInt64(), q[3].GetProperty("sectionId").GetInt64());

        var mtf = q[2];
        Assert.Equal("modified_true_false", mtf.GetProperty("type").GetString());
        Assert.Equal("CPU", mtf.GetProperty("underlined").GetString());
        Assert.Equal(["True", "False"], mtf.GetProperty("options").EnumerateArray().Select(o => o.GetProperty("text").GetString()!).ToArray());
        Assert.True(mtf.GetProperty("options")[1].GetProperty("isCorrect").GetBoolean());
        Assert.Equal(["storage", "hard disk"], mtf.GetProperty("expectedAnswers").EnumerateArray().Select(a => a.GetString()!).ToArray());
        Assert.Equal(["Charles Babbage", "Babbage"], q[3].GetProperty("expectedAnswers").EnumerateArray().Select(a => a.GetString()!).ToArray());
        Assert.All(q, x => Assert.False(x.GetProperty("incomplete").GetBoolean()));
        Assert.All(q, x => Assert.Equal(0, x.GetProperty("problems").GetArrayLength()));
        Assert.Equal(JsonValueKind.Null, q[0].GetProperty("underlined").ValueKind);
    }

    [Fact]
    public async Task Omitted_sections_save_one_unnamed_section_and_flags_are_kept()
    {
        await SeedAsync();
        var id = await SetAsync(new { questions = new object[] { new { type = "identification", prompt = "Symbol of carbon monoxide.", points = 1, expectedAnswers = new[] { "CO" }, caseSensitive = true, alwaysStrict = true } } });
        var set = await Json(await Instructor.GetAsync($"/api/questionnaires/{id}"));
        var section = Assert.Single(set.GetProperty("sections").EnumerateArray());
        Assert.Equal("", section.GetProperty("title").GetString());
        var q = set.GetProperty("questions")[0];
        Assert.Equal(section.GetProperty("id").GetInt64(), q.GetProperty("sectionId").GetInt64());
        Assert.True(q.GetProperty("caseSensitive").GetBoolean());
        Assert.True(q.GetProperty("alwaysStrict").GetBoolean());
    }

    [Fact]
    public async Task The_underlined_phrase_must_appear_in_the_prompt_and_a_false_statement_needs_corrections()
    {
        await SeedAsync();
        var id = (await Json(await Instructor.PostAsJsonAsync("/api/questionnaires", new { title = "Set" }))).GetProperty("id").GetInt64();
        var bad = await Instructor.PutAsJsonAsync($"/api/questionnaires/{id}/questions", new
        {
            questions = new object[]
            {
                new { type = "modified_true_false", prompt = "The CPU stores data.", points = 1, underlined = "RAM", correctAnswer = true },
                new { type = "modified_true_false", prompt = "The cpu stores data.", points = 1, underlined = "CPU", correctAnswer = false },
                new { type = "identification", prompt = "Who?", points = 1, expectedAnswers = Array.Empty<string>() },
            },
        });
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        var errors = (await Problem(bad)).GetProperty("errors");
        Assert.True(errors.TryGetProperty("questions[0].underlined", out _));
        Assert.False(errors.TryGetProperty("questions[1].underlined", out _));   // ignoring case
        Assert.True(errors.TryGetProperty("questions[1].expectedAnswers", out _));
        Assert.True(errors.TryGetProperty("questions[2].expectedAnswers", out _));
    }

    [Fact]
    public async Task Allow_incomplete_saves_content_problems_but_refuses_structural_ones()
    {
        await SeedAsync();
        var id = (await Json(await Instructor.PostAsJsonAsync("/api/questionnaires", new { title = "Draft" }))).GetProperty("id").GetInt64();

        var unknown = await Instructor.PutAsJsonAsync($"/api/questionnaires/{id}/questions", new { allowIncomplete = true, questions = new object[] { new { type = "riddle", prompt = "?", points = 1 } } });
        Assert.Equal(HttpStatusCode.BadRequest, unknown.StatusCode);
        var section = await Instructor.PutAsJsonAsync($"/api/questionnaires/{id}/questions", new { allowIncomplete = true, questions = new object[] { new { type = "essay", prompt = "?", points = 1, section = 1 } } });
        Assert.True((await Problem(section)).GetProperty("errors").TryGetProperty("questions[0].section", out _));
        var tooMany = await Instructor.PutAsJsonAsync($"/api/questionnaires/{id}/questions", new { allowIncomplete = true, questions = Enumerable.Range(0, 201).Select(_ => new { type = "essay", prompt = "?", points = 1 }).ToArray() });
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);

        var saved = await Json(await Instructor.PutAsJsonAsync($"/api/questionnaires/{id}/questions", new
        {
            allowIncomplete = true,
            questions = new object[]
            {
                new { type = "multiple_choice", prompt = "  Pick one  ", points = 2, options = new[] { new { text = " a ", isCorrect = false }, new { text = "b", isCorrect = false } } },
                new { type = "identification", prompt = " ", points = (decimal?)null },
                new { type = "essay", prompt = "Fine", points = 5000 },
            },
        }));
        var q = saved.GetProperty("questions").EnumerateArray().ToList();
        Assert.True(q[0].GetProperty("incomplete").GetBoolean());
        Assert.Equal("Pick one", q[0].GetProperty("prompt").GetString());
        Assert.Equal("a", q[0].GetProperty("options")[0].GetProperty("text").GetString());
        Assert.Equal(["Mark exactly one choice as correct."], q[0].GetProperty("problems").EnumerateArray().Select(p => p.GetString()!).ToArray());
        Assert.Equal(0m, q[1].GetProperty("points").GetDecimal());
        Assert.Equal(3, q[1].GetProperty("problems").GetArrayLength());   // prompt, points, answers
        Assert.Equal(1000m, q[2].GetProperty("points").GetDecimal());       // clamped
        Assert.True(q[2].GetProperty("incomplete").GetBoolean());

        var list = await Json(await Instructor.GetAsync("/api/questionnaires"));
        Assert.Equal(3, list[0].GetProperty("incompleteCount").GetInt32());

        // Without allowIncomplete, the same content is refused as before.
        var strict = await Instructor.PutAsJsonAsync($"/api/questionnaires/{id}/questions", new { questions = new object[] { new { type = "essay", prompt = " ", points = 1 } } });
        Assert.Equal(HttpStatusCode.BadRequest, strict.StatusCode);
    }

    [Fact]
    public async Task A_set_saved_before_sections_gets_one_unnamed_section_when_loaded()
    {
        await SeedAsync();
        var id = await Factory.WithDbAsync(async db =>
        {
            var set = new Questionnaire { OwnerInstructorId = Teacher, Title = "Old set" };
            db.Questionnaires.Add(set);
            await db.SaveChangesAsync();
            db.Questions.Add(new Question { QuestionnaireId = set.Id, Type = QuestionType.Essay, Prompt = "Old", Points = 1, SortOrder = 1 });
            await db.SaveChangesAsync();
            return set.Id;
        });
        var loaded = await Json(await Instructor.GetAsync($"/api/questionnaires/{id}"));
        var section = Assert.Single(loaded.GetProperty("sections").EnumerateArray());
        Assert.Equal(section.GetProperty("id").GetInt64(), loaded.GetProperty("questions")[0].GetProperty("sectionId").GetInt64());
        Assert.Equal(1, await Factory.WithDbAsync(db => db.QuestionSections.CountAsync(s => s.QuestionnaireId == id)));
        await Json(await Instructor.GetAsync($"/api/questionnaires/{id}"));
        Assert.Equal(1, await Factory.WithDbAsync(db => db.QuestionSections.CountAsync(s => s.QuestionnaireId == id)));
    }

    [Fact]
    public async Task Copying_a_set_copies_its_sections_and_new_fields()
    {
        await SeedAsync();
        var id = await SetAsync(EveryType());
        var copy = await Json(await Instructor.PostAsync($"/api/questionnaires/{id}/copy", null));
        var sections = copy.GetProperty("sections").EnumerateArray().ToList();
        Assert.Equal(["Test I. Choose", "Test II. Write"], sections.Select(s => s.GetProperty("title").GetString()!).ToArray());
        var original = await Json(await Instructor.GetAsync($"/api/questionnaires/{id}"));
        Assert.NotEqual(original.GetProperty("sections")[0].GetProperty("id").GetInt64(), sections[0].GetProperty("id").GetInt64());
        var q = copy.GetProperty("questions").EnumerateArray().ToList();
        Assert.Equal(sections[1].GetProperty("id").GetInt64(), q[3].GetProperty("sectionId").GetInt64());
        Assert.Equal("CPU", q[2].GetProperty("underlined").GetString());
        Assert.Equal(2, q[2].GetProperty("expectedAnswers").GetArrayLength());
    }
}
