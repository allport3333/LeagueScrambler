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
        public virtual DbSet<TeamScore> TeamScore { get; set; }
        public virtual DbSet<KingQueenTeam> KingQueenTeam { get; set; }
        public virtual DbSet<KingQueenPlayer> KingQueenPlayer { get; set; }
        public virtual DbSet<User> Users { get; set; }
        public virtual DbSet<UserLeague> UserLeagues { get; set; }
        public virtual DbSet<ByeRounds> ByeRounds { get; set; }
        public virtual DbSet<ByePlayer> ByePlayer { get; set; }
        public virtual DbSet<LeagueSettings> LeagueSettings { get; set; }       
        public virtual DbSet<PlayerSignIn> PlayerSignIn { get; set; }
        public virtual DbSet<KingQueenRoundScores> KingQueenRoundScores { get; set; }
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
            modelBuilder.Entity<TeamScore>().ToTable("TeamScore", "dbo");
            modelBuilder.Entity<KingQueenPlayer>().ToTable("KingQueenPlayer", "dbo");
            modelBuilder.Entity<KingQueenTeam>().ToTable("KingQueenTeam", "dbo");
            modelBuilder.Entity<User>().ToTable("User", "dbo");
            modelBuilder.Entity<UserLeague>().ToTable("UserLeague", "dbo");
            modelBuilder.Entity<KingQueenRoundScores>().ToTable("KingQueenRoundScores", "dbo");
            modelBuilder.Entity<ByeRounds>().ToTable("ByeRounds", "dbo");
            modelBuilder.Entity<ByePlayer>().ToTable("ByePlayer", "dbo");
            modelBuilder.Entity<LeagueSettings>().ToTable("LeagueSettings", "dbo");
            modelBuilder.Entity<PlayerSignIn>().ToTable("PlayerSignIn", "dbo");
        }

    }

}
