using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class AddKingQueenPlayer : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "KingQueenTeam",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    LeagueID = table.Column<int>(nullable: false),
                    DateOfTeam = table.Column<DateTime>(nullable: false),
                    ScrambleNumber = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KingQueenTeam", x => x.Id);
                });           

            migrationBuilder.CreateTable(
                name: "KingQueenPlayer",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    KingQueenTeamId = table.Column<int>(nullable: false),
                    PlayerId = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KingQueenPlayer", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KingQueenPlayer_KingQueenTeam_KingQueenTeamId",
                        column: x => x.KingQueenTeamId,
                        principalTable: "KingQueenTeam",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_KingQueenPlayer_Player_PlayerId",
                        column: x => x.PlayerId,
                        principalTable: "Player",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_KingQueenPlayer_KingQueenTeamId",
                table: "KingQueenPlayer",
                column: "KingQueenTeamId");

            migrationBuilder.CreateIndex(
                name: "IX_KingQueenPlayer_PlayerId",
                table: "KingQueenPlayer",
                column: "PlayerId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KingQueenPlayer");

            migrationBuilder.DropTable(
                name: "KingQueenTeam");


        }
    }
}
