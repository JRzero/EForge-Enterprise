# Generator custom filesystem output review

The canonical POST /api/v1/tool/generator/tables/{id}/custom-output and original
generatorCode share the immutable complete rendering bundle and filesystem writer.
Original tool:gen:code authorization is enforced before SQL. allowOverwrite=false
remains the default and is checked before metadata reads. All rendering, collision
and output-size checks finish before installing any generated file. Original custom
output selects Java/XML backend files; frontend and SQL remain in preview/download.

## Configuration and filesystem boundary

gen.outputRoot takes precedence over the legacy flat outputRoot property; the
fallback is user.dir/src, preserving the old / mapping. Real Spring configuration
tests prove both property forms and priority without depending on ambient OS
settings. Relative destinations and absolute destinations must remain within that
administrator-configured root. Traversal, existing symlinks/junctions, special
files, ancestor files and directory targets are rejected. Result paths are relative
to the root and retain nested Unicode destinations without disclosing server paths.

The root must be controlled exclusively by trusted administrators and the server
account. Path inspections are not kernel containment against a hostile OS actor
concurrently replacing directories on Windows. Keep the root unwritable by
untrusted users/processes. The writer serializes only its own file writes; it adds
no SQL, metadata, authentication or scheduler locks.

Each UTF-8 file is completed in a unique sibling temporary file, then installed by
atomic replacement. Unsupported atomic moves fail rather than truncate in place.
Outside hard-link identities retain their old contents. There is no bundle-wide
filesystem transaction or rollback of committed/preexisting files. Outcomes are
CREATED/REPLACED/FAILED/UNCONFIRMED/UNATTEMPTED. IOException after installation starts
is UNCONFIRMED, including lost acknowledgement after a successful move. Only owned
temporary files are cleaned up; retry deliberately overwrites acknowledged files.

## HTTP and client boundary

Success is typed200 CustomOutputResult. Partial output is typed503
CustomOutputProblem with a fixed safe message/code and retained file outcomes;
original AjaxResult stays behind the original controller boundary. Exceptions
leave audited actions before error handling, retaining honest failed audit.
No OS/SQL/driver detail is exposed. Actual initial OpenAPI omitted200 because its
explicit503 annotation suppressed inferred success; explicit200/503 annotations
fix the verified defect. Earlier B4070CEC... exports are not the accepted contract.
The corrected actual export has SHA256
D3161897413EDBBE68548E6CA5FB73B00E1E5624D678FC3104F526E9694892E3.

The generated TypeScript function and authenticated adapter preserve long IDs,
POST/no body/no-store/JWT header, typed results and partial outcomes. Only this
operation accepts503 for structured decoding. Other errors retain normal auth
behavior;401 signs out. Network loss or cancellation produces an explicit safe
UNCONFIRMED error. There is no automatic write retry or claim that no file changed.

## Evidence

Full Maven verify603 (593boot+10 data-scope) passes; one Windows symlink case skips
for missing OS privilege. Actual Windows junction creation/refusal executes. Latest
target10942 passes34 cases (11filesystem+23MVC), with the same one OS skip. Tests
prove byte fidelity, atomic overwrite, whole-selection refusal, retained prior
files, actual before/after-install lost acknowledgement, outside hard-link
retention, nested Unicode results, permission-before-SQL and disabled protection.
Initial failures were missing PK in a fixture and the explicit sync MVC slice
omitting the real writer dependency; corrected fixtures/context, not production
permission or consistency checks. Full verification log is
server/eforge-boot/target/generator-custom-output-settings-verify.log;
latest target is generator-custom-output-isolated-target.log.

Frontend generated reproduction/lint/typecheck/79 unit tests/build pass in
generator-custom-output-final-frontend.log. The corrected no-browser default
real API profile9490 passed and exported the corrected contract; first two
profiles64801 also passed all APIs but used the superseded contract. Final default
and enabled profiles83433 ended0, each with43 browsers and complete API PASS in
generator-custom-output-disabled/enabled-final-runtime.log. Both actual exported
final OpenAPI files equal the committed D3161897... contract exactly. Original and
canonical file bytes/replacements, path refusal/default protection/no-role/audit,
complete metadata/business rows and all MySQL/Redis/Quartz/OSHI/ACL/captcha APIs
pass. No local integration app is retained. Mocked browser3429 ended0 with64 tests.
Cloud acceptance is still pending this implementation's exact commit/workflows.

Runtime probes use uniquely owned roots, restore environment and validate cleanup
paths before recursive deletion. They compare original/canonical backend files
with ZIP bytes, verify actual replacements/path refusal/default protection/no-role,
and compare all metadata/business rows. CI enables custom output only in the
explicit disposable enabled-console profile. Never package over a live local app.

## Remaining scope

This is a custom-output stage, not complete generator acceptance. True React/EForge
templates, full manager UI, broader language/tree alias semantics and actual
generated CRUD/tree/sub modules compiled and deployed through HTTP/browser remain
required, followed by full shell/shared behavior and per-capability audit. Form
builder is deferred. The specifically rejected Quartz mutation runtime proposal
remains unimplemented. Prior bd83767 cloud does not validate this new implementation.
