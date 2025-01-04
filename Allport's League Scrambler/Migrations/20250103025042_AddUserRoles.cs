using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class AddUserRoles : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserRoleId",
                schema: "dbo",
                table: "User",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UserRoles",
                schema: "dbo",
                columns: table => new
                {
                    UserRoleId = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    RoleName = table.Column<string>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRoles", x => x.UserRoleId);
                });

            migrationBuilder.CreateIndex(
                name: "IX_User_UserRoleId",
                schema: "dbo",
                table: "User",
                column: "UserRoleId");

            migrationBuilder.AddForeignKey(
                name: "FK_User_UserRoles_UserRoleId",
                schema: "dbo",
                table: "User",
                column: "UserRoleId",
                principalSchema: "dbo",
                principalTable: "UserRoles",
                principalColumn: "UserRoleId",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_User_UserRoles_UserRoleId",
                schema: "dbo",
                table: "User");

            migrationBuilder.DropTable(
                name: "UserRoles",
                schema: "dbo");

            migrationBuilder.DropIndex(
                name: "IX_User_UserRoleId",
                schema: "dbo",
                table: "User");

            migrationBuilder.DropColumn(
                name: "UserRoleId",
                schema: "dbo",
                table: "User");
        }
    }
}
