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

Initialize the unchanged upstream schemas first, then apply files under
`sql/migrations/` in filename order exactly once. Bootstrap requires these
additional columns. There is no automatic production migration runner yet;
the verification scripts initialize disposable databases and apply the
migrations explicitly. Re-importing upstream schema drops existing data and
is only appropriate for fresh disposable environments.

Bootstrap and navigation security decisions, including shared permission-query
hardening and session refresh behavior, are documented in
`docs/bootstrap-security-review.md`.

Canonical authentication can also be checked with PowerShell 7 on Windows or
Linux after packaging the server:

```powershell
./server/scripts/verify-auth-integration.ps1
```

This requires Docker and creates isolated MySQL 8.4 and Redis 7.4 containers on
localhost ports 13306 and 16380, with the test application on port 18081.
Ports can be overridden with `-MysqlPort`, `-RedisPort`, and `-AppPort`.
The script initializes only its own disposable database, verifies canonical
and legacy login, `/getInfo`, Redis session TTL, captcha replay rejection, HTTP
errors, and authenticated OpenAPI DTOs, then removes its containers and stops
the test application. Logs remain under `eforge-boot/target/auth-integration/`.

New applications use `POST /api/v1/auth/login` followed by
`GET /api/v1/app/bootstrap`; see
`contracts/bootstrap-contract.md` for the request and error contract.

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
