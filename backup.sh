#!/usr/bin/env bash
set -euo pipefail

source /root/VolunteerHub/.env

TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%SZ")
BACKUP_FILE="/tmp/${DB_NAME}-${TIMESTAMP}.dump"

export PGPASSWORD="$DB_PASSWORD"

pg_dump \
  -h 127.0.0.1 \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -Fc \
  -f "$BACKUP_FILE"

echo "Local backup created at $BACKUP_FILE"

SPACE_NAME="volunteerhub-backups"      
SPACE_REGION="tor1"             
ENDPOINT="https://volunteerhub-backups.tor1.digitaloceanspaces.com"

aws s3 cp "$BACKUP_FILE" "s3://${SPACE_NAME}/db/${DB_NAME}-${TIMESTAMP}.dump" \
  --endpoint-url "$ENDPOINT"

echo "Uploaded to Spaces: s3://${SPACE_NAME}/db/${DB_NAME}-${TIMESTAMP}.dump"

rm -f "$BACKUP_FILE"
echo "Local temp file removed"
