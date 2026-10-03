# EForge Enterprise Server

The server is a modular-monolith baseline derived from RuoYi 3.9.2 Spring Boot 3.

## Build

```bash
mvn -B -ntp -f server/pom.xml verify
```

## Required runtime secrets

The application intentionally has no committed fallback values for these secrets:

```text
EFORGE_TOKEN_SECRET
EFORGE_DB_PASSWORD
```

Typical local environment:

```bash
export EFORGE_TOKEN_SECRET='replace-with-a-long-random-secret'
export EFORGE_DB_PASSWORD='local-database-password'
```

## Common local settings

```text
EFORGE_SERVER_PORT=8080
EFORGE_PROFILE=/tmp/eforge/uploadPath

EFORGE_DB_URL=jdbc:mysql://localhost:3306/eforge_enterprise?useSSL=false&allowPublicKeyRetrieval=true&...
EFORGE_DB_USERNAME=eforge
EFORGE_DB_PASSWORD=...

EFORGE_REDIS_HOST=localhost
EFORGE_REDIS_PORT=6379
EFORGE_REDIS_DATABASE=0
EFORGE_REDIS_PASSWORD=

EFORGE_CORS_ALLOWED_ORIGINS=http://localhost:5173
```

## Diagnostics

OpenAPI, Swagger UI and Druid diagnostics are disabled by default.

For a trusted local development environment only:

```text
EFORGE_OPENAPI_ENABLED=true
EFORGE_SWAGGER_UI_ENABLED=true
EFORGE_DRUID_CONSOLE_ENABLED=true
```

Even when enabled, Swagger/OpenAPI and Druid endpoints still require application authentication through Spring Security.

Do not expose diagnostic endpoints publicly.

## Upstream compatibility

Java packages remain under `io.eforge.enterprise` during the current controlled migration step. Maven module identities already use EForge names. See `UPSTREAM.md` and the architecture ADRs before changing imported security/data-scope behavior.


### MySQL authentication note

The built-in localhost development URL uses `allowPublicKeyRetrieval=true` because MySQL 8 defaults to `caching_sha2_password` while local development commonly runs without TLS.

For production, set an explicit `EFORGE_DB_URL` with trusted TLS and do not rely on the localhost development URL.


## Runtime integration verification

CI starts real MySQL 8.4 and Redis 7.4 service containers, imports the upstream schema, launches the packaged Spring Boot application, then verifies:

- schema initialization
- server startup
- login with the seeded administrator account
- authenticated `/getInfo`
- Redis-backed `login_tokens:*` session creation

The same verification script is:

```bash
bash server/scripts/verify-runtime-integration.sh
```

It expects MySQL and Redis to already be available and the server jar to have been packaged.

## Data-scope parity

`eforge-framework` contains security-sensitive parity tests for the imported data-scope engine.

Current locked behaviors include:

- all data
- custom department mapping
- multiple custom roles
- current department
- department and descendants
- current user only
- fail-closed behavior without a user alias
- permission mismatch
- disabled roles
- mixed-role OR composition

Do not redesign data scope until these tests protect the current semantics.
