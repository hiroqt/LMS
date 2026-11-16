using Lms.Api.Data;
using Lms.Api.Endpoints;
using Lms.Api.Isms;
using Lms.Api.Sync;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Cors.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<IsmsExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddIsms(builder.Configuration);

// The LMS's own database (lmsdb). The connection string comes from user-secrets or the
// environment variable ConnectionStrings__LmsDb, never from a committed file.
var lmsDb = builder.Configuration.GetConnectionString("LmsDb");
if (string.IsNullOrWhiteSpace(lmsDb))
    throw new InvalidOperationException(
        "ConnectionStrings:LmsDb is not set. Run `dotnet user-secrets set ConnectionStrings:LmsDb \"Server=127.0.0.1;Port=3307;Database=lmsdb;User=lms_api_rw;Password=<password>;\"` in server/src/Lms.Api, or set ConnectionStrings__LmsDb.");
builder.Services.AddDbContext<LmsDbContext>(o => o.UseMySQL(lmsDb));
builder.Services.AddScoped<IsmsReferenceSync>();
builder.Services.AddSingleton<SyncState>();
builder.Services.Configure<SyncOptions>(builder.Configuration.GetSection(SyncOptions.SectionName));
builder.Services.AddHostedService<IsmsSyncWorker>();

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
        .WithMethods(HttpMethods.Get)
        .AllowAnyHeader());
});

var app = builder.Build();

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

app.MapLmsEndpoints();
// The role picker and instructor header are demo selectors, not authentication.
if (app.Environment.IsDevelopment())
    
app.Run();

public partial class Program;
