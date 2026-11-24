using System.Threading.RateLimiting;
using Lms.Api.Demo;
using Lms.Api.Identity;
using Microsoft.Extensions.Options;

namespace Lms.Api.Files;

public sealed class ClamAvOptions
{
    public string Host { get; set; } = "127.0.0.1";
    public int Port { get; set; } = 3310;
    /// <summary>For one whole scan.</summary>
    public int TimeoutSeconds { get; set; } = 60;
}

public sealed class FileOptions
{
    public const string SectionName = "Lms:Files";
    public const string Clamav = "clamav";
    public const string None = "none";
    public const string UploadPolicy = "uploads";

    /// <summary>The folder file bytes are kept in. Required outside Development and Demo.</summary>
    public string? Root { get; set; }
    /// <summary><c>clamav</c> or <c>none</c>. Required outside Development and Demo, where <c>none</c> is refused.</summary>
    public string? Scanner { get; set; }
    public ClamAvOptions ClamAv { get; set; } = new();
    /// <summary>Uploads one student may make per minute.</summary>
    public int UploadsPerMinute { get; set; } = 20;
}

public static class FileServices
{
    /// <summary>
    /// Registers the file store, the scanner and the upload rate limit. Like a missing connection
    /// string, a missing storage folder or scanner stops the API from starting (D-055): outside
    /// Development and Demo, files are never accepted unscanned.
    /// </summary>
    public static void AddLmsFiles(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment, DemoOptions demo)
    {
        var section = configuration.GetSection(FileOptions.SectionName);
        var options = section.Get<FileOptions>() ?? new FileOptions();
        services.Configure<FileOptions>(section);
        var relaxed = environment.IsDevelopment() || demo.Enabled;

        var scanner = options.Scanner?.Trim().ToLowerInvariant() is { Length: > 0 } chosen ? chosen : relaxed ? FileOptions.None : null;
        switch (scanner)
        {
            case FileOptions.Clamav:
                services.AddSingleton<IFileScanner, ClamAvScanner>();
                break;
            case FileOptions.None when relaxed:
                services.AddSingleton<IFileScanner, NoScanner>();
                break;
            case FileOptions.None:
                throw new InvalidOperationException("Lms:Files:Scanner is \"none\", which is allowed only in Development and Demo mode. Set Lms__Files__Scanner=clamav and point Lms:Files:ClamAv:Host and Port at clamd.");
            case null:
                throw new InvalidOperationException("Lms:Files:Scanner is not set. Set Lms__Files__Scanner=clamav and point Lms:Files:ClamAv:Host and Port at clamd; student files are never accepted unscanned.");
            default:
                throw new InvalidOperationException($"Lms:Files:Scanner is \"{options.Scanner}\". Use clamav (or none, in Development and Demo mode only).");
        }

        if (demo.Enabled)
        {
            // Each sandbox keeps its files in its own folder, beside its database.
            services.AddScoped<IFileStore>(sp => new DiskFileStore(DemoDatabases.FilesDirectory(demo,
                DemoDatabases.SandboxOf(sp.GetRequiredService<IHttpContextAccessor>().HttpContext))));
        }
        else
        {
            var root = !string.IsNullOrWhiteSpace(options.Root) ? options.Root
                : environment.IsDevelopment() ? Path.Combine(environment.ContentRootPath, "App_Data", "files")
                : throw new InvalidOperationException("Lms:Files:Root is not set. Set Lms__Files__Root to the folder where student files are kept (outside the web root, backed up, writable by the API only).");
            services.AddSingleton<IFileStore>(_ => new DiskFileStore(root));
        }

        services.AddRateLimiter(limiter =>
        {
            limiter.OnRejected = async (context, ct) =>
            {
                context.HttpContext.Response.Headers.RetryAfter = "60";
                await TypedResults.Problem(statusCode: StatusCodes.Status429TooManyRequests, title: "Too many uploads. Wait a minute and try again.").ExecuteAsync(context.HttpContext);
            };
            // One window per person (and per sandbox in Demo mode); without an identity, per address.
            limiter.AddPolicy(FileOptions.UploadPolicy, http =>
            {
                var who = http.Request.Headers[DemoIdentity.UserHeader].ToString() is { Length: > 0 and <= 64 } id ? id : http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                var perMinute = Math.Max(1, http.RequestServices.GetRequiredService<IOptions<FileOptions>>().Value.UploadsPerMinute);
                return RateLimitPartition.GetFixedWindowLimiter($"{DemoDatabases.SandboxOf(http)}|{who}", _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = perMinute, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true,
                });
            });
        });
    }
}
