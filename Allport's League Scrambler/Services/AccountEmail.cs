using System.Net;
using System.Net.Mail;
using System.Net.Mime;
using System.Text;

namespace Allport_s_League_Scrambler.Services;

internal static class AccountEmail
{
    internal static MailMessage Verification(string email, bool recovering, string code) =>
        Create(email, "Verify Your League Hub Email Address", "Verify Your Email Address",
            recovering ? "You requested account recovery. Enter this code on the recovery page to verify your new email address." :
                "You requested to change your account email. Enter this code on the Change Email page.",
            recovering ? "The code expires after one hour. An Application Administrator must still independently verify ownership and approve recovery." :
                "The code expires after one hour and can only be used once.",
            "If you did not request this change, you can safely ignore this email.", code);

    internal static MailMessage Create(string recipient, string subject, string title, string introduction,
        string nextStep, string footer, string code = null, string action = null, string actionUrl = null)
    {
        string Encode(string text) => WebUtility.HtmlEncode(text);
        var plain = $"Allport's League Hub\r\n\r\n{title}\r\n\r\n{introduction}\r\n\r\n";
        var panel = "";
        if (code != null)
        {
            plain += $"Code: {code}\r\n\r\n";
            panel = $"""<p style="margin:20px 0;padding:14px;background:#eef3fa;border:1px solid #d5dfec;border-radius:6px;text-align:center;font-size:28px;letter-spacing:3px;font-weight:bold;color:#243e60;white-space:nowrap;">{Encode(code)}</p>""";
        }
        if (actionUrl != null)
        {
            plain += $"{action}: {actionUrl}\r\n\r\n";
            panel = $"""<table role="presentation" cellspacing="0" cellpadding="0" align="center" style="margin:20px auto;"><tr><td bgcolor="#365781" style="border-radius:4px;mso-padding-alt:12px 22px;"><a href="{Encode(actionUrl)}" style="display:inline-block;padding:12px 22px;text-decoration:none;color:#ffffff;font-weight:bold;">{Encode(action)}</a></td></tr></table>""";
        }
        plain += nextStep + "\r\n\r\n" + footer;
        var html = $"""
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{Encode(title)}</title></head>
<body style="margin:0;padding:0;background:#f3f6fa;color:#243e60;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fa;"><tr><td align="center" style="padding:20px 12px;">
<!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #d5dfec;border-radius:6px;">
<tr><td align="center" bgcolor="#243e60" style="padding:20px;color:#fff;font-size:20px;font-weight:bold;">Allport's League Hub</td></tr>
<tr><td style="padding:24px 20px;line-height:1.5;font-size:16px;">
<h1 style="margin:0 0 16px;text-align:center;font-size:25px;line-height:1.2;color:#243e60;">{Encode(title)}</h1>
<p style="margin:0 0 12px;">{Encode(introduction)}</p>{panel}<p style="margin:0;">{Encode(nextStep)}</p></td></tr>
<tr><td bgcolor="#f3f6fa" style="padding:16px 20px;border-top:1px solid #d5dfec;color:#465872;font-size:14px;line-height:1.5;">{Encode(footer)}</td></tr>
</table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>
""";
        var message = new MailMessage
        {
            From = new MailAddress("LeagueScrambler@gmail.com", "Allport's League Hub", Encoding.UTF8),
            Subject = subject, SubjectEncoding = Encoding.UTF8, BodyEncoding = Encoding.UTF8, IsBodyHtml = true
        };
        message.To.Add(recipient);
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(plain, Encoding.UTF8, MediaTypeNames.Text.Plain));
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(html, Encoding.UTF8, MediaTypeNames.Text.Html));
        return message;
    }
}
