using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class UsersPlayersAdded : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UsersPlayer",
                schema: "dbo",
                columns: table => new
                {
                    UsersPlayerId = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(nullable: false),
                    PlayerId = table.Column<int>(nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsersPlayer", x => x.UsersPlayerId);
                    table.ForeignKey(
                        name: "FK_UsersPlayer_Player_PlayerId",
                        column: x => x.PlayerId,
                        principalSchema: "dbo",
                        principalTable: "Player",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UsersPlayer_User_UserId",
                        column: x => x.UserId,
                        principalSchema: "dbo",
                        principalTable: "User",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UsersPlayer_PlayerId",
                schema: "dbo",
                table: "UsersPlayer",
                column: "PlayerId");

            migrationBuilder.CreateIndex(
                name: "IX_UsersPlayer_UserId",
                schema: "dbo",
                table: "UsersPlayer",
                column: "UserId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UsersPlayer",
                schema: "dbo");
        }
    }
}
