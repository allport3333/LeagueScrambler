﻿// <auto-generated />
using System;
using Allport_s_League_Scrambler.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Allport_s_League_Scrambler.Migrations
{
    [DbContext(typeof(DataContext))]
    [Migration("20241221023239_addSubScore")]
    partial class addSubScore
    {
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "2.2.6-servicing-10079")
                .HasAnnotation("Relational:MaxIdentifierLength", 128)
                .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.ByePlayer", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<int>("ByeRoundId");

                    b.Property<int>("PlayerId");

                    b.HasKey("Id");

                    b.HasIndex("ByeRoundId");

                    b.HasIndex("PlayerId");

                    b.ToTable("ByePlayer","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.ByeRounds", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<DateTime>("DateOfRound");

                    b.Property<int>("LeagueID");

                    b.Property<int>("ScrambleNumber");

                    b.HasKey("Id");

                    b.HasIndex("LeagueID");

                    b.ToTable("ByeRounds","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.KingQueenPlayer", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<int>("KingQueenTeamId");

                    b.Property<int>("PlayerId");

                    b.HasKey("Id");

                    b.HasIndex("KingQueenTeamId");

                    b.HasIndex("PlayerId");

                    b.ToTable("KingQueenPlayer","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.KingQueenRoundScores", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<int>("KingQueenTeamId");

                    b.Property<int>("RoundId");

                    b.Property<int>("RoundScore");

                    b.Property<bool?>("RoundWon");

                    b.Property<bool?>("isSubScore");

                    b.HasKey("Id");

                    b.HasIndex("KingQueenTeamId");

                    b.ToTable("KingQueenRoundScores","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.KingQueenTeam", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<DateTime>("DateOfTeam");

                    b.Property<int>("LeagueID");

                    b.Property<int>("ScrambleNumber");

                    b.HasKey("Id");

                    b.ToTable("KingQueenTeam","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.LeagueTeam", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<int>("LeagueID");

                    b.Property<string>("TeamName");

                    b.Property<int>("TotalLosses");

                    b.Property<int>("TotalWins");

                    b.HasKey("Id");

                    b.ToTable("LeagueTeam","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.LeagueType", b =>
                {
                    b.Property<int>("ID")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<string>("LeagueName");

                    b.HasKey("ID");

                    b.ToTable("LeagueType","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.Password", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<string>("password");

                    b.HasKey("Id");

                    b.ToTable("Password","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.Player", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<string>("FirstName");

                    b.Property<string>("Gender");

                    b.Property<bool>("IsMale");

                    b.Property<bool?>("IsSub");

                    b.Property<string>("LastName");

                    b.HasKey("Id");

                    b.ToTable("Player","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.PlayerScore", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<DateTime>("Date");

                    b.Property<int?>("KingQueenPlayerId");

                    b.Property<int>("PlayersLeagueID");

                    b.Property<int>("PlayersTotalLeagueScore");

                    b.HasKey("Id");

                    b.HasIndex("KingQueenPlayerId");

                    b.HasIndex("PlayersLeagueID");

                    b.ToTable("PlayerScore","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.PlayersLeague", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<bool?>("IsSub");

                    b.Property<int>("LeagueID");

                    b.Property<int?>("LeagueTypeID");

                    b.Property<int>("PlayerID");

                    b.HasKey("Id");

                    b.HasIndex("LeagueTypeID");

                    b.HasIndex("PlayerID");

                    b.ToTable("PlayersLeague","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.TeamScore", b =>
                {
                    b.Property<int>("Id")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<DateTime>("Date");

                    b.Property<int>("Team1ID");

                    b.Property<int>("Team1Score");

                    b.Property<int>("Team2ID");

                    b.Property<int>("Team2Score");

                    b.HasKey("Id");

                    b.ToTable("TeamScore","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.User", b =>
                {
                    b.Property<int>("UserId")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<DateTime>("CreatedAt");

                    b.Property<string>("Email");

                    b.Property<string>("FirstName");

                    b.Property<bool>("IsAdmin");

                    b.Property<DateTime>("LastLogin");

                    b.Property<string>("LastName");

                    b.Property<string>("LoginName");

                    b.Property<byte[]>("PasswordHash");

                    b.Property<byte[]>("PasswordSalt");

                    b.Property<string>("ResetToken");

                    b.HasKey("UserId");

                    b.ToTable("User","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.UserLeague", b =>
                {
                    b.Property<int>("UserLeagueId")
                        .ValueGeneratedOnAdd()
                        .HasAnnotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn);

                    b.Property<int>("LeagueTypeId");

                    b.Property<int>("UserId");

                    b.HasKey("UserLeagueId");

                    b.HasIndex("LeagueTypeId");

                    b.HasIndex("UserId");

                    b.ToTable("UserLeague","dbo");
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.ByePlayer", b =>
                {
                    b.HasOne("Allport_s_League_Scrambler.Models.ByeRounds", "ByeRound")
                        .WithMany("ByePlayers")
                        .HasForeignKey("ByeRoundId")
                        .OnDelete(DeleteBehavior.Cascade);

                    b.HasOne("Allport_s_League_Scrambler.Models.Player", "Player")
                        .WithMany()
                        .HasForeignKey("PlayerId")
                        .OnDelete(DeleteBehavior.Cascade);
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.ByeRounds", b =>
                {
                    b.HasOne("Allport_s_League_Scrambler.Models.LeagueType", "LeagueType")
                        .WithMany()
                        .HasForeignKey("LeagueID")
                        .OnDelete(DeleteBehavior.Cascade);
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.KingQueenPlayer", b =>
                {
                    b.HasOne("Allport_s_League_Scrambler.Models.KingQueenTeam")
                        .WithMany("KingQueenPlayers")
                        .HasForeignKey("KingQueenTeamId")
                        .OnDelete(DeleteBehavior.Cascade);

                    b.HasOne("Allport_s_League_Scrambler.Models.Player", "Player")
                        .WithMany()
                        .HasForeignKey("PlayerId")
                        .OnDelete(DeleteBehavior.Cascade);
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.KingQueenRoundScores", b =>
                {
                    b.HasOne("Allport_s_League_Scrambler.Models.KingQueenTeam")
                        .WithMany("KingQueenRoundScores")
                        .HasForeignKey("KingQueenTeamId")
                        .OnDelete(DeleteBehavior.Cascade);
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.PlayerScore", b =>
                {
                    b.HasOne("Allport_s_League_Scrambler.Models.KingQueenPlayer", "KingQueenPlayer")
                        .WithMany()
                        .HasForeignKey("KingQueenPlayerId");

                    b.HasOne("Allport_s_League_Scrambler.Models.PlayersLeague", "PlayersLeague")
                        .WithMany()
                        .HasForeignKey("PlayersLeagueID")
                        .OnDelete(DeleteBehavior.Cascade);
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.PlayersLeague", b =>
                {
                    b.HasOne("Allport_s_League_Scrambler.Models.LeagueType", "LeagueType")
                        .WithMany()
                        .HasForeignKey("LeagueTypeID");

                    b.HasOne("Allport_s_League_Scrambler.Models.Player", "Player")
                        .WithMany()
                        .HasForeignKey("PlayerID")
                        .OnDelete(DeleteBehavior.Cascade);
                });

            modelBuilder.Entity("Allport_s_League_Scrambler.Models.UserLeague", b =>
                {
                    b.HasOne("Allport_s_League_Scrambler.Models.LeagueType", "LeagueType")
                        .WithMany()
                        .HasForeignKey("LeagueTypeId")
                        .OnDelete(DeleteBehavior.Cascade);

                    b.HasOne("Allport_s_League_Scrambler.Models.User", "User")
                        .WithMany()
                        .HasForeignKey("UserId")
                        .OnDelete(DeleteBehavior.Cascade);
                });
#pragma warning restore 612, 618
        }
    }
}
