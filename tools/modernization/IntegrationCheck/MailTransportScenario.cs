using System;
using System.IO;
using System.Net;
using System.Net.Mail;
using System.Net.Sockets;
using System.Threading.Tasks;
using Allport_s_League_Scrambler.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

internal static class MailTransportScenario
{
    public static async Task CheckStartup()
    {
        var contentRoot = Path.GetFullPath("Allport's League Scrambler");
        Need(File.Exists(Path.Combine(contentRoot, ".env")), "modernization project has a local .env file");
        foreach (var setting in new[] { "SMTP_MODE", "SMTP_SERVER", "SMTP_PORT", "SMTP_USERNAME", "SMTP_PASSWORD",
            "SMTP_FROM", "SMTP_PICKUP_DIRECTORY", "LEAGUESCRAMBLER_PUBLIC_BASE_URL" })
            Environment.SetEnvironmentVariable(setting, null);

        // Exercise the same Startup and content-root configuration without launching the Angular CLI
        // or reading the interactive account's DPAPI key ring.
        using var host = Allport_s_League_Scrambler.Program.CreateHostBuilder(Array.Empty<string>())
            .UseEnvironment("Staging")
            .ConfigureWebHost(web => web.UseEnvironment("Staging").UseContentRoot(contentRoot)
                .UseUrls("http://127.0.0.1:0"))
            .ConfigureLogging(logging => logging.ClearProviders())
            .ConfigureServices(services => services.AddDataProtection().UseEphemeralDataProtectionProvider())
            .Build();
        await host.StartAsync();
        try
        {
            var mail = host.Services.GetRequiredService<SmtpClient>();
            var credential = mail.Credentials as NetworkCredential;
            Need(mail.DeliveryMethod == SmtpDeliveryMethod.Network && mail.EnableSsl && mail.Port == 587 &&
                !string.IsNullOrWhiteSpace(mail.Host), "startup loaded network SMTP with STARTTLS on port 587");
            Need(!string.IsNullOrWhiteSpace(credential?.Password) &&
                MailAddress.TryCreate(credential?.UserName, out var mailbox) && mailbox.Address == credential.UserName,
                "startup loaded SMTP credentials and the authenticated mailbox is a valid default sender");
            Need(Environment.GetEnvironmentVariable("LEAGUESCRAMBLER_PUBLIC_BASE_URL") == "https://localhost:5001",
                "startup loaded the localhost Development reset origin");

            var address = System.Linq.Enumerable.Single(host.Services.GetRequiredService<IServer>()
                .Features.Get<IServerAddressesFeature>().Addresses);
            using var client = new System.Net.Http.HttpClient();
            using var request = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Post,
                address + "/api/account-recovery/resend");
            request.Headers.Add("Origin", address);
            request.Content = new System.Net.Http.StringContent("{\"id\":\"00000000-0000-0000-0000-000000000000\"}",
                System.Text.Encoding.UTF8, "application/json");
            using var response = await client.SendAsync(request);
            Need(response.StatusCode == HttpStatusCode.BadRequest, "updated controller handles the no-send startup probe");
        }
        finally { await host.StopAsync(); }
    }

    public static async Task LiveProbe(string approvedRecipient)
    {
        Need(MailAddress.TryCreate(approvedRecipient, out var recipient) && recipient.Address == approvedRecipient,
            "Explicit test recipient is valid");
        var configPath = Path.GetFullPath(Path.Combine("Allport's League Scrambler", ".env"));
        if (File.Exists(configPath))
            dotenv.net.DotEnv.Load(new dotenv.net.DotEnvOptions(envFilePaths: new[] { configPath }, overwriteExistingVars: false));
        using var transport = TransactionalMail.ConfigureClient("Development");
        if (transport.DeliveryMethod != SmtpDeliveryMethod.Network || !transport.EnableSsl)
            throw new InvalidOperationException("Live probe requires SMTP with STARTTLS.");
        var id = Guid.NewGuid().ToString("N");
        using var message = new MailMessage { Subject = "League Hub SMTP test " + id, Body = "Approved mailbox transport check." };
        message.To.Add(recipient);
        try
        {
            await new TransactionalMail(transport, NullLogger<TransactionalMail>.Instance).Send(message, "test-probe", id);
            Console.WriteLine("SMTP accepted the test message. Inbox receipt is unverified. Correlation ID: " + id);
        }
        catch (SmtpException error)
        {
            Console.Error.WriteLine("SMTP probe rejected; status " + (int)error.StatusCode + ". Correlation ID: " + id);
            throw;
        }
        catch (Exception error) when (error is InvalidOperationException or FormatException or OperationCanceledException)
        {
            Console.Error.WriteLine("SMTP probe failed; " + error.GetType().Name + ". Correlation ID: " + id);
            throw;
        }
    }

    public static async Task Run()
    {
        var folder = Path.Combine(Path.GetTempPath(), "league-mail-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            Environment.SetEnvironmentVariable("SMTP_MODE", "pickup");
            Environment.SetEnvironmentVariable("SMTP_PICKUP_DIRECTORY", folder);
            Environment.SetEnvironmentVariable("SMTP_FROM", "fixture-sender@example.invalid");
            using var pickup = TransactionalMail.ConfigureClient("Development");
            using var reset = PasswordResetEmail.Create("fixture-recipient@example.invalid", "synthetic-only",
                "https://localhost:5001", "Development", TimeSpan.FromHours(1));
            await new TransactionalMail(pickup, NullLogger<TransactionalMail>.Instance).Send(reset, "password-reset", "test");
            var file = Directory.GetFiles(folder, "*.eml");
            Need(file.Length == 1, "reset message was written to the configured pickup directory");
            var captured = File.ReadAllText(file[0]);
            Need(captured.Contains("multipart/alternative") && captured.Contains("From:") &&
                captured.Contains("fixture-sender@example.invalid"), "pickup preserved HTML/plain alternatives and configured sender");
            await CheckVerificationMime(pickup, folder);
            var productionRejected = false;
            try { using var invalid = TransactionalMail.ConfigureClient("Production"); }
            catch (InvalidOperationException) { productionRejected = true; }
            Need(productionRejected, "Production rejects pickup mode");

            Environment.SetEnvironmentVariable("SMTP_FROM", null);
            await WireTest(reject: false);
            await WireTest(reject: true);
            using var closedListener = new TcpListener(IPAddress.Loopback, 0);
            closedListener.Start();
            var closedPort = ((IPEndPoint)closedListener.LocalEndpoint).Port;
            closedListener.Stop();
            using var closed = NetworkClient(closedPort);
            using var unavailable = Message();
            var unavailableObserved = false;
            try { await new TransactionalMail(closed, NullLogger<TransactionalMail>.Instance).Send(unavailable, "verification", "test"); }
            catch (SmtpException) { unavailableObserved = true; }
            Need(unavailableObserved, "an unavailable SMTP transport propagates a delivery failure");
        }
        finally
        {
            foreach (var file in Directory.GetFiles(folder, "*.eml")) File.Delete(file);
            Directory.Delete(folder);
        }
    }

    private static async Task CheckVerificationMime(SmtpClient pickup, string folder)
    {
        var assembly = typeof(PasswordResetEmail).Assembly;
        var flags = System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.NonPublic;
        var keys = assembly.GetType("Allport_s_League_Scrambler.Services.RecoveryCode");
        var create = keys.GetMethod("Create", flags);
        var verify = keys.GetMethod("Verify", flags);
        var request = Guid.NewGuid();
        var key = System.Security.Cryptography.RandomNumberGenerator.GetBytes(32);
        Environment.SetEnvironmentVariable("LEAGUESCRAMBLER_VERIFICATION_KEY", Convert.ToBase64String(key));
        var (code, hash) = ((string, string))create.Invoke(null, new object[] { request, key, null });
        bool Check(Guid id, string stored, string input, out string updated)
        {
            var arguments = new object[] { id, stored, input, null };
            var success = (bool)verify.Invoke(null, arguments);
            updated = (string)arguments[3];
            return success;
        }
        Need(code.Length == 8 && !hash.Contains(code) && hash.Length <= 64 &&
            Check(request, hash, code, out _) && !Check(Guid.NewGuid(), hash, code, out _),
            "eight-digit code is stored as a request-bound keyed digest");
        var attempt = hash;
        for (var count = 0; count < 5; count++)
            Need(!Check(request, attempt, code == "00000000" ? "00000001" : "00000000", out attempt),
                "wrong verification code rejected");
        Need(!Check(request, attempt, code, out _), "persisted attempt limit blocks verification");
        var (replacement, rotated) = ((string, string))create.Invoke(null, new object[] { request, key, attempt });
        Need(replacement != code && !Check(request, rotated, code, out _) &&
            Check(request, rotated, replacement, out _), "resend rotates the code and resets the attempt budget");
        const string legacy = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        var legacyHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(legacy)));
        Need(Check(request, legacyHash, legacy.ToLowerInvariant(), out _), "outstanding legacy hexadecimal codes remain compatible");

        var template = assembly.GetType("Allport_s_League_Scrambler.Services.AccountEmail").GetMethod("Verification", flags);
        foreach (var recovering in new[] { true, false })
        {
            using var mail = (MailMessage)template.Invoke(null, new object[] { "verification-fixture@example.invalid", recovering, code });
            await new TransactionalMail(pickup, NullLogger<TransactionalMail>.Instance).Send(mail, "verification", "test");
            var pickupFile = System.Linq.Enumerable.Single(Directory.GetFiles(folder, "*.eml"),
                file => File.ReadAllText(file).Contains("verification-fixture@example.invalid"));
            var raw = File.ReadAllText(pickupFile);
            var parts = System.Text.RegularExpressions.Regex.Matches(raw,
                @"Content-Transfer-Encoding: base64\r?\n\r?\n([A-Za-z0-9+/=\r\n]+)");
            var text = System.Linq.Enumerable.ToArray(System.Linq.Enumerable.Select(parts,
                part => System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(part.Groups[1].Value))));
            Need(raw.Contains("multipart/alternative") && text.Length == 2 && text[0].Contains("Code: " + code) &&
                text[1].Contains("Verify Your Email Address") && text[1].Contains(code) &&
                text[1].Contains("one hour") && (!recovering || text[1].Contains("Application Administrator")) &&
                !System.Linq.Enumerable.Any(text, body => body.Contains(request.ToString())),
                "pickup contains branded verification HTML and plain text with no request identifier");
            File.Delete(pickupFile);
        }
    }

    private static SmtpClient NetworkClient(int port) => new("127.0.0.1", port)
    {
        // The test socket is loopback only. The application SMTP factory always enables STARTTLS.
        EnableSsl = false,
        Credentials = new NetworkCredential("fixture-sender@example.invalid", "synthetic")
    };

    private static MailMessage Message() =>
        new("unused@example.invalid", "fixture-recipient@example.invalid", "Synthetic verification", "No live recipient");

    private static async Task WireTest(bool reject)
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var server = Serve(listener, reject);
        using var client = NetworkClient(((IPEndPoint)listener.LocalEndpoint).Port);
        using var verification = Message();
        var failed = false;
        try { await new TransactionalMail(client, NullLogger<TransactionalMail>.Instance).Send(verification, "verification", "test"); }
        catch (SmtpException) { failed = true; }
        client.Dispose();
        Need(await server.WaitAsync(TimeSpan.FromSeconds(10)) && failed == reject,
            reject ? "SMTP AUTH rejection propagates as a delivery failure" : "loopback SMTP accepts the verification message after DATA");
    }

    private static async Task<bool> Serve(TcpListener listener, bool reject)
    {
        using var client = await listener.AcceptTcpClientAsync();
        using var stream = client.GetStream();
        using var writer = new StreamWriter(stream) { NewLine = "\r\n", AutoFlush = true };
        using var reader = new StreamReader(stream);
        await writer.WriteLineAsync("220 loopback test");
        var authorizedSender = false;
        var accepted = false;
        var rejected = false;
        while (await reader.ReadLineAsync() is { } line)
        {
            if (line.StartsWith("EHLO ", StringComparison.OrdinalIgnoreCase))
            {
                await writer.WriteLineAsync(reject ? "250-loopback\r\n250 AUTH LOGIN" : "250 loopback");
            }
            else if (line.StartsWith("AUTH ", StringComparison.OrdinalIgnoreCase))
            {
                rejected = true;
                await writer.WriteLineAsync("535 5.7.8 Authentication credentials invalid");
            }
            else if (line.StartsWith("MAIL FROM:", StringComparison.OrdinalIgnoreCase))
            {
                authorizedSender = line.Contains("fixture-sender@example.invalid", StringComparison.OrdinalIgnoreCase);
                await writer.WriteLineAsync(reject ? "530 5.7.0 Authentication required" : "250 OK");
            }
            else if (line.Equals("DATA", StringComparison.OrdinalIgnoreCase))
            {
                await writer.WriteLineAsync("354 Send message");
                while (await reader.ReadLineAsync() is { } messageLine && messageLine != ".") { }
                await writer.WriteLineAsync("250 2.0.0 Accepted");
                accepted = true;
            }
            else if (line.Equals("QUIT", StringComparison.OrdinalIgnoreCase))
            {
                await writer.WriteLineAsync("221 Bye");
                break;
            }
            else await writer.WriteLineAsync("250 OK");
        }
        return reject ? rejected && !accepted : accepted && authorizedSender;
    }

    private static void Need(bool condition, string check)
    {
        if (!condition) throw new InvalidOperationException(check);
        Console.WriteLine("PASS " + check);
    }
}
