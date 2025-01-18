using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class AddLockSignInStatus1 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LeagueTypeID",
                schema: "dbo",
                table: "LeagueSignInLocked",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_LeagueSignInLocked_LeagueTypeID",
                schema: "dbo",
                table: "LeagueSignInLocked",
                column: "LeagueTypeID");

            migrationBuilder.AddForeignKey(
                name: "FK_LeagueSignInLocked_LeagueType_LeagueTypeID",
                schema: "dbo",
                table: "LeagueSignInLocked",
                column: "LeagueTypeID",
                principalSchema: "dbo",
                principalTable: "LeagueType",
                principalColumn: "ID",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_LeagueSignInLocked_LeagueType_LeagueTypeID",
                schema: "dbo",
                table: "LeagueSignInLocked");

            migrationBuilder.DropIndex(
                name: "IX_LeagueSignInLocked_LeagueTypeID",
                schema: "dbo",
                table: "LeagueSignInLocked");

            migrationBuilder.DropColumn(
                name: "LeagueTypeID",
                schema: "dbo",
                table: "LeagueSignInLocked");
        }
    }
}
