# Diagnostic consoles v1 security review

The compatibility scope is the original Druid and Swagger servlet interfaces.
Their existing navigation grants are authoritative on both canonical operations
and raw resources, including direct bearer requests. New endpoints use concrete
status/entry DTOs and no-store semantics. Existing canonical contracts remain
unchanged; raw console authorization failures now use generic ProblemDetail.

The boot service uses the existing DB-backed account/role/grant snapshot for each
resource access. Disabled/deleted accounts invalidate their login session;
revoked roles cannot use a still-present ticket. Its read-only snapshot does not
persist the session, and the JWT filter does not renew diagnostic reads. Product
bootstrap/session refresh and all data-scope behavior remain unchanged.

Tickets contain 256 bits of secure random data. Redis keys use ticket digests
and store only opaque login UUIDs with five-minute expiry. The browser receives
only HttpOnly/SameSite=Strict cookies; Secure defaults true and cannot be disabled
on HTTPS. Ticket binding resolves the actual current login key and checks the
cached session UUID. Malformed, duplicate, missing, expired or mismatched cookies
fail closed. The fixed prefix resolver rejects encoded/traversal/matrix paths.
Cookie scope never authenticates product APIs, logout or uploads, even though
Swagger needs a root cookie path for its split UI/schema resource prefixes.

Cookie resources require positive same-origin fetch metadata, Origin or Referer.
Cross-site and sibling-site fetches are rejected; Origin parsing also rejects
userinfo, malformed hosts/ports, paths, fragments and queries. This includes
Druid's GET mutation endpoints. The existing CORS boundary can reject a hostile
origin even before the diagnostic filter. CLI cookie probes supply an explicit
trusted Origin. A bearer-only schema export remains available when Swagger UI
is disabled, so client reproducibility does not require enabling an interactive
production console.

No JWT or ticket is placed in entry URLs, response DTOs, client storage or browser
traces. Only the generated-client open calls opt into same-origin cookies;
normal API/status reads continue to omit cookies. Redis binding failures and
authorization snapshot failures return generic CONSOLE_UNAVAILABLE without
exception text or cached private values. Configured-off consoles return a typed
false status and reject issuance/resources with CONSOLE_DISABLED.

ADR-0016 records the architecture boundary and deployment defaults. Unit/MVC
coverage and owned MySQL/Redis verification include actual console resources,
nested assets/schema, permission changes, logout, ACL faults, expiry and no
session extension. Default-disabled and explicitly-enabled scenarios are both
required. React pages, full browser control acceptance and exact-head cloud
verification remain separate gates recorded in the parity inventory.
