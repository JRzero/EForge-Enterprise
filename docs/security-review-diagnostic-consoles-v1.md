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

Console entry URLs and response DTOs contain neither JWTs nor tickets. Ticket
values stay in HttpOnly cookies and hashed Redis bindings; existing application
bearer sessions keep their established storage contract. Real browser traces
are disabled. Only the generated-client open calls opt into same-origin cookies;
normal API/status reads continue to omit cookies. Redis binding failures and
authorization snapshot failures return generic CONSOLE_UNAVAILABLE without
exception text or cached private values. Configured-off consoles return a typed
false status and reject issuance/resources with CONSOLE_DISABLED.

Diagnostic servlet, HTML, script and schema responses enforce no-store even
when an imported servlet tries to set public cache headers, future Expires or
reset the response. The wrapper is limited to the fixed diagnostic resources;
ordinary resource caching stays unchanged. This ensures logout/revocation
checks reach the server instead of reusing an earlier cached success. Parent
pages also probe resources without cache and remove the iframe on expiry,
current-grant failure or application logout. Embedded Druid forms, JSON links,
downloads and Swagger authorization/Try it out retain their original controls.
Live tests remove the iframe before failure snapshots, so Swagger bearer
inputs and generated curl text cannot enter the failure DOM artifact.

ADR-0016 records the architecture boundary and deployment defaults. Unit/MVC
coverage and owned MySQL/Redis verification include actual console resources,
nested assets/schema, permission changes, logout, ACL faults, expiry and no
session extension. Default-disabled and explicitly-enabled scenarios are both
required. React pages, full browser control acceptance and exact-head cloud
verification remain separate gates recorded in the parity inventory.

### Independent servlet session identity

Task API regression uncovered an intermittent original Druid login failure:
Spring Security's default session authentication strategy changed JSESSIONID on
each stateless JWT/cookie authentication. Concurrent iframe resources then sent
obsolete identifiers and were redirected to the inner login page. A targeted
test reproduces the identity change before the fix.

The stateless security chain now explicitly uses NullAuthenticatedSessionStrategy.
Application authentication remains JWT/Redis based; servlet sessions do not
authenticate product endpoints. Druid still validates its own original login,
and every resource still requires the scoped ticket and current authoritative
grant. This avoids session fixation handling for repeated JWT authentication;
it does not add session-based application login or relax console authorization.
The targeted test retains the native identity and inner-login attribute across
successive authentications. Real browser checks retain the native cookie across
the original basic/JSON popup/SQL interactions, as well as existing logout and
grant-revocation failures. No raw native session identifiers are logged.
