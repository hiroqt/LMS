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
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionOption> QuestionOptions => Set<QuestionOption>();
    public DbSet<QuestionExpectedAnswer> QuestionExpectedAnswers => Set<QuestionExpectedAnswer>();
    public DbSet<Coursework> Coursework => Set<Coursework>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<SubmissionAnswer> SubmissionAnswers => Set<SubmissionAnswer>();
    public DbSet<Grade> Grades => Set<Grade>();
    public DbSet<GradebookSetting> GradebookSettings => Set<GradebookSetting>();
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

        b.Entity<Question>(e =>
        {
            e.ToTable("questions");
            e.HasKey(x => x.Id);
            e.Property(x => x.Type).HasMaxLength(30).IsRequired();
            e.Property(x => x.Prompt).IsRequired();
            e.Property(x => x.Points).HasPrecision(8, 2);
            e.HasOne<Questionnaire>().WithMany().HasForeignKey(x => x.QuestionnaireId).OnDelete(DeleteBehavior.Cascade);
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
            e.Property(x => x.MaxPoints).HasPrecision(8, 2);
            e.Property(x => x.Status).HasMaxLength(20).IsRequired();
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
            e.HasOne<Coursework>().WithMany().HasForeignKey(x => x.CourseworkId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.CourseworkId, x.StudentId, x.AttemptNumber }).IsUnique();
            e.HasIndex(x => x.StudentId);
        });

        b.Entity<SubmissionAnswer>(e =>
        {
            e.ToTable("submission_answers");
            e.HasKey(x => x.Id);
            e.Property(x => x.PointsAwarded).HasPrecision(8, 2);
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

        b.Entity<GradebookSetting>(e =>
        {
            e.ToTable("gradebook_settings");
            e.HasKey(x => x.ClassId);
            e.Property(x => x.ClassId).HasMaxLength(ClassIdLength);
            e.HasOne<IsmsClass>().WithMany().HasForeignKey(x => x.ClassId).OnDelete(DeleteBehavior.Restrict);
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
