using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class AddKingQueenLeagueRoundScore : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "PlayersScore",
                schema: "dbo",
                table: "PlayerScore",
                newName: "PlayersTotalRoundScore");

            migrationBuilder.CreateTable(
                name: "KingQueenRoundScores",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    KingQueenTeamId = table.Column<int>(nullable: false),
                    RoundScore = table.Column<int>(nullable: false),
                    RoundWon = table.Column<bool>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KingQueenRoundScores", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KingQueenRoundScores_KingQueenTeam_KingQueenTeamId",
                        column: x => x.KingQueenTeamId,
                        principalSchema: "dbo",
                        principalTable: "KingQueenTeam",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_KingQueenRoundScores_KingQueenTeamId",
                schema: "dbo",
                table: "KingQueenRoundScores",
                column: "KingQueenTeamId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KingQueenRoundScores",
                schema: "dbo");

            migrationBuilder.RenameColumn(
                name: "PlayersTotalRoundScore",
                schema: "dbo",
                table: "PlayerScore",
                newName: "PlayersScore");
        }
    }
}
