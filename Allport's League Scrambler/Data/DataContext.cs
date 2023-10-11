using Allport_s_League_Scrambler.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Allport_s_League_Scrambler.Data
{
    public class DataContext: DbContext
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
        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            if (!optionsBuilder.IsConfigured)
            {
                optionsBuilder.UseSqlServer(@"Server=localhost;Database=LeagueScrambler;User Id=AllportDB;Password=Sephiroth3;");

                //optionsBuilder.UseSqlServer(System.Configuration.ConfigurationManager.
                //    ConnectionStrings["LeagueDBConnectionString"].ConnectionString);
                //optionsBuilder.UseSqlServer(@"workstation id=LeagueScrambler.mssql.somee.com;packet size=4096;user id=allport;pwd=Sephiroth3;data source=LeagueScrambler.mssql.somee.com;persist security info=False;initial catalog=LeagueScrambler");
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Player>().ToTable("Player");
            modelBuilder.Entity<PlayersLeague>().ToTable("PlayersLeague");
            modelBuilder.Entity<LeagueType>().ToTable("LeagueType");
            modelBuilder.Entity<Password>().ToTable("Password");
            modelBuilder.Entity<PlayerScore>().ToTable("PlayerScore");
            modelBuilder.Entity<LeagueTeam>().ToTable("LeagueTeam");
            modelBuilder.Entity<TeamScore>().ToTable("TeamScore");
            modelBuilder.Entity<KingQueenPlayer>().ToTable("KingQueenPlayer");
            modelBuilder.Entity<KingQueenTeam>().ToTable("KingQueenTeam");
        }

        }
    
}
