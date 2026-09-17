#!/bin/sh
# Restore a backup made by backup.sh:  docker/restore.sh backups/nexdrive-20260917-030000.dump [backups/uploads-….tgz]
set -e
[ -f "$1" ] || { echo "usage: restore.sh <db.dump> [uploads.tgz]"; exit 1; }
docker compose stop app
docker compose exec -T db pg_restore -U nexdrive -d nexdrive --clean --if-exists --no-owner < "$1"
if [ -n "$2" ]; then
  docker run --rm -v nexdrive_uploads:/uploads -v "$(cd "$(dirname "$2")" && pwd)":/backup alpine sh -c "rm -rf /uploads/* && tar xzf /backup/$(basename "$2") -C /uploads"
fi
docker compose start app
echo "restore complete"
