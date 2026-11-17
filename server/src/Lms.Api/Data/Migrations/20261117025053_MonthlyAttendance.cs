using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace Lms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MonthlyAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "attendance_months",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    year = table.Column<int>(type: "int", nullable: false),
                    month = table.Column<int>(type: "int", nullable: false),
                    school_days = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_months", x => x.id);
                    table.ForeignKey(
                        name: "FK_attendance_months_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "attendance_entries",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    attendance_month_id = table.Column<long>(type: "bigint", nullable: false),
                    student_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    days_present = table.Column<int>(type: "int", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendance_entries", x => x.id);
                    table.ForeignKey(
                        name: "FK_attendance_entries_attendance_months_attendance_month_id",
                        column: x => x.attendance_month_id,
                        principalTable: "attendance_months",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_entries_attendance_month_id_student_id",
                table: "attendance_entries",
                columns: new[] { "attendance_month_id", "student_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_attendance_entries_student_id",
                table: "attendance_entries",
                column: "student_id");

            migrationBuilder.CreateIndex(
                name: "IX_attendance_months_class_id_year_month",
                table: "attendance_months",
                columns: new[] { "class_id", "year", "month" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "attendance_entries");

            migrationBuilder.DropTable(
                name: "attendance_months");
        }
    }
}
