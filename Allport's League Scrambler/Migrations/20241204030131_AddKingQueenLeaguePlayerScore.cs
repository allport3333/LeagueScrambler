using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class AddKingQueenLeaguePlayerScore : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "UserLeague",
                newName: "UserLeague",
                newSchema: "dbo");

            migrationBuilder.RenameTable(
                name: "User",
                newName: "User",
                newSchema: "dbo");

            migrationBuilder.AddColumn<int>(
                name: "KingQueenPlayerId",
                schema: "dbo",
                table: "PlayerScore",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ByeRounds",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
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
                        principalSchema: "dbo",
                        principalTable: "LeagueType",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ByePlayer",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    ByeRoundId = table.Column<int>(nullable: false),
                    PlayerId = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ByePlayer", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ByePlayer_ByeRounds_ByeRoundId",
                        column: x => x.ByeRoundId,
                        principalSchema: "dbo",
                        principalTable: "ByeRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ByePlayer_Player_PlayerId",
                        column: x => x.PlayerId,
                        principalSchema: "dbo",
                        principalTable: "Player",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerScore_KingQueenPlayerId",
                schema: "dbo",
                table: "PlayerScore",
                column: "KingQueenPlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_ByePlayer_ByeRoundId",
                schema: "dbo",
                table: "ByePlayer",
                column: "ByeRoundId");

            migrationBuilder.CreateIndex(
                name: "IX_ByePlayer_PlayerId",
                schema: "dbo",
                table: "ByePlayer",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_ByeRounds_LeagueID",
                schema: "dbo",
                table: "ByeRounds",
                column: "LeagueID");

            migrationBuilder.AddForeignKey(
                name: "FK_PlayerScore_KingQueenPlayer_KingQueenPlayerId",
                schema: "dbo",
                table: "PlayerScore",
                column: "KingQueenPlayerId",
                principalSchema: "dbo",
                principalTable: "KingQueenPlayer",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PlayerScore_KingQueenPlayer_KingQueenPlayerId",
                schema: "dbo",
                table: "PlayerScore");

            migrationBuilder.DropTable(
                name: "ByePlayer",
                schema: "dbo");

            migrationBuilder.DropTable(
                name: "ByeRounds",
                schema: "dbo");

            migrationBuilder.DropIndex(
                name: "IX_PlayerScore_KingQueenPlayerId",
                schema: "dbo",
                table: "PlayerScore");

            migrationBuilder.DropColumn(
                name: "KingQueenPlayerId",
                schema: "dbo",
                table: "PlayerScore");

            migrationBuilder.RenameTable(
                name: "UserLeague",
                schema: "dbo",
                newName: "UserLeague");

            migrationBuilder.RenameTable(
                name: "User",
                schema: "dbo",
                newName: "User");
        }
    }
}
