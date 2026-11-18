using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AssignmentTurnInRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "returned_at",
                table: "grades",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "close_at",
                table: "coursework",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "grade_release",
                table: "coursework",
                type: "varchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "immediate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "returned_at",
                table: "grades");

            migrationBuilder.DropColumn(
                name: "close_at",
                table: "coursework");

            migrationBuilder.DropColumn(
                name: "grade_release",
                table: "coursework");
        }
    }
}
