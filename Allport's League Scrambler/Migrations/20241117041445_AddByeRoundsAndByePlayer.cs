using Microsoft.EntityFrameworkCore.Migrations;
using System;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class AddByeRoundsAndByePlayer : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Create the ByeRounds table
            migrationBuilder.CreateTable(
                name: "ByeRounds",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeagueID = table.Column<int>(nullable: false),
                    DateOfRound = table.Column<DateTime>(nullable: false),
                    ScrambleNumber = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ByeRounds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ByeRounds_LeagueType_LeagueID",
                        column: x => x.LeagueID,
                        principalTable: "LeagueType",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Create the ByePlayer table
            migrationBuilder.CreateTable(
                name: "ByePlayer",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ByeRoundId = table.Column<int>(nullable: false),
                    PlayerId = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ByePlayer", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ByePlayer_ByeRounds_ByeRoundId",
                        column: x => x.ByeRoundId,
                        principalTable: "ByeRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ByePlayer_Player_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Player",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Indexes for optimization
            migrationBuilder.CreateIndex(
                name: "IX_ByeRounds_LeagueID",
                table: "ByeRounds",
                column: "LeagueID");

            migrationBuilder.CreateIndex(
                name: "IX_ByePlayer_ByeRoundId",
                table: "ByePlayer",
                column: "ByeRoundId");

            migrationBuilder.CreateIndex(
                name: "IX_ByePlayer_PlayerId",
                table: "ByePlayer",
                column: "PlayerId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Drop the ByePlayer table
            migrationBuilder.DropTable(
                name: "ByePlayer");

            // Drop the ByeRounds table
            migrationBuilder.DropTable(
                name: "ByeRounds");
        }
    }
}
