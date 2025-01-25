using Allport_s_League_Scrambler.Models;
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

        public virtual DbSet<Player> Players { get; set; }
        public virtual DbSet<PlayersLeague> PlayersLeagues { get; set; }
        public virtual DbSet<LeagueType> Leagues { get; set; }
        public virtual DbSet<Password> Passwords { get; set; }
        public virtual DbSet<PlayerScore> PlayerScore { get; set; }
        public virtual DbSet<LeagueTeam> LeagueTeam { get; set; }
        public virtual DbSet<KingQueenTeam> KingQueenTeam { get; set; }
        public virtual DbSet<KingQueenPlayer> KingQueenPlayer { get; set; }
        public virtual DbSet<User> Users { get; set; }
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
        public virtual DbSet<LeagueSignInLocked> LeagueSignInLocked { get; set; }
        public virtual DbSet<KingQueenTopPlayer> KingQueenTopPlayer { get; set; }
        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                optionsBuilder.UseSqlServer(@"Server=localhost;Database=LeagueScrambler;User Id=AllportDB;Password=Sephiroth3;");
                //optionsBuilder.UseSqlServer(@"Server=localhost;Database=LeagueScrambler;Integrated Security=True;");

                //optionsBuilder.UseSqlServer(System.Configuration.ConfigurationManager.
                //    ConnectionStrings["LeagueDBConnectionString"].ConnectionString);
                //optionsBuilder.UseSqlServer(@"workstation id=LeagueScrambler.mssql.somee.com;packet size=4096;user id=allport;pwd=Sephiroth3;data source=LeagueScrambler.mssql.somee.com;persist security info=False;initial catalog=LeagueScrambler");
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Player>().ToTable("Player", "dbo");
            modelBuilder.Entity<PlayersLeague>().ToTable("PlayersLeague", "dbo");
            modelBuilder.Entity<LeagueType>().ToTable("LeagueType", "dbo");
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
            modelBuilder.Entity<UserLeague>().ToTable("UserLeague", "dbo");
            modelBuilder.Entity<KingQueenRoundScores>().ToTable("KingQueenRoundScores", "dbo");
            modelBuilder.Entity<ByeRounds>().ToTable("ByeRounds", "dbo");
            modelBuilder.Entity<ByePlayer>().ToTable("ByePlayer", "dbo");
            modelBuilder.Entity<LeagueSettings>().ToTable("LeagueSettings", "dbo");
            modelBuilder.Entity<PlayerSignIn>().ToTable("PlayerSignIn", "dbo");
            modelBuilder.Entity<UserRoles>().ToTable("UserRoles", "dbo");
            modelBuilder.Entity<UsersPlayer>().ToTable("UsersPlayer", "dbo");
            modelBuilder.Entity<LeagueSignInLocked>().ToTable("LeagueSignInLocked", "dbo"); 
            modelBuilder.Entity<KingQueenTopPlayer>().ToTable("KingQueenTopPlayer", "dbo");
        }

    }

}
