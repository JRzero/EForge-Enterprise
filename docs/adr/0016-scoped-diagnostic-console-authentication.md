# ADR-0016: Scoped browser authentication for diagnostic consoles

Status: Accepted

Date: 2026-10-05

## Context

The original Druid and Swagger pages embed the actual servlet interfaces.
An iframe and its nested resources cannot carry the application's normal fetch
Authorization header. Disabling the console permanently or anonymously exposing
its resources would not preserve the required authenticated capabilities.

## Decision

Keep Druid, Swagger UI and OpenAPI settings disabled in production defaults.
Canonical status/open endpoints under `/api/v1/monitor/consoles` use concrete
DTOs and the existing `monitor:druid:list` / `tool:swagger:list` grants. Opening
an enabled console requires normal bearer authentication and current DB grants.
Its response contains only a fixed entry path and a 300-second lifetime.

Issue a random 256-bit, HttpOnly, SameSite=Strict cookie. Store only its SHA-256
digest key and underlying login-session UUID in Redis for 300 seconds. Druid's
cookie is restricted to /druid. Swagger's cookie requires root path because its
UI assets and API schemas have separate servlet prefixes; the resolver accepts
it only for the fixed Swagger/OpenAPI resources. No application API, logout or
uploaded resource accepts console-cookie authentication. Never put JWTs or
console tickets in URLs, DTOs, frontend storage or generated client data.

The existing JWT filter delegates only fixed diagnostic paths to an optional
framework interface, implemented by the boot module. This preserves the module
dependency direction. Bearer and cookie resource requests both require fresh
account/grant validation. Cookie requests additionally require positive
same-origin evidence; cross-site and sibling-origin requests are rejected.

Resource reads do not renew tickets or login sessions. A read-only variant of
the existing bootstrap authorization snapshot refreshes the in-memory principal
without writing it back to Redis. Ordinary bootstrap behavior is unchanged.
This prevents a diagnostic read from recreating a session removed concurrently
by logout. Missing sessions, expiry or full cache clearing make tickets unusable;
revoked grants are rejected on every resource request.

Authenticated OpenAPI schema export can remain enabled independently of
interactive Swagger, for reproducible client generation. A disabled interactive
console cannot use cookies to access that export.

## Consequences and verification

The server remains a modular monolith and both upstream baselines stay pinned.
No replacement console, additional identity system or anonymous exception is
introduced. Redis faults fail closed with generic ProblemDetail. Cookie Secure
defaults to true; only explicitly configured disposable HTTP verification uses
the false override, while HTTPS always requires Secure.

Targeted tests cover permissions, scope, expiry/bindings, no session renewal,
same-origin evidence, failure behavior, canonical DTOs and the actual security
filter. Owned runtime verification covers actual Druid HTML, Swagger HTML/assets/
schema requests, grant revocation, logout, Redis ACL failure and TTL behavior.
The inventory records stage evidence; the React console pages and their real
browser acceptance remain required beyond the API/client checkpoint.
