using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Isms.Api.Access;

/// <summary>This API's own tables: clients, their keys and permissions, and the request log.</summary>
public sealed class ApiAccessDbContext(DbContextOptions<ApiAccessDbContext> options) : DbContext(options)
{
    public DbSet<ApiClient> Clients => Set<ApiClient>();
    public DbSet<ApiClientKey> ClientKeys => Set<ApiClientKey>();
    public DbSet<ApiClientPermission> ClientPermissions => Set<ApiClientPermission>();
    public DbSet<ApiRequestLog> RequestLogs => Set<ApiRequestLog>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<ApiClient>(e =>
        {
            e.ToTable("api_clients");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Username).HasColumnName("username").HasMaxLength(64).IsRequired();
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.DisplayName).HasColumnName("display_name").HasMaxLength(200).IsRequired();
            e.Property(x => x.Status).HasColumnName("status").HasMaxLength(16).IsRequired();
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.HasMany(x => x.Keys).WithOne().HasForeignKey(k => k.ClientId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Permissions).WithOne().HasForeignKey(p => p.ClientId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<ApiClientKey>(e =>
        {
            e.ToTable("api_client_keys");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.ClientId).HasColumnName("client_id");
            e.Property(x => x.KeyPrefix).HasColumnName("key_prefix").HasMaxLength(8).IsRequired();
            e.Property(x => x.KeyHash).HasColumnName("key_hash").HasMaxLength(64).IsRequired();
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
            e.Property(x => x.ExpiresAt).HasColumnName("expires_at");
            e.Property(x => x.RevokedAt).HasColumnName("revoked_at");
            e.Property(x => x.LastUsedAt).HasColumnName("last_used_at");
            e.HasIndex(x => new { x.ClientId, x.KeyPrefix });
        });

        b.Entity<ApiClientPermission>(e =>
        {
            e.ToTable("api_client_permissions");
            e.HasKey(x => new { x.ClientId, x.Permission });
            e.Property(x => x.ClientId).HasColumnName("client_id");
            e.Property(x => x.Permission).HasColumnName("permission").HasMaxLength(64);
        });

        b.Entity<ApiRequestLog>(e =>
        {
            e.ToTable("api_request_logs");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Timestamp).HasColumnName("timestamp");
            e.Property(x => x.ClientUsername).HasColumnName("client_username").HasMaxLength(64);
            e.Property(x => x.Method).HasColumnName("method").HasMaxLength(16).IsRequired();
            e.Property(x => x.Path).HasColumnName("path").HasMaxLength(512).IsRequired();
            e.Property(x => x.RequiredPermission).HasColumnName("required_permission").HasMaxLength(64);
            e.Property(x => x.StatusCode).HasColumnName("status_code");
            e.Property(x => x.RemoteIp).HasColumnName("remote_ip").HasMaxLength(45);
            e.HasIndex(x => x.Timestamp);
        });
    }
}

/// <summary>
/// Used by <c>dotnet ef</c> only. Reads the same configuration as the app (user-secrets in
/// Development, environment variables). For <c>migrations add</c> no real connection is needed,
/// so a password-less placeholder is used when nothing is configured.
/// </summary>
internal sealed class ApiAccessDbContextDesignTimeFactory : IDesignTimeDbContextFactory<ApiAccessDbContext>
{
    public ApiAccessDbContext CreateDbContext(string[] args)
    {
        var config = new ConfigurationBuilder()
            .AddJsonFile("appsettings.json", optional: true)
            .AddUserSecrets<ApiAccessDbContextDesignTimeFactory>(optional: true)
            .AddEnvironmentVariables()
            .Build();
        var connectionString = config.GetConnectionString("IsmsApiDb")
            ?? "server=localhost;port=3307;database=ismsapi_dev;user=isms_api_rw";
        var options = new DbContextOptionsBuilder<ApiAccessDbContext>().UseMySQL(connectionString).Options;
        return new ApiAccessDbContext(options);
    }
}
