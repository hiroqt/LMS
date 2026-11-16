using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace Isms.Api.Access;

public sealed class ClientAdminException(string message) : Exception(message);

/// <summary>Result of issuing a key. <see cref="Key"/> exists only in memory and is shown once.</summary>
public sealed record IssuedKey(string Username, string Key, string KeyPrefix, DateTime ExpiresAt);

public sealed record ClientSummary(
    string Username, string DisplayName, string Status, DateTime CreatedAt,
    IReadOnlyList<string> Permissions, IReadOnlyList<KeySummary> Keys);

public sealed record KeySummary(string KeyPrefix, DateTime CreatedAt, DateTime ExpiresAt, DateTime? RevokedAt, DateTime? LastUsedAt);

/// <summary>Client and key management used by the <c>clients</c> command line.</summary>
public sealed partial class ClientAdmin(ApiAccessDbContext db, TimeProvider clock)
{
    public const int DefaultExpiryDays = 30;
    public const int MaxExpiryDays = 366;

    [GeneratedRegex("^[a-z0-9][a-z0-9._-]{1,63}$")]
    private static partial Regex UsernamePattern();

    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    public async Task<IssuedKey> CreateAsync(string username, string displayName, IEnumerable<string> permissions, int expiresDays)
    {
        if (!UsernamePattern().IsMatch(username))
            throw new ClientAdminException("Username must be 2-64 chars: lowercase letters, digits, '.', '_' or '-'.");
        var perms = ValidatePermissions(permissions);
        if (await db.Clients.AnyAsync(c => c.Username == username))
            throw new ClientAdminException($"Client '{username}' already exists.");

        var client = new ApiClient
        {
            Username = username,
            DisplayName = string.IsNullOrWhiteSpace(displayName) ? username : displayName.Trim(),
            Status = ClientStatus.Active,
            CreatedAt = Now,
            Permissions = perms.Select(p => new ApiClientPermission { Permission = p }).ToList(),
        };
        var issued = AddKey(client, expiresDays);
        db.Clients.Add(client);
        await db.SaveChangesAsync();
        return issued;
    }

    public async Task<IssuedKey> RotateAsync(string username, int expiresDays, bool revokeOld)
    {
        var client = await FindAsync(username, includeKeys: true);
        if (revokeOld)
        {
            foreach (var key in client.Keys.Where(k => k.RevokedAt == null))
                key.RevokedAt = Now;
        }
        var issued = AddKey(client, expiresDays);
        await db.SaveChangesAsync();
        return issued;
    }

    public async Task RevokeKeyAsync(string username, string keyPrefix)
    {
        var client = await FindAsync(username, includeKeys: true);
        var keys = client.Keys.Where(k => k.KeyPrefix == keyPrefix && k.RevokedAt == null).ToList();
        if (keys.Count == 0)
            throw new ClientAdminException($"Client '{username}' has no unrevoked key with prefix '{keyPrefix}'.");
        foreach (var key in keys)
            key.RevokedAt = Now;
        await db.SaveChangesAsync();
    }

    public async Task GrantAsync(string username, IEnumerable<string> permissions)
    {
        var perms = ValidatePermissions(permissions);
        var client = await FindAsync(username, includePermissions: true);
        foreach (var p in perms.Where(p => client.Permissions.All(x => x.Permission != p)))
            client.Permissions.Add(new ApiClientPermission { Permission = p });
        await db.SaveChangesAsync();
    }

    public async Task UngrantAsync(string username, IEnumerable<string> permissions)
    {
        var perms = ValidatePermissions(permissions);
        var client = await FindAsync(username, includePermissions: true);
        client.Permissions.RemoveAll(p => perms.Contains(p.Permission));
        await db.SaveChangesAsync();
    }

    public async Task SetStatusAsync(string username, string status)
    {
        var client = await FindAsync(username);
        client.Status = status;
        await db.SaveChangesAsync();
    }

    public async Task<IReadOnlyList<ClientSummary>> ListAsync()
    {
        var clients = await db.Clients.AsNoTracking()
            .Include(c => c.Keys).Include(c => c.Permissions)
            .OrderBy(c => c.Username)
            .ToListAsync();
        return clients.Select(c => new ClientSummary(
            c.Username, c.DisplayName, c.Status, c.CreatedAt,
            c.Permissions.Select(p => p.Permission).Order().ToList(),
            c.Keys.OrderBy(k => k.CreatedAt)
                .Select(k => new KeySummary(k.KeyPrefix, k.CreatedAt, k.ExpiresAt, k.RevokedAt, k.LastUsedAt))
                .ToList())).ToList();
    }

    private IssuedKey AddKey(ApiClient client, int expiresDays)
    {
        if (expiresDays is < 1 or > MaxExpiryDays)
            throw new ClientAdminException($"--expires-days must be between 1 and {MaxExpiryDays}.");
        var key = ApiKeys.Generate();
        var entity = new ApiClientKey
        {
            KeyPrefix = ApiKeys.PrefixOf(key),
            KeyHash = ApiKeys.Hash(key),
            CreatedAt = Now,
            ExpiresAt = Now.AddDays(expiresDays),
        };
        client.Keys.Add(entity);
        return new IssuedKey(client.Username, key, entity.KeyPrefix, entity.ExpiresAt);
    }

    private async Task<ApiClient> FindAsync(string username, bool includeKeys = false, bool includePermissions = false)
    {
        IQueryable<ApiClient> query = db.Clients;
        if (includeKeys) query = query.Include(c => c.Keys);
        if (includePermissions) query = query.Include(c => c.Permissions);
        return await query.SingleOrDefaultAsync(c => c.Username == username)
            ?? throw new ClientAdminException($"Client '{username}' not found.");
    }

    private static List<string> ValidatePermissions(IEnumerable<string> permissions)
    {
        var perms = permissions.Select(p => p.Trim()).Where(p => p.Length > 0).Distinct().ToList();
        var unknown = perms.Where(p => !Permissions.IsKnown(p)).ToList();
        if (unknown.Count > 0)
            throw new ClientAdminException(
                $"Unknown permission(s): {string.Join(", ", unknown)}. Known: {string.Join(", ", Permissions.All)}.");
        return perms;
    }
}
