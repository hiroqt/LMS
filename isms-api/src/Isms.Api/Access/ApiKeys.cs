using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace Isms.Api.Access;

/// <summary>Key generation and hashing. Keys are 32 CSPRNG bytes, base64url encoded (43 chars).</summary>
public static class ApiKeys
{
    public const int PrefixLength = 8;
    public const int MaxKeyLength = 128;

    public static string Generate() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));

    public static string PrefixOf(string key) => key[..PrefixLength];

    public static string Hash(string key) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(key)));

    /// <summary>Constant-time comparison of a presented key against a stored hex hash.</summary>
    public static bool Matches(string presentedKey, string storedHexHash)
    {
        var presented = SHA256.HashData(Encoding.UTF8.GetBytes(presentedKey));
        byte[] stored;
        try { stored = Convert.FromHexString(storedHexHash); }
        catch (FormatException) { return false; }
        return CryptographicOperations.FixedTimeEquals(presented, stored);
    }
}
