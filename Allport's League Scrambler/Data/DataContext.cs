using Allport_s_League_Scrambler.Models;
using Allport_s_League_Scrambler.Pickup;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Data
{
    public class DataContext : DbContext
    {

        public DbSet<PickupGameSet> PickupGameSets { get; set; }
        public DbSet<PickupVenue> PickupVenues { get; set; }
        public DbSet<PickupSession> PickupSessions { get; set; }
        public DbSet<PickupRegistration> PickupRegistrations { get; set; }
        public virtual DbSet<Player> Players { get; set; }
        public virtual DbSet<PlayersLeague> PlayersLeagues { get; set; }
        public virtual DbSet<LeagueType> Leagues { get; set; }
        public DbSet<EventType> EventTypes { get; set; }
        public DbSet<TournamentConfiguration> TournamentConfigurations { get; set; }
        public DbSet<TournamentRound> TournamentRounds { get; set; }
        public virtual DbSet<Password> Passwords { get; set; }
        public virtual DbSet<PlayerScore> PlayerScore { get; set; }
        public virtual DbSet<LeagueTeam> LeagueTeam { get; set; }
        public virtual DbSet<KingQueenTeam> KingQueenTeam { get; set; }
        public virtual DbSet<KingQueenPlayer> KingQueenPlayer { get; set; }
        public DbSet<AccountRecoveryRequest> AccountRecoveryRequests { get; set; }
        public virtual DbSet<User> Users { get; set; }
        public DbSet<GoogleAccount> GoogleAccounts { get; set; }
        public virtual DbSet<UserLeague> UserLeagues { get; set; }
        public virtual DbSet<ByeRounds> ByeRounds { get; set; }
        public virtual DbSet<ByePlayer> ByePlayer { get; set; }
        public virtual DbSet<LeagueSettings> LeagueSettings { get; set; }       
        public virtual DbSet<PlayerSignIn> PlayerSignIn { get; set; }
        public virtual DbSet<KingQueenRoundScores> KingQueenRoundScores { get; set; }
        public virtual DbSet<UserRoles> UserRoles { get; set; }
        public virtual DbSet<UsersPlayer> UsersPlayer { get; set; }
        public virtual DbSet<LeagueTeamScore> LeagueTeamScore { get; set; }
        public virtual DbSet<LeagueTeamPlayer> LeagueTeamPlayer { get; set; }
        public virtual DbSet<LeagueSchedule> LeagueSchedule { get; set; }
        public virtual DbSet<LeagueScheduleEvent> LeagueScheduleEvent { get; set; }
        public virtual DbSet<LeagueSignInLocked> LeagueSignInLocked { get; set; }
        public virtual DbSet<KingQueenTopPlayer> KingQueenTopPlayer { get; set; }
        public virtual DbSet<LeagueDivision> LeagueDivision { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                // Secrets must come from a local environment variable, never source control.
                var connectionString = Environment.GetEnvironmentVariable("LEAGUESCRAMBLER_DB_CONNECTION");
                if (string.IsNullOrWhiteSpace(connectionString))
                {
                    throw new InvalidOperationException(
                        "Set LEAGUESCRAMBLER_DB_CONNECTION before starting LeagueScrambler.");
                }

                optionsBuilder.UseSqlServer(connectionString, sql => sql.UseCompatibilityLevel(130));
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<PickupVenue>().ToTable("PickupVenue", "dbo");
            var pickup = modelBuilder.Entity<PickupSession>().ToTable("PickupSession", "dbo");
            pickup.HasOne<User>().WithMany().HasForeignKey(session => session.OrganizerId).OnDelete(DeleteBehavior.Restrict);
            pickup.HasOne(session => session.Venue).WithMany().HasForeignKey(session => session.VenueId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<PickupGameSet>().ToTable("PickupGameSet", "dbo").HasOne<PickupSession>().WithMany()
                .HasForeignKey(set => set.SessionId).OnDelete(DeleteBehavior.Restrict);
            var registration = modelBuilder.Entity<PickupRegistration>().ToTable("PickupRegistration", "dbo");
            registration.HasOne<PickupSession>().WithMany().HasForeignKey(row => row.SessionId).OnDelete(DeleteBehavior.Restrict);
            registration.HasOne<User>().WithMany().HasForeignKey(row => row.AccountId).OnDelete(DeleteBehavior.Restrict);
            registration.HasOne<Player>().WithMany().HasForeignKey(row => row.PlayerId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<AccountRecoveryRequest>().HasIndex(request => new { request.UserId, request.CreatedUtc });
            modelBuilder.Entity<Player>().ToTable("Player", "dbo");
            modelBuilder.Entity<LeagueScheduleEvent>().ToTable("LeagueScheduleEvent", "dbo");
            modelBuilder.Entity<PlayersLeague>().ToTable("PlayersLeague", "dbo");
            modelBuilder.Entity<LeagueType>().ToTable("LeagueType", "dbo");
            modelBuilder.Entity<EventType>().ToTable("EventType", "dbo");
            var tournament = modelBuilder.Entity<TournamentConfiguration>().ToTable("TournamentConfiguration", "dbo");
            tournament.HasKey(details => details.LeagueId);
            tournament.Property(details => details.Version).IsConcurrencyToken();
            tournament.HasOne<LeagueType>().WithOne().HasForeignKey<TournamentConfiguration>(details => details.LeagueId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LeagueType>().HasOne<EventType>().WithMany()
                .HasForeignKey(league => league.EventTypeId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Password>().ToTable("Password", "dbo");
            modelBuilder.Entity<PlayerScore>().ToTable("PlayerScore", "dbo");
            modelBuilder.Entity<LeagueTeam>().ToTable("LeagueTeam", "dbo");
            modelBuilder.Entity<LeagueSchedule>()
                .HasOne(ls => ls.Team1)
                .WithMany()
                .HasForeignKey(ls => ls.Team1Id)
                .OnDelete(DeleteBehavior.Restrict); // Keep cascade for Team1Id

            modelBuilder.Entity<LeagueSchedule>()
                .HasOne(ls => ls.Team2)
                .WithMany()
                .HasForeignKey(ls => ls.Team2Id)
                .OnDelete(DeleteBehavior.Restrict); // Restrict or No Action for Team2Id

            modelBuilder.Entity<LeagueSchedule>()
                .HasOne(ls => ls.League)
                .WithMany()
                .HasForeignKey(ls => ls.LeagueId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LeagueTeamScore>()
                .HasOne(lt => lt.LeagueTeam)
                .WithMany()
                .HasForeignKey(lt => lt.LeagueTeamId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<LeagueTeamScore>()
                .HasOne(lt => lt.OpponentsTeam)
                .WithMany() // or .WithMany(...)
                .HasForeignKey(lt => lt.OpponentsLeagueTeamId)
                .OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<LeagueTeamPlayer>().ToTable("LeagueTeamPlayer", "dbo");
            modelBuilder.Entity<KingQueenPlayer>().ToTable("KingQueenPlayer", "dbo");
            modelBuilder.Entity<KingQueenTeam>().ToTable("KingQueenTeam", "dbo");
            modelBuilder.Entity<User>().ToTable("User", "dbo");
            // Match the existing dbo.User -> dbo.UserRoles FK. The plural
            // navigation name must not introduce a nonexistent shadow column.
            modelBuilder.Entity<User>()
                .HasOne(u => u.UserRoles)
                .WithMany()
                .HasForeignKey(u => u.UserRoleId);
            modelBuilder.Entity<UserLeague>().ToTable("UserLeague", "dbo");
            modelBuilder.Entity<KingQueenRoundScores>().ToTable("KingQueenRoundScores", "dbo");
            modelBuilder.Entity<ByeRounds>().ToTable("ByeRounds", "dbo");
            modelBuilder.Entity<ByePlayer>().ToTable("ByePlayer", "dbo");
            modelBuilder.Entity<LeagueSettings>().ToTable("LeagueSettings", "dbo");
            modelBuilder.Entity<PlayerSignIn>().ToTable("PlayerSignIn", "dbo");
            modelBuilder.Entity<UserRoles>().ToTable("UserRoles", "dbo");
            modelBuilder.Entity<GoogleAccount>().HasOne<User>().WithMany().HasForeignKey(link => link.UserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<UsersPlayer>().ToTable("UsersPlayer", "dbo");
            modelBuilder.Entity<LeagueSignInLocked>().ToTable("LeagueSignInLocked", "dbo"); 
            modelBuilder.Entity<KingQueenTopPlayer>().ToTable("KingQueenTopPlayer", "dbo");
        }

    }

}
