#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/eforge-boot/src/main/resources/application.yml"
DRUID="$ROOT/eforge-boot/src/main/resources/application-druid.yml"
SECURITY="$ROOT/eforge-framework/src/main/java/com/ruoyi/framework/config/SecurityConfig.java"
RESOURCES="$ROOT/eforge-framework/src/main/java/com/ruoyi/framework/config/ResourcesConfig.java"

fail() {
  echo "security-default check failed: $1" >&2
  exit 1
}

grep -Fq 'secret: ${EFORGE_TOKEN_SECRET}' "$APP"   || fail "token secret must come from EFORGE_TOKEN_SECRET"

grep -Fq 'enabled: ${EFORGE_SWAGGER_UI_ENABLED:false}' "$APP"   || fail "Swagger UI must be disabled by default"

grep -Fq 'enabled: ${EFORGE_OPENAPI_ENABLED:false}' "$APP"   || fail "OpenAPI docs must be disabled by default"

grep -Fq 'enabled: ${EFORGE_DRUID_CONSOLE_ENABLED:false}' "$DRUID"   || fail "Druid console must be disabled by default"

grep -Fq 'password: ${EFORGE_DB_PASSWORD}' "$DRUID"   || fail "database password must come from EFORGE_DB_PASSWORD"

if grep -Fq 'login-password: 123456' "$DRUID"; then
  fail "default Druid password is forbidden"
fi

if grep -Fq 'addAllowedOriginPattern("*")' "$RESOURCES"; then
  fail "wildcard CORS origin is forbidden"
fi

if grep -Eq 'requestMatchers\([^)]*(swagger|v3/api-docs|druid)' "$SECURITY"; then
  fail "Swagger/OpenAPI/Druid must not be anonymous in SecurityConfig"
fi

echo "security-default checks passed"
