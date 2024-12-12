using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class StandingsUpdate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "PlayersTotalRoundScore",
                schema: "dbo",
                table: "PlayerScore",
                newName: "PlayersTotalLeagueScore");

            migrationBuilder.AddColumn<int>(
                name: "LeagueTypeID",
                schema: "dbo",
                table: "PlayersLeague",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PlayersLeague_LeagueTypeID",
                schema: "dbo",
                table: "PlayersLeague",
                column: "LeagueTypeID");

            migrationBuilder.CreateIndex(
                name: "IX_PlayersLeague_PlayerID",
                schema: "dbo",
                table: "PlayersLeague",
                column: "PlayerID");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerScore_PlayersLeagueID",
                schema: "dbo",
                table: "PlayerScore",
                column: "PlayersLeagueID");

            migrationBuilder.AddForeignKey(
                name: "FK_PlayerScore_PlayersLeague_PlayersLeagueID",
                schema: "dbo",
                table: "PlayerScore",
                column: "PlayersLeagueID",
                principalSchema: "dbo",
                principalTable: "PlayersLeague",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_PlayersLeague_LeagueType_LeagueTypeID",
                schema: "dbo",
                table: "PlayersLeague",
                column: "LeagueTypeID",
                principalSchema: "dbo",
                principalTable: "LeagueType",
                principalColumn: "ID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PlayersLeague_Player_PlayerID",
                schema: "dbo",
                table: "PlayersLeague",
                column: "PlayerID",
                principalSchema: "dbo",
                principalTable: "Player",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PlayerScore_PlayersLeague_PlayersLeagueID",
                schema: "dbo",
                table: "PlayerScore");

            migrationBuilder.DropForeignKey(
                name: "FK_PlayersLeague_LeagueType_LeagueTypeID",
                schema: "dbo",
                table: "PlayersLeague");

            migrationBuilder.DropForeignKey(
                name: "FK_PlayersLeague_Player_PlayerID",
                schema: "dbo",
                table: "PlayersLeague");

            migrationBuilder.DropIndex(
                name: "IX_PlayersLeague_LeagueTypeID",
                schema: "dbo",
                table: "PlayersLeague");

            migrationBuilder.DropIndex(
                name: "IX_PlayersLeague_PlayerID",
                schema: "dbo",
                table: "PlayersLeague");

            migrationBuilder.DropIndex(
                name: "IX_PlayerScore_PlayersLeagueID",
                schema: "dbo",
                table: "PlayerScore");

            migrationBuilder.DropColumn(
                name: "LeagueTypeID",
                schema: "dbo",
                table: "PlayersLeague");

            migrationBuilder.RenameColumn(
                name: "PlayersTotalLeagueScore",
                schema: "dbo",
                table: "PlayerScore",
                newName: "PlayersTotalRoundScore");
        }
    }
}
