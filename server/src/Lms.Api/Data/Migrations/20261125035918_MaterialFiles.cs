using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MaterialFiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<long>(
                name: "coursework_id",
                table: "stored_files",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<long>(
                name: "file_id",
                table: "materials",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "preview_file_id",
                table: "materials",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "preview_status",
                table: "materials",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_materials_file_id",
                table: "materials",
                column: "file_id");

            migrationBuilder.CreateIndex(
                name: "IX_materials_preview_file_id",
                table: "materials",
                column: "preview_file_id");

            migrationBuilder.AddForeignKey(
                name: "FK_materials_stored_files_file_id",
                table: "materials",
                column: "file_id",
                principalTable: "stored_files",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_materials_stored_files_preview_file_id",
                table: "materials",
                column: "preview_file_id",
                principalTable: "stored_files",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_materials_stored_files_file_id",
                table: "materials");

            migrationBuilder.DropForeignKey(
                name: "FK_materials_stored_files_preview_file_id",
                table: "materials");

            migrationBuilder.DropIndex(
                name: "IX_materials_file_id",
                table: "materials");

            migrationBuilder.DropIndex(
                name: "IX_materials_preview_file_id",
                table: "materials");

            migrationBuilder.DropColumn(
                name: "file_id",
                table: "materials");

            migrationBuilder.DropColumn(
                name: "preview_file_id",
                table: "materials");

            migrationBuilder.DropColumn(
                name: "preview_status",
                table: "materials");

            // Material files have no assignment, so they can't stay once coursework_id is required
            // again. Their rows go; their bytes stay in the file store, unreferenced.
            migrationBuilder.Sql("DELETE FROM stored_files WHERE coursework_id IS NULL;");

            migrationBuilder.AlterColumn<long>(
                name: "coursework_id",
                table: "stored_files",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);
        }
    }
}
