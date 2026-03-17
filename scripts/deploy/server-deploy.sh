#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/kaique-entrevista}"
BRANCH="${BRANCH:-main}"
PHP_BIN="${PHP_BIN:-php}"
COMPOSER_BIN="${COMPOSER_BIN:-composer}"
NPM_BIN="${NPM_BIN:-npm}"

cd "$APP_DIR"

echo "[deploy] Atualizando código da branch $BRANCH"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "[deploy] Dependências PHP"
$COMPOSER_BIN install --no-interaction --prefer-dist --optimize-autoloader --no-dev

echo "[deploy] Dependências Node e build"
$NPM_BIN ci
$NPM_BIN run build

echo "[deploy] Manutenção ON"
$PHP_BIN artisan down || true

echo "[deploy] Migrações"
$PHP_BIN artisan migrate --force

echo "[deploy] Cache e otimização"
$PHP_BIN artisan optimize:clear
$PHP_BIN artisan optimize

echo "[deploy] Reinício de workers"
$PHP_BIN artisan queue:restart || true

echo "[deploy] Link de storage"
$PHP_BIN artisan storage:link || true

echo "[deploy] Manutenção OFF"
$PHP_BIN artisan up || true

echo "[deploy] Deploy finalizado"
