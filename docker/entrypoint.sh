#!/bin/sh
# Apply pending migrations, then start the Next.js server.
set -e
echo "[nexdrive] applying database migrations..."
( cd /app/tools && node node_modules/prisma/build/index.js migrate deploy )
echo "[nexdrive] starting on port ${PORT:-3000}"
exec node server.js
