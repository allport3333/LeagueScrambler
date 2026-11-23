using System;
using System.Net;
using System.Net.Mail;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace Allport_s_League_Scrambler.Services;

public sealed class TransactionalMail(SmtpClient client, ILogger<TransactionalMail> logger)
{
    private readonly SemaphoreSlim sendLock = new(1);
    private const string LegacySender = "LeagueScrambler@gmail.com";

    public static SmtpClient ConfigureClient(string environment)
    {
        var mode = Environment.GetEnvironmentVariable("SMTP_MODE")?.Trim().ToLowerInvariant();
        var client = new SmtpClient();
        if (mode == "pickup")
        {
            if (string.Equals(environment, "Production", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("SMTP pickup is unavailable in Production.");
            var path = Environment.GetEnvironmentVariable("SMTP_PICKUP_DIRECTORY");
            if (string.IsNullOrWhiteSpace(path) || !System.IO.Path.IsPathFullyQualified(path) ||
                !System.IO.Directory.Exists(path))
                throw new InvalidOperationException("SMTP pickup requires an existing absolute directory.");
            client.DeliveryMethod = SmtpDeliveryMethod.SpecifiedPickupDirectory;
            client.PickupDirectoryLocation = path;
        }
        else
        {
            if (mode is not (null or "" or "smtp"))
                throw new InvalidOperationException("SMTP_MODE must be smtp or pickup.");
            var host = Environment.GetEnvironmentVariable("SMTP_SERVER");
            if (!string.IsNullOrWhiteSpace(host)) client.Host = host.Trim();
            var port = Environment.GetEnvironmentVariable("SMTP_PORT");
            if (!string.IsNullOrWhiteSpace(port))
            {
                if (!int.TryParse(port, out var number) || number is < 1 or > 65535)
                    throw new InvalidOperationException("SMTP_PORT must be a valid TCP port.");
                client.Port = number;
            }
            else client.Port = 587;
            client.DeliveryMethod = SmtpDeliveryMethod.Network;
            client.EnableSsl = true;
            client.Credentials = new NetworkCredential(Environment.GetEnvironmentVariable("SMTP_USERNAME"),
                Environment.GetEnvironmentVariable("SMTP_PASSWORD"));
        }
        return client;
    }

    public async Task Send(MailMessage message, string purpose, string correlationId)
    {
        var pickup = client.DeliveryMethod == SmtpDeliveryMethod.SpecifiedPickupDirectory;
        var transport = pickup ? "pickup" : "smtp";
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        try
        {
            var credentials = client.Credentials as NetworkCredential;
            if (!pickup && (string.IsNullOrWhiteSpace(client.Host) ||
                string.IsNullOrWhiteSpace(credentials?.UserName) || string.IsNullOrWhiteSpace(credentials.Password)))
                throw new InvalidOperationException("SMTP server or authentication is not configured.");
            var configuredFrom = Environment.GetEnvironmentVariable("SMTP_FROM")?.Trim();
            var from = !string.IsNullOrEmpty(configuredFrom) ? configuredFrom :
                MailAddress.TryCreate(credentials?.UserName, out var mailbox) ? mailbox.Address :
                pickup ? LegacySender : throw new InvalidOperationException("Set SMTP_FROM to a sender authorized for this SMTP account.");
            message.From = new MailAddress(from, "Allport's League Hub");
            await sendLock.WaitAsync(deadline.Token);
            try { await client.SendMailAsync(message, deadline.Token); }
            finally { sendLock.Release(); }
            logger.LogInformation("Transactional mail {Purpose} {Outcome} ({CorrelationId}).",
                purpose, pickup ? "written to local pickup" : "accepted by SMTP", correlationId);
        }
        catch (Exception error) when (error is SmtpException or InvalidOperationException or FormatException or OperationCanceledException)
        {
            logger.LogWarning("Transactional mail {Purpose} {Transport} failed ({CorrelationId}); type {ErrorType}, SMTP status {StatusCode}, host configured {HostConfigured}.",
                purpose, transport, correlationId, error.GetType().Name,
                error is SmtpException smtpError ? (int)smtpError.StatusCode : null,
                !string.IsNullOrWhiteSpace(client.Host));
            throw;
        }
    }
}
