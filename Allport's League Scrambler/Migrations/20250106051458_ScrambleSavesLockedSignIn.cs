using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class ScrambleSavesLockedSignIn : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "LockedSignIn",
                schema: "dbo",
                table: "PlayerSignIn",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ScrambleWithScoresToBeSaved",
                schema: "dbo",
                table: "KingQueenTeam",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LockedSignIn",
                schema: "dbo",
                table: "PlayerSignIn");

            migrationBuilder.DropColumn(
                name: "ScrambleWithScoresToBeSaved",
                schema: "dbo",
                table: "KingQueenTeam");
        }
    }
}
