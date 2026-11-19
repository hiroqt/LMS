using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Lms.Api.Data;

/// <summary>
/// The LMS database. Tables and columns are snake_case so they read naturally in MySQL
/// Workbench. Every LMS-owned row records who created and last changed it.
/// </summary>
public sealed class LmsDbContext(DbContextOptions<LmsDbContext> options, TimeProvider? time = null) : DbContext(options)
{
    public const string SystemActor = "system";

    private readonly TimeProvider _time = time ?? TimeProvider.System;

    /// <summary>Recorded as created_by / updated_by on the next save.</summary>
    public string Actor { get; set; } = SystemActor;

    public DbSet<IsmsClass> IsmsClasses => Set<IsmsClass>();
    public DbSet<IsmsClassStudent> IsmsClassStudents => Set<IsmsClassStudent>();
    public DbSet<Module> Modules => Set<Module>();
    public DbSet<Material> Materials => Set<Material>();
    public DbSet<Announcement> Announcements => Set<Announcement>();
    public DbSet<Questionnaire> Questionnaires => Set<Questionnaire>();
    public DbSet<QuestionSection> QuestionSections => Set<QuestionSection>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionOption> QuestionOptions => Set<QuestionOption>();
    public DbSet<QuestionExpectedAnswer> QuestionExpectedAnswers => Set<QuestionExpectedAnswer>();
    public DbSet<Coursework> Coursework => Set<Coursework>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<SubmissionAnswer> SubmissionAnswers => Set<SubmissionAnswer>();
    public DbSet<StoredFile> StoredFiles => Set<StoredFile>();
    public DbSet<SubmissionFile> SubmissionFiles => Set<SubmissionFile>();
    public DbSet<Grade> Grades => Set<Grade>();
    public DbSet<CourseworkException> CourseworkExceptions => Set<CourseworkException>();
    public DbSet<Rubric> Rubrics => Set<Rubric>();
    public DbSet<RubricCriterion> RubricCriteria => Set<RubricCriterion>();
    public DbSet<RubricLevel> RubricLevels => Set<RubricLevel>();
    public DbSet<GradeRubricScore> GradeRubricScores => Set<GradeRubricScore>();
    public DbSet<SavedComment> SavedComments => Set<SavedComment>();
    public DbSet<GradebookSetting> GradebookSettings => Set<GradebookSetting>();
    public DbSet<AttendanceMonth> AttendanceMonths => Set<AttendanceMonth>();
    public DbSet<AttendanceEntry> AttendanceEntries => Set<AttendanceEntry>();
    public DbSet<AuditLogEntry> AuditLog => Set<AuditLogEntry>();

    private const int IdLength = 64;       // ISMS reference ids (students, employees, schedules)
    private const int ClassIdLength = 200;  // LMS class ids
    private const int TitleLength = 250;

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<IsmsClass>(e =>
        {
            e.ToTable("isms_classes");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasMaxLength(ClassIdLength);
            e.Property(x => x.ScheduleId).HasMaxLength(IdLength).IsRequired();
            e.Property(x => x.SubjectCode).HasMaxLength(32);
            e.Property(x => x.SubjectName).HasMaxLength(TitleLength).IsRequired();
            e.Property(x => x.SectionName).HasMaxLength(100);
            e.Property(x => x.InstructorId).HasMaxLength(IdLength).IsRequired();
            e.Property(x => x.InstructorName).HasMaxLength(200).IsRequired();
            e.Property(x => x.TermName).HasMaxLength(100);
            e.Property(x => x.MeetingsJson).IsRequired();
            e.HasIndex(x => x.InstructorId);
            e.HasIndex(x => new { x.SchoolYearId, x.SemesterId });
        });

        b.Entity<IsmsClassStudent>(e =>
        {
            e.ToTable("isms_class_students");
            e.HasKey(x => new { x.ClassId, x.StudentId });
            e.Property(x => x.ClassId).HasMaxLength(ClassIdLength);
            e.Property(x => x.StudentId).HasMaxLength(IdLength);
            e.Property(x => x.EnrollmentId).HasMaxLength(IdLength).IsRequired();
            e.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
            e.Property(x => x.MiddleName).HasMaxLength(100).IsRequired();
            e.Property(x => x.LastName).HasMaxLength(100).IsRequired();
            e.HasOne<IsmsClass>().WithMany().HasForeignKey(x => x.ClassId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.StudentId);
        });

        b.Entity<Module>(e =>
        {
            e.ToTable("modules");
            ClassOwned(e, x => x.ClassId);
            e.Property(x => x.Title).HasMaxLength(TitleLength).IsRequired();
            e.HasOne<Module>().WithMany().HasForeignKey(x => x.ParentModuleId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Material>(e =>
        {
            e.ToTable("materials");
            ClassOwned(e, x => x.ClassId);
            e.Property(x => x.Title).HasMaxLength(TitleLength).IsRequired();
            e.Property(x => x.Kind).HasMaxLength(50).IsRequired();
            e.Property(x => x.FileName).HasMaxLength(255);
            e.Property(x => x.FileType).HasMaxLength(20);
            e.Property(x => x.FileSize).HasMaxLength(20);
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.HasOne<Module>().WithMany().HasForeignKey(x => x.ModuleId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Announcement>(e =>
        {
            e.ToTable("announcements");
            ClassOwned(e, x => x.ClassId);
            e.Property(x => x.Title).HasMaxLength(120).IsRequired();
            e.Property(x => x.Message).HasMaxLength(1200).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
        });

        b.Entity<Questionnaire>(e =>
        {
            e.ToTable("questionnaires");
            e.HasKey(x => x.Id);
            e.Property(x => x.OwnerInstructorId).HasMaxLength(IdLength).IsRequired();
            e.Property(x => x.Title).HasMaxLength(TitleLength).IsRequired();
            e.HasIndex(x => x.OwnerInstructorId);
        });

        b.Entity<QuestionSection>(e =>
        {
            e.ToTable("question_sections");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Directions).HasMaxLength(2000);
            e.Property(x => x.DefaultPoints).HasPrecision(8, 2);
            e.HasOne<Questionnaire>().WithMany().HasForeignKey(x => x.QuestionnaireId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Question>(e =>
        {
            e.ToTable("questions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Type).HasMaxLength(30).IsRequired();
            e.Property(x => x.Prompt).IsRequired();
            e.Property(x => x.Points).HasPrecision(8, 2);
            e.Property(x => x.Underlined).HasMaxLength(1000);
            e.HasOne<Questionnaire>().WithMany().HasForeignKey(x => x.QuestionnaireId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<QuestionSection>().WithMany().HasForeignKey(x => x.SectionId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<QuestionOption>(e =>
        {
            e.ToTable("question_options");
            e.HasKey(x => x.Id);
            e.Property(x => x.Text).IsRequired();
            e.HasOne<Question>().WithMany().HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<QuestionExpectedAnswer>(e =>
        {
            e.ToTable("question_expected_answers");
            e.HasKey(x => x.Id);
            e.Property(x => x.AnswerText).HasMaxLength(1000).IsRequired();
            e.HasOne<Question>().WithMany().HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Coursework>(e =>
        {
            e.ToTable("coursework");
            ClassOwned(e, x => x.ClassId);
            e.Property(x => x.Type).HasMaxLength(20).IsRequired();
            e.Property(x => x.Title).HasMaxLength(TitleLength).IsRequired();
            e.Property(x => x.Description).HasMaxLength(1000);
            e.Property(x => x.Category).HasMaxLength(40);
            e.Property(x => x.MaxPoints).HasPrecision(8, 2);
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            // Existing exams keep today's behavior: which questions were right, strict spelling.
            e.Property(x => x.AnswerReview).HasMaxLength(30).IsRequired().HasDefaultValue(AnswerReview.Results);
            e.Property(x => x.SpellingMode).HasMaxLength(20).IsRequired().HasDefaultValue(SpellingMode.Strict);
            e.Property(x => x.GradeRelease).HasMaxLength(20).IsRequired().HasDefaultValue(GradeRelease.Immediate);
            // Existing assignments keep taking what the old form took: text and a file.
            e.Property(x => x.SubmissionKinds).HasMaxLength(40).IsRequired().HasDefaultValue(SubmissionKind.Default);
            e.Property(x => x.AllowedFileTypes).HasMaxLength(80);
            e.Property(x => x.MaxFiles).HasDefaultValue(5);
            e.Property(x => x.LatePenaltyMaxPercent).HasDefaultValue(100);
            e.HasOne<Rubric>().WithMany().HasForeignKey(x => x.RubricId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Module>().WithMany().HasForeignKey(x => x.ModuleId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Questionnaire>().WithMany().HasForeignKey(x => x.QuestionnaireId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<Submission>(e =>
        {
            e.ToTable("submissions");
            e.HasKey(x => x.Id);
            e.Property(x => x.StudentId).HasMaxLength(IdLength).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
            e.Property(x => x.FileName).HasMaxLength(255);
            e.Property(x => x.Link).HasMaxLength(2000);
            e.HasOne<Coursework>().WithMany().HasForeignKey(x => x.CourseworkId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.CourseworkId, x.StudentId, x.AttemptNumber }).IsUnique();
            e.HasIndex(x => x.StudentId);
        });

        b.Entity<StoredFile>(e =>
        {
            e.ToTable("stored_files");
            ClassOwned(e, x => x.ClassId);
            e.Property(x => x.OwnerId).HasMaxLength(IdLength).IsRequired();
            e.Property(x => x.StorageKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Name).HasMaxLength(255).IsRequired();
            e.Property(x => x.ContentType).HasMaxLength(120).IsRequired();
            e.Property(x => x.ContentHash).HasMaxLength(64).IsRequired();
            e.Property(x => x.ScanStatus).HasMaxLength(20).IsRequired();
            e.HasOne<Coursework>().WithMany().HasForeignKey(x => x.CourseworkId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.StorageKey).IsUnique();
            // "The same file from two students" is looked up per assignment.
            e.HasIndex(x => new { x.CourseworkId, x.ContentHash });
        });

        b.Entity<SubmissionFile>(e =>
        {
            e.ToTable("submission_files");
            e.HasKey(x => new { x.SubmissionId, x.FileId });
            e.HasOne<Submission>().WithMany().HasForeignKey(x => x.SubmissionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<StoredFile>().WithMany().HasForeignKey(x => x.FileId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => x.FileId);
        });

        b.Entity<SubmissionAnswer>(e =>
        {
            e.ToTable("submission_answers");
            e.HasKey(x => x.Id);
            e.Property(x => x.PointsAwarded).HasPrecision(8, 2);
            e.Property(x => x.ManualPoints).HasPrecision(8, 2);
            e.Property(x => x.MatchNote).HasMaxLength(20);
            e.Property(x => x.SpellingDecision).HasMaxLength(20);
            e.HasOne<Submission>().WithMany().HasForeignKey(x => x.SubmissionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Question>().WithMany().HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<QuestionOption>().WithMany().HasForeignKey(x => x.SelectedOptionId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.SubmissionId, x.QuestionId }).IsUnique();
        });

        b.Entity<Grade>(e =>
        {
            e.ToTable("grades");
            e.HasKey(x => x.Id);
            e.Property(x => x.Points).HasPrecision(8, 2);
            e.Property(x => x.GradedBy).HasMaxLength(IdLength).IsRequired();
            e.HasOne<Submission>().WithMany().HasForeignKey(x => x.SubmissionId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.SubmissionId).IsUnique();
        });

        b.Entity<CourseworkException>(e =>
        {
            e.ToTable("coursework_exceptions");
            e.HasKey(x => x.Id);
            e.Property(x => x.StudentId).HasMaxLength(IdLength).IsRequired();
            e.HasOne<Coursework>().WithMany().HasForeignKey(x => x.CourseworkId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.CourseworkId, x.StudentId }).IsUnique();
            e.HasIndex(x => x.StudentId);
        });

        b.Entity<Rubric>(e =>
        {
            e.ToTable("rubrics");
            ClassOwned(e, x => x.ClassId);
            e.Property(x => x.Title).HasMaxLength(120).IsRequired();
        });

        b.Entity<RubricCriterion>(e =>
        {
            e.ToTable("rubric_criteria");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(120).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
            e.HasOne<Rubric>().WithMany().HasForeignKey(x => x.RubricId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<RubricLevel>(e =>
        {
            e.ToTable("rubric_levels");
            e.HasKey(x => x.Id);
            e.Property(x => x.Title).HasMaxLength(60).IsRequired();
            e.Property(x => x.Description).HasMaxLength(500);
            e.Property(x => x.Points).HasPrecision(8, 2);
            e.HasOne<RubricCriterion>().WithMany().HasForeignKey(x => x.CriterionId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<GradeRubricScore>(e =>
        {
            e.ToTable("grade_rubric_scores");
            e.HasKey(x => new { x.GradeId, x.CriterionId });
            e.Property(x => x.Points).HasPrecision(8, 2);
            e.HasOne<Grade>().WithMany().HasForeignKey(x => x.GradeId).OnDelete(DeleteBehavior.Cascade);
            // A criterion or level that a grade used can't be deleted: that is what locks the rubric.
            e.HasOne<RubricCriterion>().WithMany().HasForeignKey(x => x.CriterionId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<RubricLevel>().WithMany().HasForeignKey(x => x.LevelId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<SavedComment>(e =>
        {
            e.ToTable("saved_comments");
            e.HasKey(x => x.Id);
            e.Property(x => x.OwnerInstructorId).HasMaxLength(IdLength).IsRequired();
            e.Property(x => x.Text).HasMaxLength(500).IsRequired();
            e.HasIndex(x => x.OwnerInstructorId);
        });

        b.Entity<GradebookSetting>(e =>
        {
            e.ToTable("gradebook_settings");
            e.HasKey(x => x.ClassId);
            e.Property(x => x.ClassId).HasMaxLength(ClassIdLength);
            e.HasOne<IsmsClass>().WithMany().HasForeignKey(x => x.ClassId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<AttendanceMonth>(e =>
        {
            e.ToTable("attendance_months");
            e.HasKey(x => x.Id);
            e.Property(x => x.ClassId).HasMaxLength(ClassIdLength).IsRequired();
            e.HasOne<IsmsClass>().WithMany().HasForeignKey(x => x.ClassId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.ClassId, x.Year, x.Month }).IsUnique();
            e.HasMany(x => x.Entries).WithOne().HasForeignKey(x => x.AttendanceMonthId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<AttendanceEntry>(e =>
        {
            e.ToTable("attendance_entries");
            e.HasKey(x => x.Id);
            e.Property(x => x.StudentId).HasMaxLength(IdLength).IsRequired();
            e.HasIndex(x => new { x.AttendanceMonthId, x.StudentId }).IsUnique();
            e.HasIndex(x => x.StudentId);
        });

        b.Entity<AuditLogEntry>(e =>
        {
            e.ToTable("audit_log");
            e.HasKey(x => x.Id);
            e.Property(x => x.ActorId).HasMaxLength(IdLength).IsRequired();
            e.Property(x => x.ActorRole).HasMaxLength(20).IsRequired();
            e.Property(x => x.Category).HasMaxLength(40).IsRequired();
            e.Property(x => x.Action).HasMaxLength(40).IsRequired();
            e.Property(x => x.Target).HasMaxLength(60).IsRequired();
            e.Property(x => x.TargetId).HasMaxLength(ClassIdLength);
            e.Property(x => x.Summary).HasMaxLength(300).IsRequired();
            e.HasIndex(x => x.CreatedAt);
        });

        var utc = new ValueConverter<DateTime, DateTime>(value => value,
            value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
        foreach (var entity in b.Model.GetEntityTypes())
        {
            if (typeof(Audited).IsAssignableFrom(entity.ClrType))
            {
                b.Entity(entity.ClrType).Property(nameof(Audited.CreatedBy)).HasMaxLength(IdLength);
                b.Entity(entity.ClrType).Property(nameof(Audited.UpdatedBy)).HasMaxLength(IdLength);
            }
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(SnakeCase(property.Name));
                if ((Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType) == typeof(DateTime))
                    property.SetValueConverter(utc);
            }
            foreach (var key in entity.GetKeys())
                key.SetName(key.GetDefaultName());
        }
    }

    /// <summary>Rows that belong to a class: long id, class FK, and an index for listing by class.</summary>
    private static void ClassOwned<T>(Microsoft.EntityFrameworkCore.Metadata.Builders.EntityTypeBuilder<T> e, System.Linq.Expressions.Expression<Func<T, string>> classId)
        where T : class
    {
        var name = ((System.Linq.Expressions.MemberExpression)classId.Body).Member.Name;
        e.HasKey("Id");
        e.Property(classId).HasMaxLength(ClassIdLength).IsRequired();
        e.HasOne<IsmsClass>().WithMany().HasForeignKey(name).OnDelete(DeleteBehavior.Restrict);
        e.HasIndex(name);
    }

    internal static string SnakeCase(string name)
    {
        var sb = new StringBuilder(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            var c = name[i];
            if (char.IsUpper(c))
            {
                if (i > 0 && (char.IsLower(name[i - 1]) || (i + 1 < name.Length && char.IsLower(name[i + 1]) && char.IsUpper(name[i - 1]))))
                    sb.Append('_');
                sb.Append(char.ToLowerInvariant(c));
            }
            else sb.Append(c);
        }
        return sb.ToString();
    }

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        Stamp();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        Stamp();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    private void Stamp()
    {
        var now = _time.GetUtcNow().UtcDateTime;
        foreach (var entry in ChangeTracker.Entries<AuditLogEntry>())
            if (entry.State == EntityState.Added && entry.Entity.CreatedAt == default)
                entry.Entity.CreatedAt = now;
        foreach (var entry in ChangeTracker.Entries<Audited>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAt = now;
                entry.Entity.CreatedBy ??= Actor;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAt = now;
                entry.Entity.UpdatedBy = Actor;
            }
        }
    }
}

/// <summary>
/// Used only by <c>dotnet ef</c>. Reads ConnectionStrings:LmsDb from user-secrets or the
/// environment; creating a migration needs no live database.
/// </summary>
internal sealed class LmsDbContextDesignTimeFactory : IDesignTimeDbContextFactory<LmsDbContext>
{
    public LmsDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .AddUserSecrets<LmsDbContextDesignTimeFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();
        var connectionString = config.GetConnectionString("LmsDb") is { Length: > 0 } value
            ? value
            : "Server=127.0.0.1;Port=3307;Database=lmsdb;User=lms_api_rw;Password=design-time-only;";
        return new LmsDbContext(new DbContextOptionsBuilder<LmsDbContext>().UseMySQL(connectionString).Options);
    }
}
