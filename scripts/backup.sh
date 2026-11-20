#!/usr/bin/env bash
# Back up Ghostfolio's Postgres data (the only state that matters).
# Usage: bash scripts/backup.sh [output-dir]
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-backups}"
mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M%S)"
docker exec gf-postgres pg_dump -U "${POSTGRES_USER:-gf}" "${POSTGRES_DB:-ghostfolio}" \
  | gzip > "$OUT/ghostfolio-$STAMP.sql.gz"
echo "backed up: $OUT/ghostfolio-$STAMP.sql.gz"
echo "restore with: gunzip -c <file> | docker exec -i gf-postgres psql -U gf -d ghostfolio"
