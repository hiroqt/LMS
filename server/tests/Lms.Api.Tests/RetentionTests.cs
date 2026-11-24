using Lms.Api.Data;
using Lms.Api.Submissions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace Lms.Api.Tests;

/// <summary>Contract §7: attempts of old terms are anonymized; scores and grades stay.</summary>
public sealed class RetentionTests : IDisposable
{
    private readonly LmsApiFactory _factory = new();
    public void Dispose() => _factory.Dispose();

    [Fact]
    public void Terms_more_than_the_setting_behind_the_current_one_expire()
    {
        Term[] known = [new(1, 1), new(1, 2), new(2, 1), new(2, 2), new(3, 1)];
        Assert.Equal([new Term(1, 1), new Term(1, 2)], AttemptRetention.ExpiredTerms(known, new Term(3, 1), 2));
        Assert.Empty(AttemptRetention.ExpiredTerms(known, new Term(2, 1), 2));
        Assert.Equal([new Term(1, 1), new Term(1, 2), new Term(2, 1)], AttemptRetention.ExpiredTerms(known, new Term(3, 1), 1));
        Assert.Equal(4, AttemptRetention.ExpiredTerms(known, new Term(3, 1), 0).Count);
    }

    /// <summary>A class of the given term with one exam attempt (text, essay, items) and an assignment submission.</summary>
    private static async Task<(long Attempt, long Assignment)> ClassWithWorkAsync(LmsDbContext db, string id, int year, int semester, bool active)
    {
        db.IsmsClasses.Add(new IsmsClass { Id = id, ScheduleId = id, SubjectName = "Computing", InstructorId = "EMP-1", InstructorName = "Ana Reyes", IsActive = active, SchoolYearId = year, SemesterId = semester });
        var module = new Module { ClassId = id, Title = "Unit 1" };
        db.Modules.Add(module);
        var set = new Questionnaire { OwnerInstructorId = "EMP-1", Title = "Quiz" };
        db.Questionnaires.Add(set);
        await db.SaveChangesAsync();
        var question = new Question { QuestionnaireId = set.Id, Type = QuestionType.Identification, Prompt = "Who?", Points = 2, SortOrder = 1 };
        db.Questions.Add(question);
        var exam = new Data.Coursework { ClassId = id, ModuleId = module.Id, Type = CourseworkType.Exam, Title = "Quiz", QuestionnaireId = set.Id, Status = CourseworkStatus.Closed };
        var task = new Data.Coursework { ClassId = id, ModuleId = module.Id, Type = CourseworkType.Assignment, Title = "Essay", Status = CourseworkStatus.Closed };
        db.Coursework.AddRange(exam, task);
        await db.SaveChangesAsync();
        var attempt = new Submission { CourseworkId = exam.Id, StudentId = "STU-1", Status = SubmissionStatus.Graded, SubmittedAt = DateTime.UtcNow };
        var essay = new Submission { CourseworkId = task.Id, StudentId = "STU-1", Status = SubmissionStatus.Graded, SubmittedAt = DateTime.UtcNow, Text = "My essay about Lia.", FileName = "lia-abad-essay.pdf" };
        db.Submissions.AddRange(attempt, essay);
        await db.SaveChangesAsync();
        db.SubmissionAnswers.Add(new SubmissionAnswer { SubmissionId = attempt.Id, QuestionId = question.Id, AnswerText = "Babbage", PointsAwarded = 2, MatchNote = MatchNote.Exact });
        db.Grades.AddRange(new Grade { SubmissionId = attempt.Id, Points = 2, GradedBy = "auto" }, new Grade { SubmissionId = essay.Id, Points = 18, GradedBy = "EMP-1", Feedback = "Good" });
        await db.SaveChangesAsync();
        return (attempt.Id, essay.Id);
    }

    [Fact]
    public async Task Old_attempts_lose_their_text_but_keep_scores_and_grades()
    {
        var (old, oldEssay, recent, current) = await _factory.WithDbAsync(async db =>
        {
            var o = await ClassWithWorkAsync(db, "old", 1, 1, active: false);
            var r = await ClassWithWorkAsync(db, "recent", 1, 2, active: false);
            await ClassWithWorkAsync(db, "between", 2, 1, active: false);
            var c = await ClassWithWorkAsync(db, "current", 2, 2, active: true);
            return (o.Attempt, o.Assignment, r.Attempt, c.Attempt);
        });

        var result = await _factory.WithServiceAsync<AttemptRetention, RetentionResult>(r => r.RunAsync(CancellationToken.None));
        Assert.Equal(new RetentionResult(1, 1, 1), result);

        await _factory.WithDbAsync(async db =>
        {
            var answer = await db.SubmissionAnswers.SingleAsync(a => a.SubmissionId == old);
            Assert.Null(answer.AnswerText);
            Assert.Equal(2m, answer.PointsAwarded);
            var essay = await db.Submissions.SingleAsync(s => s.Id == oldEssay);
            Assert.Equal((null, null), (essay.Text, essay.FileName));
            Assert.Equal(18m, (await db.Grades.SingleAsync(g => g.SubmissionId == oldEssay)).Points);
            Assert.NotNull((await db.Submissions.SingleAsync(s => s.Id == old)).AnonymizedAt);
            Assert.Null((await db.Submissions.SingleAsync(s => s.Id == recent)).AnonymizedAt);
            Assert.Equal("Babbage", (await db.SubmissionAnswers.SingleAsync(a => a.SubmissionId == recent)).AnswerText);
            Assert.Equal("Babbage", (await db.SubmissionAnswers.SingleAsync(a => a.SubmissionId == current)).AnswerText);
            var audit = await db.AuditLog.SingleAsync(a => a.Category == "retention");
            Assert.DoesNotContain("Babbage", audit.Summary);
            return 0;
        });

        // A second run finds nothing left to clear.
        Assert.Equal(new RetentionResult(1, 0, 0), await _factory.WithServiceAsync<AttemptRetention, RetentionResult>(r => r.RunAsync(CancellationToken.None)));
    }

    [Fact]
    public async Task Nothing_is_touched_when_no_class_is_offered()
    {
        await _factory.WithDbAsync(async db => (await ClassWithWorkAsync(db, "old", 1, 1, active: false), await ClassWithWorkAsync(db, "later", 3, 1, active: false)));
        Assert.Equal(new RetentionResult(0, 0, 0), await _factory.WithServiceAsync<AttemptRetention, RetentionResult>(r => r.RunAsync(CancellationToken.None)));
        Assert.Equal(2, await _factory.WithDbAsync(db => db.SubmissionAnswers.CountAsync(a => a.AnswerText != null)));
    }

    [Fact]
    public void Demo_mode_has_no_retention_job_and_the_API_runs_it_by_default()
    {
        var dir = Path.Combine(Path.GetTempPath(), $"lms-demo-test-{Guid.NewGuid():N}");
        try
        {
            using var demo = new Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program>().WithWebHostBuilder(b => b
                .UseEnvironment("Demo").UseSetting("Lms:Demo:DataDirectory", dir));
            Assert.DoesNotContain(demo.Services.GetServices<IHostedService>(), s => s is RetentionWorker);
        }
        finally
        {
            try { Directory.Delete(dir, recursive: true); } catch (IOException) { }
        }
        Assert.Contains(_factory.Services.GetServices<IHostedService>(), s => s is RetentionWorker);
        Assert.Equal(2, _factory.Services.GetRequiredService<IOptions<RetentionOptions>>().Value.AttemptTerms);
    }
}
