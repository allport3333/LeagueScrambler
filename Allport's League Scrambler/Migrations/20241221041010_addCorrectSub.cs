using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class addCorrectSub : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "isSubScore",
                schema: "dbo",
                table: "KingQueenRoundScores");

            migrationBuilder.AddColumn<bool>(
                name: "isSubScore",
                schema: "dbo",
                table: "KingQueenPlayer",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "isSubScore",
                schema: "dbo",
                table: "KingQueenPlayer");

            migrationBuilder.AddColumn<bool>(
                name: "isSubScore",
                schema: "dbo",
                table: "KingQueenRoundScores",
                nullable: true);
        }
    }
}
