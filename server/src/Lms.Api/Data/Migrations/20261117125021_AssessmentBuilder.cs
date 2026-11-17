using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace Lms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AssessmentBuilder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "score_updated_at",
                table: "submissions",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "match_note",
                table: "submission_answers",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "spelling_decision",
                table: "submission_answers",
                type: "varchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "always_strict",
                table: "questions",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "case_sensitive",
                table: "questions",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "incomplete",
                table: "questions",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "problems",
                table: "questions",
                type: "longtext",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "section_id",
                table: "questions",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "underlined",
                table: "questions",
                type: "varchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "answer_review",
                table: "coursework",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "results");

            migrationBuilder.AddColumn<bool>(
                name: "shuffle_choices",
                table: "coursework",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "shuffle_questions",
                table: "coursework",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "spelling_mode",
                table: "coursework",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "strict");

            migrationBuilder.CreateTable(
                name: "question_sections",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    questionnaire_id = table.Column<long>(type: "bigint", nullable: false),
                    title = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    directions = table.Column<string>(type: "varchar(2000)", maxLength: 2000, nullable: true),
                    default_points = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: true),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_question_sections", x => x.id);
                    table.ForeignKey(
                        name: "FK_question_sections_questionnaires_questionnaire_id",
                        column: x => x.questionnaire_id,
                        principalTable: "questionnaires",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_questions_section_id",
                table: "questions",
                column: "section_id");

            migrationBuilder.CreateIndex(
                name: "IX_question_sections_questionnaire_id",
                table: "question_sections",
                column: "questionnaire_id");

            migrationBuilder.AddForeignKey(
                name: "FK_questions_question_sections_section_id",
                table: "questions",
                column: "section_id",
                principalTable: "question_sections",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            // Sets saved before sections existed get one unnamed section holding all their questions.
            migrationBuilder.Sql(
                "INSERT INTO question_sections (questionnaire_id, title, sort_order, created_at, created_by) " +
                "SELECT id, '', 1, UTC_TIMESTAMP(6), 'system' FROM questionnaires;");
            migrationBuilder.Sql(
                "UPDATE questions q JOIN question_sections s ON s.questionnaire_id = q.questionnaire_id " +
                "SET q.section_id = s.id WHERE q.section_id IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_questions_question_sections_section_id",
                table: "questions");

            migrationBuilder.DropTable(
                name: "question_sections");

            migrationBuilder.DropIndex(
                name: "IX_questions_section_id",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "score_updated_at",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "match_note",
                table: "submission_answers");

            migrationBuilder.DropColumn(
                name: "spelling_decision",
                table: "submission_answers");

            migrationBuilder.DropColumn(
                name: "always_strict",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "case_sensitive",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "incomplete",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "problems",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "section_id",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "underlined",
                table: "questions");

            migrationBuilder.DropColumn(
                name: "answer_review",
                table: "coursework");

            migrationBuilder.DropColumn(
                name: "shuffle_choices",
                table: "coursework");

            migrationBuilder.DropColumn(
                name: "shuffle_questions",
                table: "coursework");

            migrationBuilder.DropColumn(
                name: "spelling_mode",
                table: "coursework");
        }
    }
}
