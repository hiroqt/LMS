#!/usr/bin/env bash
# =============================================================================
# LMS database + its own user (DEVELOPMENT ONLY)
#
# The LMS's own data (modules, coursework, submissions, grades, and its copy of
# ISMS classes) lives in `lmsdb`. It shares this dev MySQL server for
# convenience only: the LMS user has no rights on isms_dev or ismsapi_dev, so the
# LMS still reaches ISMS data only through the ISMS API.
#
# Runs automatically on the first start of an empty volume. For a volume that
# already exists, run it once by hand (see README.md):
#   docker compose exec isms-db bash /docker-entrypoint-initdb.d/04_lmsdb.sh
#
# Required env: MYSQL_ROOT_PASSWORD, LMS_API_RW_PASSWORD
# =============================================================================
set -eo pipefail

: "${MYSQL_ROOT_PASSWORD:?MYSQL_ROOT_PASSWORD must be set}"
: "${LMS_API_RW_PASSWORD:?LMS_API_RW_PASSWORD must be set}"

case "$LMS_API_RW_PASSWORD" in
  *"'"* | *'\'*)
    echo "04_lmsdb.sh: LMS_API_RW_PASSWORD must not contain a single quote or backslash" >&2
    exit 1
    ;;
esac

MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`lmsdb\`
  DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_bin;

CREATE USER IF NOT EXISTS 'lms_api_rw'@'%' IDENTIFIED BY '${LMS_API_RW_PASSWORD}';
ALTER USER 'lms_api_rw'@'%' IDENTIFIED BY '${LMS_API_RW_PASSWORD}';
GRANT ALL PRIVILEGES ON \`lmsdb\`.* TO 'lms_api_rw'@'%';

FLUSH PRIVILEGES;
SQL

echo "04_lmsdb.sh: created lmsdb and lms_api_rw (ALL on lmsdb only)"
