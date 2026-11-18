#!/bin/sh
set -eu

required_vars="RESTIC_REPOSITORY RESTIC_PASSWORD_FILE AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY S3_ENDPOINT DB_TYPE"
for name in $required_vars; do
    eval "value=\${$name:-}"
    if [ -z "$value" ]; then
        echo "Missing required restore setting: $name" >&2
        exit 1
    fi
done

if [ "$DB_TYPE" = "postgres" ]; then
    database_vars="BACKUP_DB_USER BACKUP_DB_PASSWORD DB_SERVER DB_NAME RESTORE_DB_NAME"
elif [ "$DB_TYPE" = "sqlite" ]; then
    database_vars="SQLITE_FILENAME RESTORE_SQLITE_PATH"
else
    echo "Unsupported DB_TYPE: $DB_TYPE" >&2
    exit 1
fi
for name in $database_vars; do
    eval "value=\${$name:-}"
    if [ -z "$value" ]; then
        echo "Missing required $DB_TYPE restore setting: $name" >&2
        exit 2
    fi
done

if [ "$DB_TYPE" = "postgres" ]; then
    if [ "$RESTORE_DB_NAME" = "$DB_NAME" ]; then
        echo "Refusing to restore over the production database." >&2
        exit 2
    fi
    case "$RESTORE_DB_NAME" in
        *[!A-Za-z0-9_-]*|'')
            echo "RESTORE_DB_NAME contains unsupported characters." >&2
            exit 2
            ;;
    esac
elif [ "$(readlink -m "$RESTORE_SQLITE_PATH")" = "$(readlink -m "$SQLITE_FILENAME")" ]; then
    echo "Refusing to restore over the production SQLite database." >&2
    exit 2
fi

export AWS_ENDPOINT_URL="$S3_ENDPOINT"
RESTORE_DIR="/work/restore"
rm -rf "$RESTORE_DIR"
mkdir -p "$RESTORE_DIR"
restic restore "${RESTORE_SNAPSHOT:-latest}" --target "$RESTORE_DIR"

if [ "$DB_TYPE" = "postgres" ]; then
    DATABASE_DUMP="$RESTORE_DIR/work/source/database.dump"
    if [ ! -s "$DATABASE_DUMP" ]; then
        echo "PostgreSQL dump was not found in the selected snapshot." >&2
        exit 3
    fi
    export PGPASSWORD="$BACKUP_DB_PASSWORD"
    table_count="$(psql \
        --host "$DB_SERVER" \
        --port "${DB_PORT:-5432}" \
        --username "$BACKUP_DB_USER" \
        --dbname "$RESTORE_DB_NAME" \
        --tuples-only --no-align \
        --command "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")"
    if [ "${table_count:-0}" -ne 0 ]; then
        echo "Refusing to restore into a non-empty PostgreSQL database." >&2
        exit 3
    fi
    pg_restore \
        --host "$DB_SERVER" \
        --port "${DB_PORT:-5432}" \
        --username "$BACKUP_DB_USER" \
        --dbname "$RESTORE_DB_NAME" \
        --no-owner \
        --no-privileges \
        --exit-on-error \
        "$DATABASE_DUMP"
    unset PGPASSWORD
else
    SQLITE_BACKUP="$RESTORE_DIR/work/source/database.sqlite"
    if [ ! -s "$SQLITE_BACKUP" ]; then
        echo "SQLite backup was not found in the selected snapshot." >&2
        exit 3
    fi
    mkdir -p "$(dirname "$RESTORE_SQLITE_PATH")"
    cp "$SQLITE_BACKUP" "$RESTORE_SQLITE_PATH"
    sqlite3 "$RESTORE_SQLITE_PATH" "PRAGMA integrity_check;" | grep -qx "ok"
fi

MANIFEST_PATH="$RESTORE_DIR/work/source/uploads.sha256"
if [ -s "$MANIFEST_PATH" ] && [ -d "$RESTORE_DIR/uploads" ]; then
    (
        cd "$RESTORE_DIR/uploads"
        sha256sum -c "$MANIFEST_PATH"
    )
fi

echo "Restore completed into non-production target: ${RESTORE_DB_NAME:-$RESTORE_SQLITE_PATH}"
