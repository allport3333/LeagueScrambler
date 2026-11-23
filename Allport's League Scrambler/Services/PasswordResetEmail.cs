using System;
using System.Globalization;
using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;

namespace Allport_s_League_Scrambler.Services
{
    public static class PasswordResetEmail
    {
        public const string PublicOrigin = "https://www.allportsleaguehub.com";

        public static string ResolveOrigin(string configuredOrigin, string environment)
        {
            var value = string.IsNullOrWhiteSpace(configuredOrigin) ? PublicOrigin : configuredOrigin.Trim();
            Uri origin;
            if (!Uri.TryCreate(value, UriKind.Absolute, out origin) || origin.Scheme != Uri.UriSchemeHttps ||
                !string.IsNullOrEmpty(origin.UserInfo) || !string.IsNullOrEmpty(origin.Query) ||
                !string.IsNullOrEmpty(origin.Fragment) || origin.AbsolutePath != "/")
                throw new InvalidOperationException("Password reset base URL must be a trusted HTTPS origin without a path, credentials, query or fragment.");

            bool development = string.Equals(environment, "Development", StringComparison.OrdinalIgnoreCase);
            bool publicHost = string.Equals(origin.Host, "www.allportsleaguehub.com", StringComparison.OrdinalIgnoreCase) && origin.IsDefaultPort;
            if (!publicHost && !(development && origin.IsLoopback))
                throw new InvalidOperationException("Password reset origin must be https://www.allportsleaguehub.com. HTTPS localhost is permitted only in Development.");
            return origin.GetLeftPart(UriPartial.Authority);
        }

        public static MailMessage Create(string recipient, string token, string configuredOrigin, string environment, TimeSpan lifetime)
        {
            if (string.IsNullOrEmpty(token)) throw new ArgumentException("A reset token is required.", nameof(token));
            string url = ResolveOrigin(configuredOrigin, environment) + "/resetpassword?token=" + Uri.EscapeDataString(token);
            string expiry = lifetime == TimeSpan.FromHours(1) ? "one hour" : lifetime.TotalMinutes.ToString("0", CultureInfo.InvariantCulture) + " minutes";
            return AccountEmail.Create(recipient, "Reset Your Allport's League Hub Password", "Reset Your Password",
                "We received a request to reset your Allport's League Hub password.",
                "This link expires in " + expiry + " and can only be used once.",
                "If you didn't request this change, you can safely ignore this email.",
                action: "Reset Password", actionUrl: url);
        }
    }
}
