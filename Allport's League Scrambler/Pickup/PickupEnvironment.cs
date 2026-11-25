using System;
using System.IO;
using System.Linq;
using Allport_s_League_Scrambler.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;

namespace Allport_s_League_Scrambler.Pickup;

public static class PickupEnvironment
{
    public static bool DisposableTest => Environment.GetEnvironmentVariable("LEAGUE_HUB_PICKUP_DISPOSABLE_TEST") == "1";
    public static string Database => DisposableTest ? "LeagueScramblerPickupTest" : "LeagueScramblerDev";
    public static string Origin => DisposableTest ? "https://localhost:5003" : "https://localhost:5002";
    public static string CookieName => DisposableTest ? ".LeagueHub.PickupTest" : ".LeagueHub.PickupSharedDev";
    public static bool Requested => Environment.GetEnvironmentVariable("LEAGUE_HUB_PICKUP_DEV") == "1";
    public static string LocalDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LeagueHub", DisposableTest ? "PickupTest" : "PickupSharedDev");

    public static void Configure(IWebHostEnvironment environment)
    {
        if (!Requested) return;
        if (!environment.IsDevelopment()) throw new InvalidOperationException("Pickup requires its isolated Development profile.");
        Environment.SetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION",
            "Server=lpc:localhost;Database=" + Database + ";Integrated Security=True;TrustServerCertificate=True");
        var mail = Directory.CreateDirectory(Path.Combine(LocalDirectory, "mail"));
        Environment.SetEnvironmentVariable("SMTP_MODE", "pickup");
        Environment.SetEnvironmentVariable("SMTP_PICKUP_DIRECTORY", mail.FullName);
    }

    public static void Initialize()
    {
        if (!Requested || !DisposableTest)
            throw new InvalidOperationException("Automatic initialization is restricted to the disposable Pickup test profile.");
        using var db = new DataContext();
        if (db.Database.GetDbConnection().Database != "LeagueScramblerPickupTest")
            throw new InvalidOperationException("Unexpected disposable test database.");
        db.Database.EnsureCreated();
        // Reference data only. No users, players, or application records are copied.
        db.Database.ExecuteSqlRaw("""
            SET XACT_ABORT ON;
            BEGIN TRANSACTION;
            SET IDENTITY_INSERT dbo.UserRoles ON;
            INSERT dbo.UserRoles (UserRoleId, RoleName)
            SELECT v.Id, v.Name FROM (VALUES (1,'admin'),(2,'manager'),(3,'player')) AS v(Id,Name)
            WHERE NOT EXISTS (SELECT 1 FROM dbo.UserRoles AS r WHERE r.UserRoleId=v.Id);
            SET IDENTITY_INSERT dbo.UserRoles OFF;
            SET IDENTITY_INSERT dbo.EventType ON;
            INSERT dbo.EventType (ID, Name)
            SELECT v.Id, v.Name FROM (VALUES (1,'League'),(2,'Tournament'),(3,'Pickup')) AS v(Id,Name)
            WHERE NOT EXISTS (SELECT 1 FROM dbo.EventType AS e WHERE e.ID=v.Id);
            SET IDENTITY_INSERT dbo.EventType OFF;
            COMMIT;
            """);
        if (!db.Database.SqlQueryRaw<int>("SELECT COUNT(*) AS Value FROM dbo.PickupSession").Any())
            throw new InvalidOperationException("Pickup schema is unavailable.");
    }
}
