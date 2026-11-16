using System.Threading.RateLimiting;
using Isms.Api.Access;
using Isms.Api.Cli;
using Isms.Api.Features.Calendar;
using Isms.Api.Features.Instructors;
using Isms.Api.Features.Schedules;
using Isms.Api.Features.Subjects;
using Isms.Api.Isms;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

// `clients ...` runs the management command line instead of the web server. CLI arguments are
// kept out of the configuration system so options like --name are not read as settings.
var isCli = args.Length > 0 && args[0] == "clients";
var builder = WebApplication.CreateBuilder(isCli ? new WebApplicationOptions() : new WebApplicationOptions { Args = args });

static string GetRequiredConnectionString(IConfiguration config, string name) =>
    config.GetConnectionString(name) is { Length: > 0 } value
        ? value
        : throw new InvalidOperationException(
            $"Connection string '{name}' is not configured. Set ConnectionStrings:{name} with user-secrets or the environment variable ConnectionStrings__{name}.");

string RequiredConnectionString(string name) => GetRequiredConnectionString(builder.Configuration, name);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddDbContext<ApiAccessDbContext>(o => o.UseMySQL(RequiredConnectionString("IsmsApiDb")));
builder.Services.AddDbContext<IsmsDbContext>(o => o.UseMySQL(RequiredConnectionString("IsmsDb")));
builder.Services.AddScoped<ClientAdmin>();

if (isCli)
{
    builder.Logging.SetMinimumLevel(LogLevel.Warning);
    using var cliApp = builder.Build();
    try
    {
        GetRequiredConnectionString(cliApp.Configuration, "IsmsApiDb");
    }
    catch (InvalidOperationException ex)
    {
        Console.Error.WriteLine("Error: " + ex.Message);
        return 1;
    }
    using var scope = cliApp.Services.CreateScope();
    return await ClientCli.RunAsync(args[1..], scope.ServiceProvider.GetRequiredService<ClientAdmin>(), Console.Out, Console.Error);
}

builder.Services.AddScoped<CalendarService>();
builder.Services.AddScoped<SubjectService>();
builder.Services.AddScoped<InstructorService>();
builder.Services.AddScoped<ScheduleService>();

builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

builder.Services.AddAuthentication(ApiKeyAuthenticationHandler.SchemeName)
    .AddScheme<ApiKeyAuthenticationOptions, ApiKeyAuthenticationHandler>(ApiKeyAuthenticationHandler.SchemeName, null);
builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, PermissionAuthorizationHandler>();
builder.Services.AddAuthorizationBuilder().AddPermissionPolicies();

// Rate limit per authenticated client; unauthenticated callers are limited per IP.
builder.Services.AddRateLimiter(o =>
{
    o.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
    {
        var permitsPerMinute = ctx.RequestServices.GetRequiredService<IConfiguration>()
            .GetValue("RateLimiting:PermitsPerMinute", 120);
        var key = ctx.User.Identity?.IsAuthenticated == true
            ? "client:" + ctx.User.Identity.Name
            : "ip:" + ctx.Connection.RemoteIpAddress;
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = permitsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        });
    });
    o.OnRejected = (ctx, _) =>
    {
        ctx.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        return new ValueTask(Results.Problem(new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Too many requests.",
        }).ExecuteAsync(ctx.HttpContext));
    };
});

var app = builder.Build();

// Fail fast at startup rather than on the first request.
GetRequiredConnectionString(app.Configuration, "IsmsDb");
GetRequiredConnectionString(app.Configuration, "IsmsApiDb");

app.UseExceptionHandler();
app.UseStatusCodePages();
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}
app.UseMiddleware<RequestLogMiddleware>();
app.UseRouting();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous().ExcludeFromDescription();
}

// Read-only API: GET routes only. Each declares exactly one permission via RequirePermission.
var v1 = app.MapGroup("/v1");
v1.MapCalendarEndpoints();
v1.MapSubjectEndpoints();
v1.MapInstructorEndpoints();
v1.MapScheduleEndpoints();

app.Run();
return 0;

public partial class Program;
