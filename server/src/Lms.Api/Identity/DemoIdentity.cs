namespace Lms.Api.Identity;

/// <summary>Who is making a request. From Phase 4 this comes from a real sign-in.</summary>
public sealed record CurrentUser(string Id, string Role)
{
    public const string Instructor = "instructor";
    public const string Student = "student";

    public bool IsInstructor => Role == Instructor;
    public bool IsStudent => Role == Student;
}

/// <summary>
/// DEMO ONLY, NOT AUTHENTICATION. Until sign-in exists (Phase 4), the client says who it is
/// "viewing as" with two headers: <c>X-Demo-User-Id</c> (an ISMS reference id) and
/// <c>X-Demo-Role</c> (<c>instructor</c> or <c>student</c>). Anyone can send any value, so this
/// is turned on only by <c>Lms:DemoIdentity:Enabled</c>, which is set in Development only. The
/// server still enforces every rule against that identity, so replacing this with real sign-in
/// changes only where <see cref="CurrentUser"/> comes from.
/// </summary>
public static class DemoIdentity
{
    public const string UserHeader = "X-Demo-User-Id";
    public const string RoleHeader = "X-Demo-Role";
    public const string EnabledSetting = "Lms:DemoIdentity:Enabled";
    private const string ItemKey = "lms.current-user";

    /// <summary>Requires a demo identity on every endpoint in the group; 401 without one.</summary>
    public static RouteGroupBuilder RequireDemoUser(this RouteGroupBuilder group)
    {
        group.AddEndpointFilter(async (context, next) =>
        {
            var http = context.HttpContext;
            if (!http.RequestServices.GetRequiredService<IConfiguration>().GetValue<bool>(EnabledSetting))
                return Unauthorized("Sign-in is not available yet, and the demo identity is turned off on this server.");

            var id = http.Request.Headers[UserHeader].ToString().Trim();
            var role = http.Request.Headers[RoleHeader].ToString().Trim().ToLowerInvariant();
            if (id.Length is 0 or > 64 || role is not (Identity.CurrentUser.Instructor or Identity.CurrentUser.Student))
                return Unauthorized($"Send {UserHeader} (an ISMS id) and {RoleHeader} (instructor or student).");

            http.Items[ItemKey] = new Identity.CurrentUser(id, role);
            return await next(context);
        });
        return group;
    }

    /// <summary>The identity set by <see cref="RequireDemoUser"/>.</summary>
    public static Identity.CurrentUser CurrentUser(this HttpContext http) =>
        http.Items[ItemKey] as Identity.CurrentUser ?? throw new InvalidOperationException("RequireDemoUser() is missing on this endpoint group.");

    private static IResult Unauthorized(string detail) =>
        TypedResults.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Who is asking?", detail: detail);
}
