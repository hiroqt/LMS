using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MySql.EntityFrameworkCore.Metadata;

#nullable disable

namespace Isms.Api.Access.Migrations
{
    /// <inheritdoc />
    public partial class InitialAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "api_clients",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    username = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    display_name = table.Column<string>(type: "varchar(200)", maxLength: 200, nullable: false),
                    status = table.Column<string>(type: "varchar(16)", maxLength: 16, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_clients", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "api_request_logs",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    timestamp = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    client_username = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    method = table.Column<string>(type: "varchar(16)", maxLength: 16, nullable: false),
                    path = table.Column<string>(type: "varchar(512)", maxLength: 512, nullable: false),
                    required_permission = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: true),
                    status_code = table.Column<int>(type: "int", nullable: false),
                    remote_ip = table.Column<string>(type: "varchar(45)", maxLength: 45, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_request_logs", x => x.id);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "api_client_keys",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySQL:ValueGenerationStrategy", MySQLValueGenerationStrategy.IdentityColumn),
                    client_id = table.Column<int>(type: "int", nullable: false),
                    key_prefix = table.Column<string>(type: "varchar(8)", maxLength: 8, nullable: false),
                    key_hash = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    expires_at = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    last_used_at = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_client_keys", x => x.id);
                    table.ForeignKey(
                        name: "FK_api_client_keys_api_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "api_clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "api_client_permissions",
                columns: table => new
                {
                    client_id = table.Column<int>(type: "int", nullable: false),
                    permission = table.Column<string>(type: "varchar(64)", maxLength: 64, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_client_permissions", x => new { x.client_id, x.permission });
                    table.ForeignKey(
                        name: "FK_api_client_permissions_api_clients_client_id",
                        column: x => x.client_id,
                        principalTable: "api_clients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySQL:Charset", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_api_client_keys_client_id_key_prefix",
                table: "api_client_keys",
                columns: new[] { "client_id", "key_prefix" });

            migrationBuilder.CreateIndex(
                name: "IX_api_clients_username",
                table: "api_clients",
                column: "username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_api_request_logs_timestamp",
                table: "api_request_logs",
                column: "timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "api_client_keys");

            migrationBuilder.DropTable(
                name: "api_client_permissions");

            migrationBuilder.DropTable(
                name: "api_request_logs");

            migrationBuilder.DropTable(
                name: "api_clients");
        }
    }
}
