#!/bin/sh
# Nightly backup of the NexDrive database + uploads (run from the repo root, e.g. via cron):
#   0 3 * * * /opt/nexdrive/docker/backup.sh >> /var/log/nexdrive-backup.log 2>&1
set -e
STAMP=$(date +%Y%m%d-%H%M%S)
DIR=${BACKUP_DIR:-./backups}
mkdir -p "$DIR"
docker compose exec -T db pg_dump -U nexdrive -Fc nexdrive > "$DIR/nexdrive-$STAMP.dump"
docker run --rm -v nexdrive_uploads:/uploads:ro -v "$(cd "$DIR" && pwd)":/backup alpine tar czf "/backup/uploads-$STAMP.tgz" -C /uploads .
# keep 30 days
find "$DIR" -name 'nexdrive-*.dump' -mtime +30 -delete
find "$DIR" -name 'uploads-*.tgz' -mtime +30 -delete
echo "backup complete: $DIR/nexdrive-$STAMP.dump"
