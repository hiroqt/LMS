using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace Lms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AssignmentFiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "honor_accepted_at",
                table: "submissions",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "link",
                table: "submissions",
                type: "varchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "allowed_file_types",
                table: "coursework",
                type: "varchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "honor_statement",
                table: "coursework",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "max_files",
                table: "coursework",
                type: "int",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.AddColumn<string>(
                name: "submission_kinds",
                table: "coursework",
                type: "varchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "text,file");

            migrationBuilder.CreateTable(
                name: "stored_files",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    coursework_id = table.Column<long>(type: "bigint", nullable: false),
                    owner_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    storage_key = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    name = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false),
                    content_type = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false),
                    size = table.Column<long>(type: "bigint", nullable: false),
                    content_hash = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    scan_status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    deleted_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stored_files", x => x.id);
                    table.ForeignKey(
                        name: "FK_stored_files_coursework_coursework_id",
                        column: x => x.coursework_id,
                        principalTable: "coursework",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_stored_files_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "submission_files",
                columns: table => new
                {
                    submission_id = table.Column<long>(type: "bigint", nullable: false),
                    file_id = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_submission_files", x => new { x.submission_id, x.file_id });
                    table.ForeignKey(
                        name: "FK_submission_files_stored_files_file_id",
                        column: x => x.file_id,
                        principalTable: "stored_files",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_submission_files_submissions_submission_id",
                        column: x => x.submission_id,
                        principalTable: "submissions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_stored_files_class_id",
                table: "stored_files",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "IX_stored_files_coursework_id_content_hash",
                table: "stored_files",
                columns: new[] { "coursework_id", "content_hash" });

            migrationBuilder.CreateIndex(
                name: "IX_stored_files_storage_key",
                table: "stored_files",
                column: "storage_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_submission_files_file_id",
                table: "submission_files",
                column: "file_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "submission_files");

            migrationBuilder.DropTable(
                name: "stored_files");

            migrationBuilder.DropColumn(
                name: "honor_accepted_at",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "link",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "allowed_file_types",
                table: "coursework");

            migrationBuilder.DropColumn(
                name: "honor_statement",
                table: "coursework");

            migrationBuilder.DropColumn(
                name: "max_files",
                table: "coursework");

            migrationBuilder.DropColumn(
                name: "submission_kinds",
                table: "coursework");
        }
    }
}
