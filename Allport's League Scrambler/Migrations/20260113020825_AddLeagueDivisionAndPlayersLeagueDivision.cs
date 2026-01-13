using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Allport_s_League_Scrambler.Migrations
{
    public partial class AddLeagueDivisionAndPlayersLeagueDivision : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LeagueDivisionId",
                schema: "dbo",
                table: "PlayersLeague",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LeagueDivision",
                columns: table => new
                {
                    Id = table.Column<int>(nullable: false)
                        .Annotation("SqlServer:ValueGenerationStrategy", SqlServerValueGenerationStrategy.IdentityColumn),
                    LeagueID = table.Column<int>(nullable: false),
                    Code = table.Column<string>(nullable: true),
                    Name = table.Column<string>(nullable: true),
                    SortOrder = table.Column<int>(nullable: false),
                    LeagueTypeID = table.Column<int>(nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeagueDivision", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LeagueDivision_LeagueType_LeagueTypeID",
                        column: x => x.LeagueTypeID,
                        principalSchema: "dbo",
                        principalTable: "LeagueType",
                        principalColumn: "ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PlayersLeague_LeagueDivisionId",
                schema: "dbo",
                table: "PlayersLeague",
                column: "LeagueDivisionId");

            migrationBuilder.CreateIndex(
                name: "IX_LeagueDivision_LeagueTypeID",
                table: "LeagueDivision",
                column: "LeagueTypeID");

            migrationBuilder.AddForeignKey(
                name: "FK_PlayersLeague_LeagueDivision_LeagueDivisionId",
                schema: "dbo",
                table: "PlayersLeague",
                column: "LeagueDivisionId",
                principalTable: "LeagueDivision",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PlayersLeague_LeagueDivision_LeagueDivisionId",
                schema: "dbo",
                table: "PlayersLeague");

            migrationBuilder.DropTable(
                name: "LeagueDivision");

            migrationBuilder.DropIndex(
                name: "IX_PlayersLeague_LeagueDivisionId",
                schema: "dbo",
                table: "PlayersLeague");

            migrationBuilder.DropColumn(
                name: "LeagueDivisionId",
                schema: "dbo",
                table: "PlayersLeague");
        }
    }
}
