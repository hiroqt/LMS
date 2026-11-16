using Microsoft.EntityFrameworkCore;

namespace Isms.Api.Isms;

/// <summary>
/// Read-only view of the ISMS database. Queries are no-tracking by default and
/// any attempt to save changes throws, so this API can never write to ISMS even if
/// the database account were (wrongly) given write access.
/// </summary>
public sealed class IsmsDbContext(DbContextOptions<IsmsDbContext> options) : DbContext(options)
{
    public IQueryable<Subject> Subjects => Set<Subject>().AsNoTracking();
    public IQueryable<Employee> Employees => Set<Employee>().AsNoTracking();
    public IQueryable<SchoolYear> SchoolYears => Set<SchoolYear>().AsNoTracking();
    public IQueryable<Semester> Semesters => Set<Semester>().AsNoTracking();
    public IQueryable<Section> Sections => Set<Section>().AsNoTracking();
    public IQueryable<Schedule> Schedules => Set<Schedule>().AsNoTracking();
    public IQueryable<ScheduleItem> ScheduleItems => Set<ScheduleItem>().AsNoTracking();
    public IQueryable<ScheduleStudent> ScheduleStudents => Set<ScheduleStudent>().AsNoTracking();
    public IQueryable<Enrollment> Enrollments => Set<Enrollment>().AsNoTracking();
    public IQueryable<Student> Students => Set<Student>().AsNoTracking();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        => optionsBuilder.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);

    public override int SaveChanges(bool acceptAllChangesOnSuccess) => throw ReadOnly();

    public override Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
        => throw ReadOnly();

    private static InvalidOperationException ReadOnly() => new("The ISMS database is read-only for this API.");

    // Table and column names copied exactly from the ISMS schema.
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Subject>(e =>
        {
            e.ToTable("subjects_tbl");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("ID");
            e.Property(x => x.Name).HasColumnName("Name").HasMaxLength(120);
            e.Property(x => x.ShortCode).HasColumnName("ShortCode").HasMaxLength(12);
            e.Property(x => x.Units).HasColumnName("Units");
            e.Property(x => x.Status).HasColumnName("Status").HasMaxLength(1).IsFixedLength();
        });

        b.Entity<Employee>(e =>
        {
            e.ToTable("employees_tbl");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("ID");
            e.Property(x => x.RefId).HasColumnName("RefID").HasMaxLength(45);
            e.Property(x => x.EmpNo).HasColumnName("EmpNo").HasMaxLength(45);
            e.Property(x => x.Fname).HasColumnName("FName").HasMaxLength(45);
            e.Property(x => x.Mname).HasColumnName("MName").HasMaxLength(45);
            e.Property(x => x.Lname).HasColumnName("LName").HasMaxLength(45);
            e.Property(x => x.Suffix).HasColumnName("Suffix").HasMaxLength(45);
            e.Property(x => x.Honorific).HasColumnName("Honorific").HasMaxLength(45);
            e.Property(x => x.DepartmentId).HasColumnName("DepartmentID").HasMaxLength(45);
            e.Property(x => x.Status).HasColumnName("Status").HasMaxLength(1).IsFixedLength();
        });

        b.Entity<SchoolYear>(e =>
        {
            e.ToTable("schoolyear_tbl");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("ID");
            e.Property(x => x.Syfrom).HasColumnName("SYFrom");
            e.Property(x => x.Syto).HasColumnName("SYTo");
            e.Property(x => x.Standing).HasColumnName("Standing").HasMaxLength(1).IsFixedLength();
            e.Property(x => x.Status).HasColumnName("Status").HasMaxLength(2).IsFixedLength();
        });

        b.Entity<Semester>(e =>
        {
            e.ToTable("semester_tbl");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("ID");
            e.Property(x => x.Name).HasColumnName("Name").HasMaxLength(45);
            e.Property(x => x.StandingId).HasColumnName("StandingID").HasMaxLength(1).IsFixedLength();
            e.Property(x => x.Status).HasColumnName("Status").HasMaxLength(1).IsFixedLength();
        });

        b.Entity<Section>(e =>
        {
            e.ToTable("educsections_tbl");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("ID");
            e.Property(x => x.Name).HasColumnName("Name").HasMaxLength(45);
        });

        b.Entity<Schedule>(e =>
        {
            e.ToTable("schedules_tbl");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("ID");
            e.Property(x => x.RefId).HasColumnName("RefID").HasMaxLength(45);
            e.Property(x => x.SyId).HasColumnName("SYID");
            e.Property(x => x.SemesterId).HasColumnName("SemesterID");
            e.Property(x => x.SectionId).HasColumnName("SectionID");
            e.Property(x => x.Status).HasColumnName("Status").HasMaxLength(1).IsFixedLength();
        });

        b.Entity<ScheduleItem>(e =>
        {
            e.ToTable("scheduleitems_tbl");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("ID");
            e.Property(x => x.RefId).HasColumnName("RefID").HasMaxLength(45);
            e.Property(x => x.SubjectId).HasColumnName("SubjectID");
            e.Property(x => x.InstructorId).HasColumnName("InstructorID").HasMaxLength(45);
            e.Property(x => x.RoomId).HasColumnName("RoomID");
            e.Property(x => x.Modality).HasColumnName("Modality");
            e.Property(x => x.DayId).HasColumnName("DayID").HasMaxLength(45);
            e.Property(x => x.TimeFrom).HasColumnName("TimeFrom").HasColumnType("time");
            e.Property(x => x.TimeTo).HasColumnName("TimeTo").HasColumnType("time");
        });

        b.Entity<ScheduleStudent>(e =>
        {
            e.ToTable("schedulestudents_tbl");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("ID");
            e.Property(x => x.RefId).HasColumnName("RefID").HasMaxLength(45);
            e.Property(x => x.EnrollmentId).HasColumnName("EnrollmentID").HasMaxLength(45);
        });

        b.Entity<Enrollment>(e =>
        {
            e.ToTable("enrollments_tbl");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("ID");
            e.Property(x => x.RefId).HasColumnName("RefID").HasMaxLength(45);
            e.Property(x => x.StudentId).HasColumnName("StudentID").HasMaxLength(45);
        });

        b.Entity<Student>(e =>
        {
            e.ToTable("students_tbl");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("ID");
            e.Property(x => x.RefId).HasColumnName("RefID").HasMaxLength(45);
            e.Property(x => x.Fname).HasColumnName("FName").HasMaxLength(45);
            e.Property(x => x.Mname).HasColumnName("MName").HasMaxLength(45);
            e.Property(x => x.Lname).HasColumnName("LName").HasMaxLength(45);
        });
    }
}
