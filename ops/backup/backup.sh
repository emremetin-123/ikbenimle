#!/bin/sh
set -eu

required_vars="RESTIC_REPOSITORY RESTIC_PASSWORD_FILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY S3_ENDPOINT DB_TYPE BACKUP_HEALTHCHECK_URL"
for name in $required_vars; do
    eval "value=\${$name:-}"
    if [ -z "$value" ]; then
        echo "Missing required backup setting: $name" >&2
        exit 1
    fi
done

case "$DB_TYPE" in
    postgres)
        database_vars="BACKUP_DB_USER BACKUP_DB_PASSWORD DB_SERVER DB_NAME"
        ;;
    sqlite)
        database_vars="SQLITE_FILENAME"
        ;;
    *)
        echo "Unsupported DB_TYPE: $DB_TYPE" >&2
        exit 1
        ;;
esac
for name in $database_vars; do
    eval "value=\${$name:-}"
    if [ -z "$value" ]; then
        echo "Missing required $DB_TYPE backup setting: $name" >&2
        exit 1
    fi
done

STATUS_FILE="${BACKUP_STATUS_FILE:-/status/status.json}"
SOURCE_DIR="/work/source"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
mkdir -p "$SOURCE_DIR" "$(dirname "$STATUS_FILE")"
rm -rf "${SOURCE_DIR:?}"/*

notify() {
    state="$1"
    curl --fail --silent --show-error --max-time 15 \
        -X POST -H "Content-Type: application/json" \
        -d "{\"status\":\"$state\",\"database_type\":\"$DB_TYPE\",\"database\":\"${DB_NAME:-sqlite}\",\"started_at\":\"$STARTED_AT\"}" \
        "$BACKUP_HEALTHCHECK_URL" >/dev/null
}

write_status() {
    state="$1"
    message="$2"
    finished_epoch="$(date -u +%s)"
    finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    tmp_file="${STATUS_FILE}.tmp"
    jq -n \
        --arg status "$state" \
        --arg message "$message" \
        --arg started_at "$STARTED_AT" \
        --arg finished_at "$finished_at" \
        --argjson finished_epoch "$finished_epoch" \
        '{status:$status,message:$message,started_at:$started_at,finished_at:$finished_at,finished_epoch:$finished_epoch}' \
        > "$tmp_file"
    mv "$tmp_file" "$STATUS_FILE"
}

fail() {
    exit_code="$?"
    write_status "failed" "Backup failed with exit code $exit_code"
    notify "failed" || true
    exit "$exit_code"
}
trap fail INT TERM HUP EXIT

notify "started"

if [ "$DB_TYPE" = "postgres" ]; then
    export PGPASSWORD="$BACKUP_DB_PASSWORD"
    pg_dump \
        --host "$DB_SERVER" \
        --port "${DB_PORT:-5432}" \
        --username "$BACKUP_DB_USER" \
        --dbname "$DB_NAME" \
        --format custom \
        --no-owner \
        --no-privileges \
        --file "${SOURCE_DIR}/database.dump"
    pg_restore --list "${SOURCE_DIR}/database.dump" >/dev/null
    unset PGPASSWORD
else
    if [ ! -s "$SQLITE_FILENAME" ]; then
        echo "SQLite database was not found: $SQLITE_FILENAME" >&2
        exit 1
    fi
    printf '.timeout 30000\n.backup %s\n' "${SOURCE_DIR}/database.sqlite" \
        | sqlite3 "$SQLITE_FILENAME"
    sqlite3 "${SOURCE_DIR}/database.sqlite" "PRAGMA integrity_check;" \
        | grep -qx "ok"
fi

if [ -d /uploads ]; then
    (
        cd /uploads
        find . -type f -print0 \
            | sort -z \
            | xargs -0 -r sha256sum
    ) > "${SOURCE_DIR}/uploads.sha256"
fi

export AWS_ENDPOINT_URL="$S3_ENDPOINT"
if ! restic snapshots >/dev/null 2>&1; then
    restic init
fi

restic backup "$SOURCE_DIR" /uploads \
    --host "${BACKUP_HOST:-ikbenimle-production}" \
    --tag "$DB_TYPE" \
    --tag "uploads"
restic forget --keep-daily 30 --keep-weekly 12 --keep-monthly 12 --prune

if [ "$(date -u +%u)" = "7" ]; then
    restic check --read-data-subset="${RESTIC_CHECK_SUBSET:-5%}"
else
    restic check --no-cache
fi

trap - INT TERM HUP EXIT
write_status "success" "Backup and repository verification completed"
notify "success"
