using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace Lms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class Meetings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "meetings",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    class_id = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    title = table.Column<string>(type: "varchar(250)", maxLength: 250, nullable: false),
                    scheduled_start = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    started_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    ended_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    end_reason = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: true),
                    room_name = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    locked = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    students_join_muted = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    students_may_unmute = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    students_may_video = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    students_may_share_screen = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    students_may_chat = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    save_chat = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    removed_json = table.Column<string>(type: "longtext", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    created_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    updated_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    updated_by = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meetings", x => x.id);
                    table.ForeignKey(
                        name: "FK_meetings_isms_classes_class_id",
                        column: x => x.class_id,
                        principalTable: "isms_classes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "meeting_attendance",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    meeting_id = table.Column<long>(type: "bigint", nullable: false),
                    person_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    role = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    session_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    joined_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    left_at = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meeting_attendance", x => x.id);
                    table.ForeignKey(
                        name: "FK_meeting_attendance_meetings_meeting_id",
                        column: x => x.meeting_id,
                        principalTable: "meetings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "meeting_chat_messages",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    meeting_id = table.Column<long>(type: "bigint", nullable: false),
                    sender_id = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    sender_role = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    sender_name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    text = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: false),
                    sent_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_meeting_chat_messages", x => x.id);
                    table.ForeignKey(
                        name: "FK_meeting_chat_messages_meetings_meeting_id",
                        column: x => x.meeting_id,
                        principalTable: "meetings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_meeting_attendance_meeting_id_person_id",
                table: "meeting_attendance",
                columns: new[] { "meeting_id", "person_id" });

            migrationBuilder.CreateIndex(
                name: "IX_meeting_attendance_session_id",
                table: "meeting_attendance",
                column: "session_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_meeting_chat_messages_meeting_id",
                table: "meeting_chat_messages",
                column: "meeting_id");

            migrationBuilder.CreateIndex(
                name: "IX_meetings_class_id",
                table: "meetings",
                column: "class_id");

            migrationBuilder.CreateIndex(
                name: "IX_meetings_room_name",
                table: "meetings",
                column: "room_name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "meeting_attendance");

            migrationBuilder.DropTable(
                name: "meeting_chat_messages");

            migrationBuilder.DropTable(
                name: "meetings");
        }
    }
}
