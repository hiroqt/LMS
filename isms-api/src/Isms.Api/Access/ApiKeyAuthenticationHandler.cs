using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Isms.Api.Access;

public sealed class ApiKeyAuthenticationOptions : AuthenticationSchemeOptions;

/// <summary>
/// Check 1 of 2: is this client's username + key valid? Reads <c>X-Client-Id</c> and
/// <c>X-Api-Key</c>, and on success issues a principal carrying the client's permissions.
/// Every failure produces the same generic 401 so callers cannot tell which part failed.
/// </summary>
public sealed class ApiKeyAuthenticationHandler(
    IOptionsMonitor<ApiKeyAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    ApiAccessDbContext db,
    TimeProvider clock) : AuthenticationHandler<ApiKeyAuthenticationOptions>(options, logger, encoder)
{
    public const string SchemeName = "ApiKey";
    public const string ClientIdHeader = "X-Client-Id";
    public const string ApiKeyHeader = "X-Api-Key";
    public const string PermissionClaim = "permission";

    // Used so an unknown client costs the same hash + compare work as a known one.
    private static readonly string DummyHash = ApiKeys.Hash("not-a-real-key-" + Guid.NewGuid());

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var username = Request.Headers[ClientIdHeader].ToString();
        var key = Request.Headers[ApiKeyHeader].ToString();
        if (username.Length == 0 && key.Length == 0)
            return AuthenticateResult.NoResult();
        if (username.Length is 0 or > 64 || key.Length < ApiKeys.PrefixLength || key.Length > ApiKeys.MaxKeyLength)
            return Fail();

        var now = clock.GetUtcNow().UtcDateTime;
        var prefix = ApiKeys.PrefixOf(key);

        var client = await db.Clients.AsNoTracking()
            .Where(c => c.Username == username)
            .Select(c => new
            {
                c.Id,
                c.Username,
                c.Status,
                Keys = c.Keys
                    .Where(k => k.KeyPrefix == prefix && k.RevokedAt == null && k.ExpiresAt > now)
                    .Select(k => new { k.Id, k.KeyHash, k.LastUsedAt })
                    .ToList(),
                Permissions = c.Permissions.Select(p => p.Permission).ToList(),
            })
            .SingleOrDefaultAsync(Context.RequestAborted);

        if (client is null)
        {
            ApiKeys.Matches(key, DummyHash);
            return Fail();
        }

        // A known client with no candidate key still pays for one compare, like an unknown client.
        if (client.Keys.Count == 0)
            ApiKeys.Matches(key, DummyHash);

        var matched = client.Keys.FirstOrDefault(k => ApiKeys.Matches(key, k.KeyHash));
        if (matched is null || client.Status != ClientStatus.Active)
            return Fail();

        // Record usage at most once a minute per key to keep writes cheap.
        if (matched.LastUsedAt is null || matched.LastUsedAt < now.AddMinutes(-1))
        {
            await db.ClientKeys.Where(k => k.Id == matched.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(k => k.LastUsedAt, now), Context.RequestAborted);
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, client.Username),
            new(ClaimTypes.NameIdentifier, client.Id.ToString()),
        };
        claims.AddRange(client.Permissions.Select(p => new Claim(PermissionClaim, p)));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, SchemeName));
        return AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName));
    }

    private static AuthenticateResult Fail() => AuthenticateResult.Fail("Invalid client credentials.");

    protected override Task HandleChallengeAsync(AuthenticationProperties properties) =>
        WriteProblem(StatusCodes.Status401Unauthorized, "Unauthorized",
            "Missing or invalid client credentials.");

    protected override Task HandleForbiddenAsync(AuthenticationProperties properties) =>
        WriteProblem(StatusCodes.Status403Forbidden, "Forbidden",
            "This client is not permitted to perform this operation.");

    private Task WriteProblem(int status, string title, string detail)
    {
        Response.StatusCode = status;
        return Results.Problem(new ProblemDetails { Status = status, Title = title, Detail = detail })
            .ExecuteAsync(Context);
    }
}
