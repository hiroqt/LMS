using Isms.Api.Access;

namespace Isms.Api.Cli;

/// <summary>
/// <c>clients ...</c> command line. Run through the API executable:
/// <c>dotnet run --project src/Isms.Api -- clients list</c>.
/// </summary>
public static class ClientCli
{
    public const string Usage = """
        Usage:
          clients create <username> [--name "Display name"] --permissions p1,p2 [--expires-days 30]
          clients rotate <username> [--expires-days 30] [--revoke-old]
          clients revoke-key <username> <key-prefix>
          clients grant <username> <p1,p2>
          clients ungrant <username> <p1,p2>
          clients disable <username>
          clients enable <username>
          clients list
        Known permissions:
        """;

    public static async Task<int> RunAsync(string[] args, ClientAdmin admin, TextWriter output, TextWriter error)
    {
        try
        {
            var (positional, options, flags) = Parse(args);
            var command = positional.ElementAtOrDefault(0);
            string User() => positional.ElementAtOrDefault(1) ?? throw new ClientAdminException("Missing <username>.");
            string Arg(int i, string name) => positional.ElementAtOrDefault(i) ?? throw new ClientAdminException($"Missing <{name}>.");
            int Days() => options.TryGetValue("expires-days", out var d)
                ? int.TryParse(d, out var n) ? n : throw new ClientAdminException("--expires-days must be a number.")
                : ClientAdmin.DefaultExpiryDays;

            switch (command)
            {
                case "create":
                {
                    var perms = options.GetValueOrDefault("permissions") ?? "";
                    var issued = await admin.CreateAsync(User(), options.GetValueOrDefault("name") ?? "", SplitList(perms), Days());
                    PrintKey(output, $"Created client '{issued.Username}'.", issued);
                    return 0;
                }
                case "rotate":
                {
                    var issued = await admin.RotateAsync(User(), Days(), flags.Contains("revoke-old"));
                    PrintKey(output, flags.Contains("revoke-old")
                        ? $"Issued a new key for '{issued.Username}' and revoked all previous keys."
                        : $"Issued a new key for '{issued.Username}'. Previous keys stay valid until they expire or are revoked.", issued);
                    return 0;
                }
                case "revoke-key":
                    await admin.RevokeKeyAsync(User(), Arg(2, "key-prefix"));
                    output.WriteLine("Key revoked.");
                    return 0;
                case "grant":
                    await admin.GrantAsync(User(), SplitList(Arg(2, "permissions")));
                    output.WriteLine("Permissions granted.");
                    return 0;
                case "ungrant":
                    await admin.UngrantAsync(User(), SplitList(Arg(2, "permissions")));
                    output.WriteLine("Permissions removed.");
                    return 0;
                case "disable":
                    await admin.SetStatusAsync(User(), ClientStatus.Disabled);
                    output.WriteLine("Client disabled.");
                    return 0;
                case "enable":
                    await admin.SetStatusAsync(User(), ClientStatus.Active);
                    output.WriteLine("Client enabled.");
                    return 0;
                case "list":
                    PrintList(output, await admin.ListAsync());
                    return 0;
                default:
                    error.WriteLine(Usage + "  " + string.Join(", ", Permissions.All));
                    return 2;
            }
        }
        catch (ClientAdminException ex)
        {
            error.WriteLine("Error: " + ex.Message);
            return 1;
        }
    }

    private static void PrintKey(TextWriter output, string header, IssuedKey issued)
    {
        output.WriteLine(header);
        output.WriteLine();
        output.WriteLine("API key (shown ONCE - store it in the consumer's secret store now):");
        output.WriteLine(issued.Key);
        output.WriteLine();
        output.WriteLine($"Key prefix: {issued.KeyPrefix}   Expires (UTC): {issued.ExpiresAt:yyyy-MM-dd HH:mm}");
    }

    // Never prints keys or hashes; the prefix is only a lookup handle used by revoke-key.
    private static void PrintList(TextWriter output, IReadOnlyList<ClientSummary> clients)
    {
        if (clients.Count == 0)
        {
            output.WriteLine("No clients.");
            return;
        }
        foreach (var c in clients)
        {
            output.WriteLine($"{c.Username} ({c.DisplayName}) - {c.Status}, created {c.CreatedAt:yyyy-MM-dd}");
            output.WriteLine($"  permissions: {(c.Permissions.Count == 0 ? "(none)" : string.Join(", ", c.Permissions))}");
            foreach (var k in c.Keys)
            {
                var state = k.RevokedAt is not null ? $"revoked {k.RevokedAt:yyyy-MM-dd}"
                    : k.ExpiresAt <= DateTime.UtcNow ? "expired" : "active";
                output.WriteLine($"  key {k.KeyPrefix}...  {state}, expires {k.ExpiresAt:yyyy-MM-dd}, last used {(k.LastUsedAt?.ToString("yyyy-MM-dd HH:mm") ?? "never")}");
            }
        }
    }

    private static IEnumerable<string> SplitList(string value) =>
        value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private static (List<string> Positional, Dictionary<string, string> Options, HashSet<string> Flags) Parse(string[] args)
    {
        string[] valueOptions = ["name", "permissions", "expires-days"];
        string[] flagOptions = ["revoke-old"];
        var positional = new List<string>();
        var options = new Dictionary<string, string>(StringComparer.Ordinal);
        var flags = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < args.Length; i++)
        {
            if (!args[i].StartsWith("--", StringComparison.Ordinal))
            {
                positional.Add(args[i]);
                continue;
            }
            var name = args[i][2..];
            if (flagOptions.Contains(name))
                flags.Add(name);
            else if (valueOptions.Contains(name))
                options[name] = i + 1 < args.Length ? args[++i] : throw new ClientAdminException($"--{name} needs a value.");
            else
                throw new ClientAdminException($"Unknown option --{name}.");
        }
        return (positional, options, flags);
    }
}
