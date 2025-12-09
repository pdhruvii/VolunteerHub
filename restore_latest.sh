#!/usr/bin/env bash
set -euo pipefail

source /root/VolunteerHub/.env

SPACE_NAME="volunteerhub-backups"      # ← 你的 Space 名（如果不一样再改）
SPACE_REGION="tor1"                    # ← Toronto · TOR1 对应 tor1
ENDPOINT="https://${SPACE_REGION}.digitaloceanspaces.com"

LATEST=$(aws s3 ls "s3://${SPACE_NAME}/db/" --endpoint-url "$ENDPOINT" | sort | tail -n 1 | awk '{print $4}')

if [ -z "${LATEST:-}" ]; then
  echo "No backup files found in Space"
  exit 1
fi

echo "Latest backup is: $LATEST"

TMP_FILE="/tmp/${LATEST}"

aws s3 cp "s3://${SPACE_NAME}/db/${LATEST}" "$TMP_FILE" --endpoint-url "$ENDPOINT"
echo "Downloaded backup to $TMP_FILE"

export PGPASSWORD="$DB_PASSWORD"

psql -h 127.0.0.1 -p 5432 -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
psql -h 127.0.0.1 -p 5432 -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"

echo "Database $DB_NAME dropped and recreated"

pg_restore \
  -h 127.0.0.1 \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  "$TMP_FILE"

echo "Restore done from $LATEST"

rm -f "$TMP_FILE"
echo "Temp file removed"

#    docker service scale vhub_api=2
