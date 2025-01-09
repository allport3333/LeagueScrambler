using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class UpdatedLeagueTeamModels2 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TeamScore",
                schema: "dbo");

            migrationBuilder.CreateTable(
                name: "LeagueTeamScore",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    LeagueTeamId = table.Column<int>(nullable: false),
                    OpponentsLeagueTeamId = table.Column<int>(nullable: false),
                    TeamScore = table.Column<int>(nullable: false),
                    WonGame = table.Column<bool>(nullable: false),
                    Date = table.Column<DateTime>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeagueTeamScore", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeagueTeamScore_LeagueTeam_LeagueTeamId",
                        column: x => x.LeagueTeamId,
                        principalSchema: "dbo",
                        principalTable: "LeagueTeam",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeagueTeamScore_LeagueTeam_OpponentsLeagueTeamId",
                        column: x => x.OpponentsLeagueTeamId,
                        principalSchema: "dbo",
                        principalTable: "LeagueTeam",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LeagueTeamPlayer",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    LeagueTeamId = table.Column<int>(nullable: false),
                    PlayerId = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeagueTeamPlayer", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeagueTeamPlayer_LeagueTeam_LeagueTeamId",
                        column: x => x.LeagueTeamId,
                        principalSchema: "dbo",
                        principalTable: "LeagueTeam",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeagueTeamPlayer_Player_PlayerId",
                        column: x => x.PlayerId,
                        principalSchema: "dbo",
                        principalTable: "Player",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LeagueTeamScore_LeagueTeamId",
                table: "LeagueTeamScore",
                column: "LeagueTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_LeagueTeamScore_OpponentsLeagueTeamId",
                table: "LeagueTeamScore",
                column: "OpponentsLeagueTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_LeagueTeamPlayer_LeagueTeamId",
                schema: "dbo",
                table: "LeagueTeamPlayer",
                column: "LeagueTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_LeagueTeamPlayer_PlayerId",
                schema: "dbo",
                table: "LeagueTeamPlayer",
                column: "PlayerId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LeagueTeamScore");

            migrationBuilder.DropTable(
                name: "LeagueTeamPlayer",
                schema: "dbo");

            migrationBuilder.CreateTable(
                name: "TeamScore",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    Date = table.Column<DateTime>(nullable: false),
                    Team1ID = table.Column<int>(nullable: false),
                    Team1Score = table.Column<int>(nullable: false),
                    Team2ID = table.Column<int>(nullable: false),
                    Team2Score = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TeamScore", x => x.Id);
                });
        }
    }
}
