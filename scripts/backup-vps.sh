#!/usr/bin/env bash
set -euo pipefail

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="/root/remote-control-backups/${stamp}"
mkdir -p -m 700 "$backup_dir"

node_bin="$(find /root/.nvm/versions/node -path '*/bin/node' -type f | sort -V | tail -n 1)"
"$node_bin" --no-warnings - \
  /opt/remote-control-server/data/remote_control.db \
  "$backup_dir/remote_control.db" <<'NODE'
const { DatabaseSync, backup } = require('node:sqlite');
const [sourcePath, destinationPath] = process.argv.slice(2);
const source = new DatabaseSync(sourcePath, { readOnly: true });
backup(source, destinationPath)
  .then(() => {
    const copy = new DatabaseSync(destinationPath, { readOnly: true });
    const result = copy.prepare('PRAGMA integrity_check').get();
    copy.close();
    source.close();
    if (result.integrity_check !== 'ok') throw new Error('SQLite integrity check failed');
    console.log('SQLite backup verified');
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
NODE

tar -C / -czf "$backup_dir/application.tar.gz" \
  --exclude='opt/remote-control-server/data/remote_control.db*' \
  opt/remote-control-server var/www/dashboard \
  etc/nginx/sites-available etc/nginx/sites-enabled
tar -tzf "$backup_dir/application.tar.gz" >/dev/null
sha256sum "$backup_dir/remote_control.db" "$backup_dir/application.tar.gz" \
  > "$backup_dir/SHA256SUMS"
chmod 600 "$backup_dir"/*
printf 'BACKUP_DIR=%s\n' "$backup_dir"
du -h "$backup_dir"/*
