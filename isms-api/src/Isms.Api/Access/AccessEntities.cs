namespace Isms.Api.Access;

public static class ClientStatus
{
    public const string Active = "active";
    public const string Disabled = "disabled";
}

public sealed class ApiClient
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Status { get; set; } = ClientStatus.Active;
    public DateTime CreatedAt { get; set; }

    public List<ApiClientKey> Keys { get; set; } = [];
    public List<ApiClientPermission> Permissions { get; set; } = [];
}

public sealed class ApiClientKey
{
    public int Id { get; set; }
    public int ClientId { get; set; }
    /// <summary>First 8 characters of the key; used to find candidate keys, never enough to authenticate.</summary>
    public string KeyPrefix { get; set; } = "";
    /// <summary>Lowercase hex SHA-256 of the full key. The key itself is never stored.</summary>
    public string KeyHash { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
}

public sealed class ApiClientPermission
{
    public int ClientId { get; set; }
    public string Permission { get; set; } = "";
}

public sealed class ApiRequestLog
{
    public long Id { get; set; }
    public DateTime Timestamp { get; set; }
    public string? ClientUsername { get; set; }
    public string Method { get; set; } = "";
    public string Path { get; set; } = "";
    public string? RequiredPermission { get; set; }
    public int StatusCode { get; set; }
    public string? RemoteIp { get; set; }
}
