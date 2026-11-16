using System.Net;
using Isms.Api.Access;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Isms.Api.Tests;

/// <summary>
/// Adds test-only endpoints to the real app: one with no declared permission and one
/// anonymous control endpoint proving the injected endpoints are routable.
/// </summary>
public sealed class UndeclaredEndpointFactory : IsmsApiFactory
{
    public static int UndeclaredHandlerCalls;

    protected override void ConfigureTestServices(IServiceCollection services) =>
        services.AddSingleton<IStartupFilter, AddEndpointsFilter>();

    private sealed class AddEndpointsFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            next(app);
            // After Program has configured the pipeline, its UseRouting call has stored the
            // WebApplication under this key: the same route builder Program maps endpoints on.
            var endpoints = (IEndpointRouteBuilder)app.Properties["__EndpointRouteBuilder"]!;
            endpoints.MapGet("/v1/undeclared", () => { Interlocked.Increment(ref UndeclaredHandlerCalls); return "leaked"; });
            endpoints.MapGet("/test/anonymous-control", () => "ok").AllowAnonymous();
        };
    }
}

public class EndpointPolicyTests(UndeclaredEndpointFactory factory) : IClassFixture<UndeclaredEndpointFactory>
{
    [Fact]
    public async Task Endpoint_without_declared_permission_is_denied()
    {
        // Control: the injected endpoints really are routable.
        Assert.Equal(HttpStatusCode.OK, (await factory.ClientWith(null, null).GetAsync("/test/anonymous-control")).StatusCode);

        var withAllPermissions = await factory.FullAccessClient().GetAsync("/v1/undeclared");
        var anonymous = await factory.ClientWith(null, null).GetAsync("/v1/undeclared");

        Assert.Equal(HttpStatusCode.Forbidden, withAllPermissions.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
        Assert.Equal(0, UndeclaredEndpointFactory.UndeclaredHandlerCalls);
    }

    [Fact]
    public void Every_app_endpoint_is_GET_and_declares_exactly_one_known_permission()
    {
        _ = factory.Server; // make sure the host is built
        var endpoints = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText is not ("/v1/undeclared" or "/test/anonymous-control"))
            .ToList();
        Assert.NotEmpty(endpoints);

        foreach (var e in endpoints)
        {
            var route = e.RoutePattern.RawText;
            if (e.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            {
                // Only dev tooling may be anonymous.
                Assert.True(route is "/openapi/{documentName}.json" or "/health", $"Unexpected anonymous endpoint {route}");
                continue;
            }
            Assert.StartsWith("/v1/", route);
            Assert.Equal(["GET"], e.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods);
            var declared = e.Metadata.GetOrderedMetadata<RequiredPermission>();
            Assert.Single(declared);
            Assert.Contains(declared[0].Permission, Permissions.All);
        }
    }
}
