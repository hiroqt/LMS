using System.Net.Http.Headers;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Lms.Api.Isms;

public static class IsmsServiceCollectionExtensions
{
    /// <summary>Registers the ISMS typed client, its retry handler, and the cached catalog.</summary>
    public static IServiceCollection AddIsms(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<IsmsOptions>()
            .Bind(configuration.GetSection(IsmsOptions.SectionName))
            .ValidateOnStart();
        services.AddSingleton<IValidateOptions<IsmsOptions>, IsmsOptionsValidator>();

        services.TryAddSingleton(TimeProvider.System);
        // Bounded: every cached ISMS read counts as 1, so request parameters cannot grow memory.
        services.AddMemoryCache(o => o.SizeLimit = 512);
        services.AddSingleton<IsmsFetchLocks>();
        services.AddScoped<IIsmsCatalog, MemoryIsmsCatalog>();

        services.AddTransient<IsmsRetryHandler>();
        services.AddHttpClient<IIsmsClient, IsmsClient>((sp, http) =>
            {
                var o = sp.GetRequiredService<IOptions<IsmsOptions>>().Value;
                http.BaseAddress = new Uri(o.BaseUrl.TrimEnd('/') + "/");
                // Covers every attempt plus back-off; the per-attempt limit is in IsmsRetryHandler.
                var attempts = Math.Max(0, o.MaxRetries) + 1;
                http.Timeout = TimeSpan.FromSeconds(o.TimeoutSeconds * attempts)
                    + TimeSpan.FromMilliseconds(o.RetryDelayMilliseconds * attempts * attempts)
                    + TimeSpan.FromSeconds(5);
                http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                http.DefaultRequestHeaders.Add("X-Client-Id", o.ClientId);
                http.DefaultRequestHeaders.Add("X-Api-Key", o.ApiKey);
            })
            .AddHttpMessageHandler<IsmsRetryHandler>();

        return services;
    }
}
