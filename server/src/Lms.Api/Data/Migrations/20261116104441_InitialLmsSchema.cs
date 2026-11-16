using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace Lms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialLmsSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Class ids are base64url and must compare case-sensitively, including all foreign keys.
            migrationBuilder.Sql("ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;");

            migrationBuilder.AlterDatabase()
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "audit_log",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    actor_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    actor_role = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    category = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false),
                    action = table.Column<string>(type: "varchar(40)", maxLength: 40, nullable: false),
                    target = table.Column<string>(type: "varchar(60)", maxLength: 60, nullable: false),
                    target_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: true),
                    summary = table.Column<string>(type: "varchar(300)", maxLength: 300, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_log", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "isms_classes",
                columns: table => new
                {
                    id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    schedule_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    subject_id = table.Column<int>(type: "int", nullable: false),
                    subject_code = table.Column<string>(type: "varchar(32)", maxLength: 32, nullable: true),
                    subject_name = table.Column<string>(type: "varchar(250)", maxLength: 250, nullable: false),
                    section_id = table.Column<int>(type: "int", nullable: false),
                    section_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    instructor_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    instructor_name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    school_year_id = table.Column<int>(type: "int", nullable: false),
                    semester_id = table.Column<int>(type: "int", nullable: false),
                    term_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                    meetings_json = table.Column<string>(type: "longtext", nullable: false),
                    is_active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    synced_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_isms_classes", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "questionnaires",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    owner_instructor_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    subject_id = table.Column<int>(type: "int", nullable: true),
                    title = table.Column<string>(type: "varchar(250)", maxLength: 250, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_questionnaires", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "announcements",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "varchar(120)", maxLength: 120, nullable: false),
                    message = table.Column<string>(type: "varchar(1200)", maxLength: 1200, nullable: false),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    published_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_announcements", x => x.id);
                    table.ForeignKey(
                        name: "FK_announcements_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "gradebook_settings",
                columns: table => new
                {
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    activity_weight = table.Column<int>(type: "int", nullable: false),
                    exam_weight = table.Column<int>(type: "int", nullable: false),
                    passing_score = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_gradebook_settings", x => x.class_id);
                    table.ForeignKey(
                        name: "FK_gradebook_settings_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "isms_class_students",
                columns: table => new
                {
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    student_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    enrollment_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    first_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    middle_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    last_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    is_active = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    synced_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_isms_class_students", x => new { x.class_id, x.student_id });
                    table.ForeignKey(
                        name: "FK_isms_class_students_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "modules",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    parent_module_id = table.Column<long>(type: "bigint", nullable: true),
                    title = table.Column<string>(type: "varchar(250)", maxLength: 250, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_modules", x => x.id);
                    table.ForeignKey(
                        name: "FK_modules_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_modules_modules_parent_module_id",
                        column: x => x.parent_module_id,
                        principalTable: "modules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "questions",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    questionnaire_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false),
                    prompt = table.Column<string>(type: "longtext", nullable: false),
                    points = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    time_limit_seconds = table.Column<int>(type: "int", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_questions", x => x.id);
                    table.ForeignKey(
                        name: "FK_questions_questionnaires_questionnaire_id",
                        column: x => x.questionnaire_id,
                        principalTable: "questionnaires",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "coursework",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    module_id = table.Column<long>(type: "bigint", nullable: false),
                    type = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    title = table.Column<string>(type: "varchar(250)", maxLength: 250, nullable: false),
                    instructions = table.Column<string>(type: "longtext", nullable: true),
                    max_points = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    due_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    available_from = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    allow_late = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    allow_resubmission = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    max_attempts = table.Column<int>(type: "int", nullable: true),
                    time_limit_minutes = table.Column<int>(type: "int", nullable: true),
                    questionnaire_id = table.Column<long>(type: "bigint", nullable: true),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_coursework", x => x.id);
                    table.ForeignKey(
                        name: "FK_coursework_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coursework_modules_module_id",
                        column: x => x.module_id,
                        principalTable: "modules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_coursework_questionnaires_questionnaire_id",
                        column: x => x.questionnaire_id,
                        principalTable: "questionnaires",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "materials",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    module_id = table.Column<long>(type: "bigint", nullable: false),
                    title = table.Column<string>(type: "varchar(250)", maxLength: 250, nullable: false),
                    kind = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "longtext", nullable: true),
                    file_name = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    file_type = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    file_size = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_materials", x => x.id);
                    table.ForeignKey(
                        name: "FK_materials_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_materials_modules_module_id",
                        column: x => x.module_id,
                        principalTable: "modules",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "question_expected_answers",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    question_id = table.Column<long>(type: "bigint", nullable: false),
                    answer_text = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_question_expected_answers", x => x.id);
                    table.ForeignKey(
                        name: "FK_question_expected_answers_questions_question_id",
                        column: x => x.question_id,
                        principalTable: "questions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "question_options",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    question_id = table.Column<long>(type: "bigint", nullable: false),
                    text = table.Column<string>(type: "longtext", nullable: false),
                    is_correct = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    sort_order = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_question_options", x => x.id);
                    table.ForeignKey(
                        name: "FK_question_options_questions_question_id",
                        column: x => x.question_id,
                        principalTable: "questions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "submissions",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    coursework_id = table.Column<long>(type: "bigint", nullable: false),
                    student_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    attempt_number = table.Column<int>(type: "int", nullable: false),
                    status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    started_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    submitted_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    text = table.Column<string>(type: "longtext", nullable: true),
                    file_name = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_submissions", x => x.id);
                    table.ForeignKey(
                        name: "FK_submissions_coursework_coursework_id",
                        column: x => x.coursework_id,
                        principalTable: "coursework",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "grades",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    submission_id = table.Column<long>(type: "bigint", nullable: false),
                    points = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: false),
                    feedback = table.Column<string>(type: "longtext", nullable: true),
                    graded_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    graded_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_grades", x => x.id);
                    table.ForeignKey(
                        name: "FK_grades_submissions_submission_id",
                        column: x => x.submission_id,
                        principalTable: "submissions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "submission_answers",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    submission_id = table.Column<long>(type: "bigint", nullable: false),
                    question_id = table.Column<long>(type: "bigint", nullable: false),
                    selected_option_id = table.Column<long>(type: "bigint", nullable: true),
                    answer_text = table.Column<string>(type: "longtext", nullable: true),
                    points_awarded = table.Column<decimal>(type: "decimal(8,2)", precision: 8, scale: 2, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_submission_answers", x => x.id);
                    table.ForeignKey(
                        name: "FK_submission_answers_question_options_selected_option_id",
                        column: x => x.selected_option_id,
                        principalTable: "question_options",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_submission_answers_questions_question_id",
                        column: x => x.question_id,
                        principalTable: "questions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_submission_answers_submissions_submission_id",
                        column: x => x.submission_id,
                        principalTable: "submissions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_announcements_class_id",
                table: "announcements",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "IX_audit_log_created_at",
                table: "audit_log",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_coursework_class_id",
                table: "coursework",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "IX_coursework_module_id",
                table: "coursework",
                column: "module_id");

            migrationBuilder.CreateIndex(
                name: "IX_coursework_questionnaire_id",
                table: "coursework",
                column: "questionnaire_id");

            migrationBuilder.CreateIndex(
                name: "IX_grades_submission_id",
                table: "grades",
                column: "submission_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_isms_class_students_student_id",
                table: "isms_class_students",
                column: "student_id");

            migrationBuilder.CreateIndex(
                name: "IX_isms_classes_instructor_id",
                table: "isms_classes",
                column: "instructor_id");

            migrationBuilder.CreateIndex(
                name: "IX_isms_classes_school_year_id_semester_id",
                table: "isms_classes",
                columns: new[] { "school_year_id", "semester_id" });

            migrationBuilder.CreateIndex(
                name: "IX_materials_class_id",
                table: "materials",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "IX_materials_module_id",
                table: "materials",
                column: "module_id");

            migrationBuilder.CreateIndex(
                name: "IX_modules_class_id",
                table: "modules",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "IX_modules_parent_module_id",
                table: "modules",
                column: "parent_module_id");

            migrationBuilder.CreateIndex(
                name: "IX_question_expected_answers_question_id",
                table: "question_expected_answers",
                column: "question_id");

            migrationBuilder.CreateIndex(
                name: "IX_question_options_question_id",
                table: "question_options",
                column: "question_id");

            migrationBuilder.CreateIndex(
                name: "IX_questionnaires_owner_instructor_id",
                table: "questionnaires",
                column: "owner_instructor_id");

            migrationBuilder.CreateIndex(
                name: "IX_questions_questionnaire_id",
                table: "questions",
                column: "questionnaire_id");

            migrationBuilder.CreateIndex(
                name: "IX_submission_answers_question_id",
                table: "submission_answers",
                column: "question_id");

            migrationBuilder.CreateIndex(
                name: "IX_submission_answers_selected_option_id",
                table: "submission_answers",
                column: "selected_option_id");

            migrationBuilder.CreateIndex(
                name: "IX_submission_answers_submission_id_question_id",
                table: "submission_answers",
                columns: new[] { "submission_id", "question_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_submissions_coursework_id_student_id_attempt_number",
                table: "submissions",
                columns: new[] { "coursework_id", "student_id", "attempt_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_submissions_student_id",
                table: "submissions",
                column: "student_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "announcements");

            migrationBuilder.DropTable(
                name: "audit_log");

            migrationBuilder.DropTable(
                name: "gradebook_settings");

            migrationBuilder.DropTable(
                name: "grades");

            migrationBuilder.DropTable(
                name: "isms_class_students");

            migrationBuilder.DropTable(
                name: "materials");

            migrationBuilder.DropTable(
                name: "question_expected_answers");

            migrationBuilder.DropTable(
                name: "submission_answers");

            migrationBuilder.DropTable(
                name: "question_options");

            migrationBuilder.DropTable(
                name: "submissions");

            migrationBuilder.DropTable(
                name: "questions");

            migrationBuilder.DropTable(
                name: "coursework");

            migrationBuilder.DropTable(
                name: "modules");

            migrationBuilder.DropTable(
                name: "questionnaires");

            migrationBuilder.DropTable(
                name: "isms_classes");
        }
    }
}
