using Lms.Api.Endpoints;
using Lms.Api.Isms;
using Microsoft.AspNetCore.Cors.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<IsmsExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddIsms(builder.Configuration);

// CORS origins come from Cors:AllowedOrigins (only http://localhost:5173 in Development).
// Read lazily so test hosts and environment overrides apply. Never allow-any-origin.
builder.Services.AddCors();
builder.Services.AddOptions<CorsOptions>().Configure<IConfiguration>((cors, config) =>
{
    var origins = config.GetSection("Cors:AllowedOrigins").Get<string[]>()?
        .Where(o => !string.IsNullOrWhiteSpace(o) && o.Trim() != "*")
        .Select(o => o.Trim().TrimEnd('/'))
        .ToArray() ?? [];

    cors.AddDefaultPolicy(policy => policy
        .WithOrigins(origins)
        .WithMethods(HttpMethods.Get)
        .AllowAnyHeader());
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors();

app.MapLmsEndpoints();

app.Run();

public partial class Program;
