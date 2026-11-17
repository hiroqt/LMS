using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Lms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AnswerOverridesAndAnonymized : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "anonymized_at",
                table: "submissions",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "manual_points",
                table: "submission_answers",
                type: "decimal(8,2)",
                precision: 8,
                scale: 2,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "anonymized_at",
                table: "submissions");

            migrationBuilder.DropColumn(
                name: "manual_points",
                table: "submission_answers");
        }
    }
}
