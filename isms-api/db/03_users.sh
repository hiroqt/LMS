#!/usr/bin/env bash
# =============================================================================
# ISMS stand-in: API database + least-privilege users (DEVELOPMENT ONLY)
#
# Run automatically by the official mysql image from /docker-entrypoint-initdb.d
# on the first start of an empty data volume (it is a .sh rather than .sql so
# the passwords can come from environment variables instead of the file).
#
# Creates:
#   - database ismsapi_dev      (empty; the API's EF migrations own it)
#   - user isms_api_ro          SELECT only on isms_dev.*
#   - user isms_api_rw          ALL PRIVILEGES on ismsapi_dev.* only
#
# Required env: MYSQL_ROOT_PASSWORD, ISMS_API_RO_PASSWORD, ISMS_API_RW_PASSWORD
# =============================================================================
# Same options the image entrypoint uses, so sourcing this file changes nothing.
set -eo pipefail

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD must be set}"
: "${ISMS_API_RO_PASSWORD:?ISMS_API_RO_PASSWORD must be set}"
: "${ISMS_API_RW_PASSWORD:?ISMS_API_RW_PASSWORD must be set}"

# The passwords are pasted into single-quoted SQL literals below. Rather than
# rely on shell-version-specific escaping, refuse the characters that would
# need it (single quote, backslash) with a clear message.
for var in ISMS_API_RO_PASSWORD ISMS_API_RW_PASSWORD; do
  case "${!var}" in
    *"'"* | *'\'*)
      echo "03_users.sh: $var must not contain a single quote or backslash" >&2
      exit 1
      ;;
  esac
done

RO_PW=$ISMS_API_RO_PASSWORD
RW_PW=$ISMS_API_RW_PASSWORD

# Password goes through MYSQL_PWD so it never appears on a command line.
MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`ismsapi_dev\`
  DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'isms_api_ro'@'%' IDENTIFIED BY '${RO_PW}';
ALTER USER 'isms_api_ro'@'%' IDENTIFIED BY '${RO_PW}';
GRANT SELECT ON \`isms_dev\`.* TO 'isms_api_ro'@'%';

CREATE USER IF NOT EXISTS 'isms_api_rw'@'%' IDENTIFIED BY '${RW_PW}';
ALTER USER 'isms_api_rw'@'%' IDENTIFIED BY '${RW_PW}';
GRANT ALL PRIVILEGES ON \`ismsapi_dev\`.* TO 'isms_api_rw'@'%';

FLUSH PRIVILEGES;
SQL

echo "03_users.sh: created ismsapi_dev, isms_api_ro (SELECT on isms_dev), isms_api_rw (ALL on ismsapi_dev)"
