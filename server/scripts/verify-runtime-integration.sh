#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MYSQL_IMAGE="${MYSQL_CLIENT_IMAGE:-mysql:8.4}"
REDIS_IMAGE="${REDIS_CLIENT_IMAGE:-redis:7.4-alpine}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-root}"
MYSQL_DATABASE="${MYSQL_DATABASE:-eforge_enterprise}"
APP_LOG="${APP_LOG:-/tmp/eforge-enterprise.log}"
APP_PORT="${EFORGE_SERVER_PORT:-8080}"

mysql_root() {
  docker run --rm --network host     -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD"     -i "$MYSQL_IMAGE"     mysql --protocol=tcp -h127.0.0.1 -P3306 -uroot "$@"
}

redis_cli() {
  docker run --rm --network host "$REDIS_IMAGE"     redis-cli -h 127.0.0.1 -p 6379 "$@"
}

echo "Waiting for MySQL..."
for _ in {1..60}; do
  if mysql_root -e "SELECT 1" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
mysql_root -e "SELECT 1" >/dev/null

echo "Initializing MySQL schema..."
mysql_root "$MYSQL_DATABASE" < "$ROOT/sql/upstream/ry_20260417.sql"
mysql_root "$MYSQL_DATABASE" < "$ROOT/sql/upstream/quartz.sql"
mysql_root "$MYSQL_DATABASE" -e   "UPDATE sys_config SET config_value='false' WHERE config_key='sys.account.captchaEnabled';"

TABLE_COUNT="$(mysql_root -N -s -e   "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${MYSQL_DATABASE}';")"
if [[ "$TABLE_COUNT" -lt 20 ]]; then
  echo "Expected initialized schema, found only $TABLE_COUNT tables" >&2
  exit 1
fi

echo "Waiting for Redis..."
for _ in {1..60}; do
  if [[ "$(redis_cli ping 2>/dev/null || true)" == "PONG" ]]; then
    break
  fi
  sleep 2
done
[[ "$(redis_cli ping)" == "PONG" ]]

JAR="$ROOT/server/eforge-boot/target/eforge-boot.jar"
if [[ ! -f "$JAR" ]]; then
  echo "Missing application jar: $JAR" >&2
  exit 1
fi

: "${EFORGE_TOKEN_SECRET:?EFORGE_TOKEN_SECRET is required}"
: "${EFORGE_DB_PASSWORD:?EFORGE_DB_PASSWORD is required}"

export EFORGE_DB_URL="${EFORGE_DB_URL:-jdbc:mysql://127.0.0.1:3306/${MYSQL_DATABASE}?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=false&serverTimezone=UTC}"
export EFORGE_DB_USERNAME="${EFORGE_DB_USERNAME:-eforge}"
export EFORGE_REDIS_HOST="${EFORGE_REDIS_HOST:-127.0.0.1}"
export EFORGE_REDIS_PORT="${EFORGE_REDIS_PORT:-6379}"
export EFORGE_OPENAPI_ENABLED=false
export EFORGE_SWAGGER_UI_ENABLED=false
export EFORGE_DRUID_CONSOLE_ENABLED=false

echo "Starting EForge Enterprise server..."
java -jar "$JAR" >"$APP_LOG" 2>&1 &
APP_PID=$!

cleanup() {
  kill "$APP_PID" >/dev/null 2>&1 || true
  wait "$APP_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

BASE_URL="http://127.0.0.1:${APP_PORT}"

for _ in {1..90}; do
  if curl -fsS "$BASE_URL/captchaImage" >/tmp/eforge-captcha.json 2>/dev/null; then
    break
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    echo "Application exited before becoming ready" >&2
    cat "$APP_LOG" >&2
    exit 1
  fi
  sleep 2
done

if ! curl -fsS "$BASE_URL/captchaImage" >/tmp/eforge-captcha.json; then
  echo "Application did not become ready" >&2
  cat "$APP_LOG" >&2
  exit 1
fi

python3 - <<'PY'
import json
with open('/tmp/eforge-captcha.json', encoding='utf-8') as f:
    payload = json.load(f)
assert payload.get('code') == 200, payload
assert payload.get('captchaEnabled') is False, payload
PY

echo "Logging in against real MySQL + Redis..."
LOGIN_RESPONSE="$(curl -fsS   -H 'Content-Type: application/json'   -H 'User-Agent: EForge-Enterprise-CI'   -X POST "$BASE_URL/login"   --data '{"username":"admin","password":"admin123","code":"","uuid":""}')"

printf '%s' "$LOGIN_RESPONSE" >/tmp/eforge-login.json

TOKEN="$(python3 - <<'PY'
import json
with open('/tmp/eforge-login.json', encoding='utf-8') as f:
    payload = json.load(f)
assert payload.get('code') == 200, payload
token = payload.get('token')
assert isinstance(token, str) and token, payload
print(token)
PY
)"

INFO_RESPONSE="$(curl -fsS   -H "Authorization: Bearer $TOKEN"   -H 'User-Agent: EForge-Enterprise-CI'   "$BASE_URL/getInfo")"
printf '%s' "$INFO_RESPONSE" >/tmp/eforge-info.json

python3 - <<'PY'
import json
with open('/tmp/eforge-info.json', encoding='utf-8') as f:
    payload = json.load(f)
assert payload.get('code') == 200, payload
user = payload.get('user') or {}
assert user.get('userName') == 'admin', payload
permissions = payload.get('permissions') or []
assert permissions, payload
PY

SESSION_KEYS="$(redis_cli --scan --pattern 'login_tokens:*' | sed '/^$/d' | wc -l | tr -d ' ')"
if [[ "$SESSION_KEYS" -lt 1 ]]; then
  echo "Login succeeded but no Redis login session was found" >&2
  exit 1
fi

echo "MySQL tables: $TABLE_COUNT"
echo "Redis login sessions: $SESSION_KEYS"
echo "Runtime integration checks passed"
