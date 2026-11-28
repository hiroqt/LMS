using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace Lms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class DiscussionComments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "comments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    target_type = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    target_id = table.Column<long>(type: "bigint", nullable: false),
                    visibility = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    student_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    author_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    author_role = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    body = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_comments", x => x.id);
                    table.ForeignKey(
                        name: "FK_comments_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_comments_class_id",
                table: "comments",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "IX_comments_target_type_target_id_visibility_student_id",
                table: "comments",
                columns: new[] { "target_type", "target_id", "visibility", "student_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "comments");
        }
    }
}
