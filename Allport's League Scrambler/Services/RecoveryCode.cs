using System;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;

namespace Allport_s_League_Scrambler.Services;

internal static class RecoveryCode
{
    private const int AttemptLimit = 5;
    private const string Prefix = "n1.";

    internal static byte[] Key()
    {
        try
        {
            var value = Convert.FromBase64String(Environment.GetEnvironmentVariable("LEAGUESCRAMBLER_VERIFICATION_KEY") ?? "");
            return value.Length == 32 ? value : null;
        }
        catch (FormatException) { return null; }
    }

    internal static (string Code, string Hash) Create(Guid requestId, byte[] key, string previous = null)
    {
        string code, digest;
        do
        {
            code = RandomNumberGenerator.GetInt32(100_000_000).ToString("D8", CultureInfo.InvariantCulture);
            digest = Convert.ToBase64String(Digest(requestId, code, key));
        } while (previous?.StartsWith(Prefix, StringComparison.Ordinal) == true &&
            previous.EndsWith("." + digest, StringComparison.Ordinal));
        return (code, Prefix + "0." + digest);
    }

    internal static bool Verify(Guid requestId, string stored, string code, out string failedHash)
    {
        failedHash = stored;
        if (!stored.StartsWith(Prefix, StringComparison.Ordinal))
        {
            // Existing high-entropy codes retain their original validation until expiry or resend.
            if (stored.Length != 64 || code.Length != 64 || !stored.All(Uri.IsHexDigit) || !code.All(Uri.IsHexDigit))
                return false;
            return CryptographicOperations.FixedTimeEquals(Convert.FromHexString(stored),
                SHA256.HashData(Encoding.UTF8.GetBytes(code.ToUpperInvariant())));
        }

        var parts = stored.Split('.');
        var key = Key();
        if (parts.Length != 3 || key == null || !int.TryParse(parts[1], out var attempts) ||
            attempts is < 0 or >= AttemptLimit || code.Length != 8 || !code.All(c => c is >= '0' and <= '9'))
            return false;
        Span<byte> expected = stackalloc byte[32];
        if (!Convert.TryFromBase64String(parts[2], expected, out var length) || length != expected.Length)
            return false;
        var valid = CryptographicOperations.FixedTimeEquals(expected, Digest(requestId, code, key));
        if (!valid) failedHash = Prefix + (attempts + 1).ToString(CultureInfo.InvariantCulture) + "." + parts[2];
        return valid;
    }

    private static byte[] Digest(Guid id, string code, byte[] key) =>
        HMACSHA256.HashData(key, Encoding.UTF8.GetBytes("LeagueHub/email-verification/v1/" + id.ToString("N") + "/" + code));
}
