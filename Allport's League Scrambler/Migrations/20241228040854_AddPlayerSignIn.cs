using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class AddPlayerSignIn : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "LeagueSettings",
                newName: "LeagueSettings",
                newSchema: "dbo");

            migrationBuilder.CreateTable(
                name: "PlayerSignIn",
                schema: "dbo",
                columns: table => new
                {
                    PlayerSignInId = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    DateTime = table.Column<DateTime>(nullable: false),
                    LeagueId = table.Column<int>(nullable: false),
                    PlayerId = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlayerSignIn", x => x.PlayerSignInId);
                    table.ForeignKey(
                        name: "FK_PlayerSignIn_LeagueType_LeagueId",
                        column: x => x.LeagueId,
                        principalSchema: "dbo",
                        principalTable: "LeagueType",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PlayerSignIn_Player_PlayerId",
                        column: x => x.PlayerId,
                        principalSchema: "dbo",
                        principalTable: "Player",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayerSignIn_LeagueId",
                schema: "dbo",
                table: "PlayerSignIn",
                column: "LeagueId");

            migrationBuilder.CreateIndex(
                name: "IX_PlayerSignIn_PlayerId",
                schema: "dbo",
                table: "PlayerSignIn",
                column: "PlayerId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlayerSignIn",
                schema: "dbo");

            migrationBuilder.RenameTable(
                name: "LeagueSettings",
                schema: "dbo",
                newName: "LeagueSettings");
        }
    }
}
