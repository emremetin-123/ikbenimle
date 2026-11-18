#!/bin/sh
set -eu

check_private_file() {
    path="$1"
    if [ ! -f "$path" ]; then
        echo "Required production secret file is missing: $path" >&2
        exit 1
    fi
    mode="$(stat -c '%a' "$path")"
    permissions=$((0$mode))
    if [ $((permissions & 077)) -ne 0 ]; then
        echo "Secret file must not be accessible by group or others: $path ($mode)" >&2
        exit 1
    fi
}

check_private_file backend/.env

read_env() {
    key="$1"
    file="$2"
    grep -E "^${key}=" "$file" | tail -1 | cut -d= -f2- | tr -d '\r"' || true
}

require_env() {
    key="$1"
    file="$2"
    value="$(read_env "$key" "$file")"
    if [ -z "$value" ]; then
        echo "$key is missing from $file" >&2
        exit 1
    fi
}

for key in DB_TYPE DB_SERVER DB_PORT DB_NAME DB_USER DB_PASSWORD \
    POSTGRES_DB POSTGRES_USER POSTGRES_PASSWORD; do
    require_env "$key" backend/.env
done

APP_DB_TYPE="$(read_env DB_TYPE backend/.env)"
if [ "$APP_DB_TYPE" != "postgres" ]; then
    echo "Production DB_TYPE must be postgres." >&2
    exit 1
fi
if [ "$(read_env DB_SERVER backend/.env)" != "postgres" ]; then
    echo "DB_SERVER must target the internal postgres service." >&2
    exit 1
fi
if [ "$(read_env DB_NAME backend/.env)" != "$(read_env POSTGRES_DB backend/.env)" ]; then
    echo "DB_NAME and POSTGRES_DB must match." >&2
    exit 1
fi

REQUIRE_OFFSITE_BACKUP="${REQUIRE_OFFSITE_BACKUP:-true}"
if [ "$REQUIRE_OFFSITE_BACKUP" = "true" ]; then
    check_private_file ops/backup/.env.backup
    check_private_file secrets/restic_password
elif [ -f ops/backup/.env.backup ] || [ -f secrets/restic_password ]; then
    check_private_file ops/backup/.env.backup
    check_private_file secrets/restic_password
fi

if [ -f ops/backup/.env.backup ]; then
    BACKUP_DB_TYPE="$(read_env DB_TYPE ops/backup/.env.backup)"
    [ -n "$BACKUP_DB_TYPE" ] || {
        echo "DB_TYPE is missing from ops/backup/.env.backup" >&2
        exit 1
    }
    if [ -n "$APP_DB_TYPE" ] && [ "$APP_DB_TYPE" != "$BACKUP_DB_TYPE" ]; then
        echo "Application DB_TYPE ($APP_DB_TYPE) and backup DB_TYPE ($BACKUP_DB_TYPE) differ." >&2
        exit 1
    fi
fi

echo "Production secret file permissions are valid."
