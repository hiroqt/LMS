using Microsoft.AspNetCore.Authorization;

namespace Isms.Api.Access;

/// <summary>Check 2 of 2: does the authenticated client hold the endpoint's permission?</summary>
public sealed record PermissionRequirement(string Permission) : IAuthorizationRequirement;

public sealed class PermissionAuthorizationHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, PermissionRequirement requirement)
    {
        if (context.User.HasClaim(ApiKeyAuthenticationHandler.PermissionClaim, requirement.Permission))
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}

/// <summary>A requirement nothing ever satisfies: used for endpoints that declare no permission.</summary>
public sealed class DenyRequirement : IAuthorizationRequirement;

/// <summary>Endpoint metadata naming the endpoint's single required permission (also used by the request log).</summary>
public sealed record RequiredPermission(string Permission);

public static class PermissionEndpointExtensions
{
    /// <summary>Declares the one permission an endpoint requires.</summary>
    public static TBuilder RequirePermission<TBuilder>(this TBuilder builder, string permission)
        where TBuilder : IEndpointConventionBuilder
    {
        if (!Permissions.IsKnown(permission))
            throw new ArgumentException($"Unknown permission '{permission}'. Add it to {nameof(Permissions)} first.", nameof(permission));
        return builder
            .WithMetadata(new RequiredPermission(permission))
            .RequireAuthorization(Permissions.PolicyName(permission));
    }

    public static AuthorizationBuilder AddPermissionPolicies(this AuthorizationBuilder auth)
    {
        foreach (var permission in Permissions.All)
        {
            auth.AddPolicy(Permissions.PolicyName(permission), p => p
                .AddAuthenticationSchemes(ApiKeyAuthenticationHandler.SchemeName)
                .RequireAuthenticatedUser()
                .AddRequirements(new PermissionRequirement(permission)));
        }

        // Anything without a declared permission (including [Authorize] with no policy,
        // unknown routes and 405s) is denied: 401 without credentials, 403 with them.
        var denyAll = new AuthorizationPolicyBuilder(ApiKeyAuthenticationHandler.SchemeName)
            .RequireAuthenticatedUser()
            .AddRequirements(new DenyRequirement())
            .Build();
        auth.SetDefaultPolicy(denyAll);
        auth.SetFallbackPolicy(denyAll);
        return auth;
    }
}
