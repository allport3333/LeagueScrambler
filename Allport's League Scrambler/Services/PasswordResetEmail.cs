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
            string plain = "Allport's League Hub\r\n\r\nReset Your Password\r\n\r\n" +
                "We received a request to reset your Allport's League Hub password.\r\n" +
                "Open the link below to choose a new password:\r\n\r\n" + url + "\r\n\r\n" +
                "This link expires in " + expiry + " and can only be used once.\r\n" +
                "If you didn't request this change, you can safely ignore this email.\r\n\r\nAllport's League Hub";
            string html = @"<!doctype html><html lang=""en""><head><meta charset=""utf-8""><meta name=""viewport"" content=""width=device-width,initial-scale=1""><title>Reset Your Password</title></head>
<body style=""margin:0;padding:0;background-color:#f3f6fa;color:#243e60;font-family:Arial,Helvetica,sans-serif;""><table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""background-color:#f3f6fa;""><tr><td align=""center"" style=""padding:24px 12px;""><!--[if mso]><table role=""presentation"" width=""560"" align=""center"" cellpadding=""0"" cellspacing=""0""><tr><td><![endif]--><table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" style=""max-width:560px;background-color:#ffffff;border:1px solid #d5dfec;border-radius:6px;""><tr><td align=""center"" bgcolor=""#243e60"" style=""padding:22px 20px;color:#ffffff;font-size:20px;font-weight:bold;"">Allport's League Hub</td></tr>
<tr><td style=""padding:28px 24px 20px;font-size:16px;line-height:1.6;""><h1 style=""margin:0 0 18px;text-align:center;color:#243e60;font-size:25px;line-height:1.3;"">Reset Your Password</h1><p style=""margin:0 0 12px;"">We received a request to reset your Allport's League Hub password.</p><p style=""margin:0 0 22px;"">Click the button below to choose a new password.</p>
<table role=""presentation"" cellpadding=""0"" cellspacing=""0"" align=""center"" style=""margin:0 auto 22px;""><tr><td align=""center"" bgcolor=""#526f9f"" style=""border-radius:4px;mso-padding-alt:14px 28px;""><a href=""__RESET_URL__"" style=""display:inline-block;padding:14px 28px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;line-height:1.4;"">Reset Password</a></td></tr></table>
<p style=""margin:0 0 14px;font-size:14px;color:#52647c;"">This link expires in __EXPIRY__ and can only be used once.</p><p style=""margin:0;font-size:14px;color:#52647c;"">If you didn't request this change, you can safely ignore this email.</p></td></tr><tr><td align=""center"" style=""border-top:1px solid #e2e8f0;padding:16px;color:#65758a;font-size:13px;"">Allport's League Hub</td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>";
            html = html.Replace("__RESET_URL__", WebUtility.HtmlEncode(url)).Replace("__EXPIRY__", WebUtility.HtmlEncode(expiry));
            var mail = new MailMessage
            {
                From = new MailAddress("LeagueScrambler@gmail.com", "Allport's League Hub", Encoding.UTF8),
                Subject = "Reset Your Allport's League Hub Password",
                SubjectEncoding = Encoding.UTF8,
                BodyEncoding = Encoding.UTF8,
                IsBodyHtml = true
            };
            mail.To.Add(recipient);
            // Explicit alternatives, plain first and HTML last. SMTP sends the
            // actual template, rather than a disconnected preview-only file.
            mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(plain, Encoding.UTF8, MediaTypeNames.Text.Plain));
            mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(html, Encoding.UTF8, MediaTypeNames.Text.Html));
            return mail;
        }
    }
}
