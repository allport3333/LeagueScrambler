using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class AddTopPlayerDBTable : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "KingQueenTopPlayer",
                schema: "dbo",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    PlayerId = table.Column<int>(nullable: false),
                    LeagueId = table.Column<int>(nullable: false),
                    Rank = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KingQueenTopPlayer", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KingQueenTopPlayer_LeagueType_LeagueId",
                        column: x => x.LeagueId,
                        principalSchema: "dbo",
                        principalTable: "LeagueType",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_KingQueenTopPlayer_Player_PlayerId",
                        column: x => x.PlayerId,
                        principalSchema: "dbo",
                        principalTable: "Player",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_KingQueenTopPlayer_LeagueId",
                schema: "dbo",
                table: "KingQueenTopPlayer",
                column: "LeagueId");

            migrationBuilder.CreateIndex(
                name: "IX_KingQueenTopPlayer_PlayerId",
                schema: "dbo",
                table: "KingQueenTopPlayer",
                column: "PlayerId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KingQueenTopPlayer",
                schema: "dbo");
        }
    }
}
