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
    public const string Database = "LeagueScramblerPickupDev";
    public const string Origin = "https://localhost:5002";
    public static bool Requested => Environment.GetEnvironmentVariable("LEAGUE_HUB_PICKUP_DEV") == "1";
    public static string LocalDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LeagueHub", Database);

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
        using var db = new DataContext();
        if (!Requested || db.Database.GetDbConnection().Database != Database)
            throw new InvalidOperationException("Pickup initialization requires the dedicated database.");
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
