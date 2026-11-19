using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace Lms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AssignmentPhase3 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "penalty_waived",
                table: "grades",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "late_penalty_max_percent",
                table: "coursework",
                type: "int",
                nullable: false,
                defaultValue: 100);

            migrationBuilder.AddColumn<int>(
                name: "late_penalty_percent_per_day",
                table: "coursework",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "rubric_id",
                table: "coursework",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "coursework_exceptions",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    coursework_id = table.Column<long>(type: "bigint", nullable: false),
                    student_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    due_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    close_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    excused = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_coursework_exceptions", x => x.id);
                    table.ForeignKey(
                        name: "FK_coursework_exceptions_coursework_coursework_id",
                        column: x => x.coursework_id,
                        principalTable: "coursework",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "rubrics",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rubrics", x => x.id);
                    table.ForeignKey(
                        name: "FK_rubrics_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "saved_comments",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    owner_instructor_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    text = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_saved_comments", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "rubric_criteria",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    rubric_id = table.Column<long>(type: "bigint", nullable: false),
                    title = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rubric_criteria", x => x.id);
                    table.ForeignKey(
                        name: "FK_rubric_criteria_rubrics_rubric_id",
                        column: x => x.rubric_id,
                        principalTable: "rubrics",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "rubric_levels",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    criterion_id = table.Column<long>(type: "bigint", nullable: false),
                    title = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false),
                    description = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                    points = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rubric_levels", x => x.id);
                    table.ForeignKey(
                        name: "FK_rubric_levels_rubric_criteria_criterion_id",
                        column: x => x.criterion_id,
                        principalTable: "rubric_criteria",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "grade_rubric_scores",
                columns: table => new
                {
                    grade_id = table.Column<long>(type: "bigint", nullable: false),
                    criterion_id = table.Column<long>(type: "bigint", nullable: false),
                    level_id = table.Column<long>(type: "bigint", nullable: false),
                    points = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_grade_rubric_scores", x => new { x.grade_id, x.criterion_id });
                    table.ForeignKey(
                        name: "FK_grade_rubric_scores_grades_grade_id",
                        column: x => x.grade_id,
                        principalTable: "grades",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_grade_rubric_scores_rubric_criteria_criterion_id",
                        column: x => x.criterion_id,
                        principalTable: "rubric_criteria",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_grade_rubric_scores_rubric_levels_level_id",
                        column: x => x.level_id,
                        principalTable: "rubric_levels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_coursework_rubric_id",
                table: "coursework",
                column: "rubric_id");

            migrationBuilder.CreateIndex(
                name: "IX_coursework_exceptions_coursework_id_student_id",
                table: "coursework_exceptions",
                columns: new[] { "coursework_id", "student_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_coursework_exceptions_student_id",
                table: "coursework_exceptions",
                column: "student_id");

            migrationBuilder.CreateIndex(
                name: "IX_grade_rubric_scores_criterion_id",
                table: "grade_rubric_scores",
                column: "criterion_id");

            migrationBuilder.CreateIndex(
                name: "IX_grade_rubric_scores_level_id",
                table: "grade_rubric_scores",
                column: "level_id");

            migrationBuilder.CreateIndex(
                name: "IX_rubric_criteria_rubric_id",
                table: "rubric_criteria",
                column: "rubric_id");

            migrationBuilder.CreateIndex(
                name: "IX_rubric_levels_criterion_id",
                table: "rubric_levels",
                column: "criterion_id");

            migrationBuilder.CreateIndex(
                name: "IX_rubrics_class_id",
                table: "rubrics",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "IX_saved_comments_owner_instructor_id",
                table: "saved_comments",
                column: "owner_instructor_id");

            migrationBuilder.AddForeignKey(
                name: "FK_coursework_rubrics_rubric_id",
                table: "coursework",
                column: "rubric_id",
                principalTable: "rubrics",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_coursework_rubrics_rubric_id",
                table: "coursework");

            migrationBuilder.DropTable(
                name: "coursework_exceptions");

            migrationBuilder.DropTable(
                name: "grade_rubric_scores");

            migrationBuilder.DropTable(
                name: "saved_comments");

            migrationBuilder.DropTable(
                name: "rubric_levels");

            migrationBuilder.DropTable(
                name: "rubric_criteria");

            migrationBuilder.DropTable(
                name: "rubrics");

            migrationBuilder.DropIndex(
                name: "IX_coursework_rubric_id",
                table: "coursework");

            migrationBuilder.DropColumn(
                name: "penalty_waived",
                table: "grades");

            migrationBuilder.DropColumn(
                name: "late_penalty_max_percent",
                table: "coursework");

            migrationBuilder.DropColumn(
                name: "late_penalty_percent_per_day",
                table: "coursework");

            migrationBuilder.DropColumn(
                name: "rubric_id",
                table: "coursework");
        }
    }
}
