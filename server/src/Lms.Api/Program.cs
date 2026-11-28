using Lms.Api.Attendance;
using Lms.Api.Content;
using Lms.Api.Coursework;
using Lms.Api.Submissions;
using Lms.Api.Data;
using Lms.Api.Demo;
using Lms.Api.Endpoints;
using Lms.Api.Files;
using Lms.Api.Import;
using Lms.Api.Isms;
using Lms.Api.Me;
using Lms.Api.Meetings;
using Lms.Api.Rubrics;
using Lms.Api.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Cors.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<IsmsExceptionHandler>();
builder.Services.AddExceptionHandler<ConcurrencyExceptionHandler>();
builder.Services.AddExceptionHandler<MeetingExceptionHandler>();
builder.Services.AddOpenApi();
// Demo mode (Development tooling and browser tests only): SQLite per sandbox and a built-in fake
// ISMS, so the API runs with no MySQL and no ISMS API. See Demo/DemoMode.cs.
var demo = builder.Configuration.GetSection(DemoOptions.SectionName).Get<DemoOptions>() ?? new DemoOptions();
builder.Services.AddSingleton<SyncState>();
if (demo.Enabled)
{
    builder.Services.AddDemoMode(demo);
    builder.Services.AddScoped<IsmsReferenceSync>();
}
else
{
    builder.Services.AddIsms(builder.Configuration);

    // The LMS's own database (lmsdb). The connection string comes from user-secrets or the
    // environment variable ConnectionStrings__LmsDb, never from a committed file.
    var lmsDb = builder.Configuration.GetConnectionString("LmsDb");
    if (string.IsNullOrWhiteSpace(lmsDb))
        throw new InvalidOperationException(
            "ConnectionStrings:LmsDb is not set. Run `dotnet user-secrets set ConnectionStrings:LmsDb \"Server=127.0.0.1;Port=3307;Database=lmsdb;User=lms_api_rw;Password=<password>;\"` in server/src/Lms.Api, or set ConnectionStrings__LmsDb.");
    builder.Services.AddDbContext<LmsDbContext>(o => o.UseMySQL(lmsDb));
    builder.Services.AddScoped<IsmsReferenceSync>();
    builder.Services.Configure<SyncOptions>(builder.Configuration.GetSection(SyncOptions.SectionName));
    builder.Services.AddHostedService<IsmsSyncWorker>();
    // Daily anonymizing of old attempts (D-042). Not registered in Demo mode.
    builder.Services.Configure<RetentionOptions>(builder.Configuration.GetSection(RetentionOptions.SectionName));
    builder.Services.AddScoped<AttemptRetention>();
    builder.Services.AddHostedService<RetentionWorker>();
}
builder.Services.AddScoped<ClassAccess>();
// Student uploads (D-055): the file store, the virus scanner and the upload rate limit.
builder.Services.AddHttpContextAccessor();
builder.Services.AddLmsFiles(builder.Configuration, builder.Environment, demo);
// Class meetings on the media server (D-072); off without Lms:Meet settings.
builder.Services.AddLmsMeetings(builder.Configuration);

// CORS origins come from Cors:AllowedOrigins (only http://localhost:5173 in Development).
// Read lazily so test hosts and environment overrides apply. Never allow-any-origin.
builder.Services.AddCors();
builder.Services.AddOptions<CorsOptions>().Configure<IConfiguration>((cors, config) =>
{
    var origins = config.GetSection("Cors:AllowedOrigins").Get<string[]>()?
        .Where(o => !string.IsNullOrWhiteSpace(o) && o.Trim() != "*")
        .Select(o => o.Trim().TrimEnd('/'))
        .ToArray() ?? [];

    cors.AddDefaultPolicy(policy => policy
        .WithOrigins(origins)
        .WithMethods(HttpMethods.Get, HttpMethods.Post, HttpMethods.Put, HttpMethods.Patch, HttpMethods.Delete)
        .AllowAnyHeader()
        // Lets the browser read the import template's file name.
        .WithExposedHeaders("Content-Disposition"));
});

// Calendar days late are counted in the school's time zone (D-062).
if (builder.Configuration["Lms:TimeZone"] is { Length: > 0 } zone) LatePenalty.Zone = TimeZoneInfo.FindSystemTimeZoneById(zone);

var app = builder.Build();

if (demo.Enabled)
    app.UseDemoMode();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors();
app.UseRateLimiter();

app.MapLmsEndpoints();
app.MapContentEndpoints();
// Class material files and their previews (D-067).
app.MapMaterialFileEndpoints();
app.MapQuestionnaireEndpoints();
app.MapImportEndpoints();
app.MapAnswerKeyEndpoints();
app.MapCourseworkEndpoints();
app.MapSubmissionEndpoints();
app.MapDraftEndpoints();
app.MapFileEndpoints();
app.MapExceptionEndpoints();
app.MapRubricEndpoints();
app.MapCommentBankEndpoints();
app.MapDownloadEndpoints();
app.MapAccuracyEndpoints();
app.MapGradebookEndpoints();
app.MapAttendanceEndpoints();
app.MapOverviewEndpoints();
// Class meetings and the media server's webhooks (D-072).
app.MapMeetingEndpoints();
app.MapMeetingWebhookEndpoints();

app.Run();

public partial class Program;
