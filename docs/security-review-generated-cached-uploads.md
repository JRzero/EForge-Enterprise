# Generated raw image/file uploads across hidden pages

## Scope and boundary
Actual React Page.tsx.vm FieldControl must retain an already-sent image/file
upload across host Activity hide and browser-history return. The hide cleanup
previously aborted the request, decremented the parent upload count, and retained
local uploading=true:the form could save while the field stayed stuck uploading.
This change removes that read-style cancellation from sent raw upload writes.
Each actual settlement decrements its own count and retires only its controller,
then unlocks the field. No automatic write retry is introduced.

The original five-file/5MB/MIME controls, authenticated upload API, backend
permission/security boundaries, generated types, SQL and scheduler behavior are
unchanged. Identity/grant transitions still evict the old workspace and backend
checks remain authoritative. An already-sent upload may finish after a page is
closed; it cannot populate a new identity's freshly mounted form. RichTextEditor
image uploads have a separate lifecycle and are not accepted by this change.

## Actual before/after evidence
The initial before fixture's unhandled response waiter masked its primary
failure; it was fixed without changing production. generated-upload-before2-
runtime.log then ended1:after genuine browser back/profile/return, Save was
actually enabled while the raw field still displayed uploading. This was the
original template, genuine Boot/JWT/Redis upload and actual browser adapter.

Maven generated-upload-final-maven.log is BUILD SUCCESS:619 declared cases,
618 applicable executions with the existing local Windows symlink privilege
skip.10 data-scope tests pass; real Windows junction coverage is retained.
generated-upload-frontend.log ended0:reproducible client, lint/typecheck,
98 unit tests and production build. Fresh local mocked89 are not claimed;
they passed on the preceding exact accepted c3a7783 source.

53538 ended0 sequentially:generated-upload-disabled-runtime.log and
-generated-upload-enabled-runtime.log both pass. Each uses actual BrowserRouter,
StrictMode, current Application/Activity, real compiled generated Java/MyBatis,
seven generated OpenAPI clients/pages and genuine disposable SQL/HTTP data.
Eight additional upload checks per profile cover parent image/file fields in
crud/tree/sub and child image/file fields in sub. A held genuine POST crosses
actual browser back/profile/return; Save stays disabled, request failure remains
null and exactly one write exists. Releasing the gate yields genuine200, the
returned removable path and unlocked input. Original detail checks verify the
persisted URLs and actually served image/file contents, including child files.
All existing generated CRUD/tree/sub/automatic/String-key precision, read-cache,
XLSX, no-role/withdrawal/logout, retained rows and persisted audit assertions pass.
Both installed contracts retain exact SHA256
1B92C88E2974AAF19BA152C4D97847802BA7DFCBAC716771EAF1CBA9022CB0C0.
The main framework contract is a separate scope, not equated with fixture APIs.

## Remaining acceptance
Exact new-source cloud is pending. This phase does not accept rich-text upload,
other generated read/action lifecycle, all shared resource/monitor/embedded
lifecycle, sidebar/topnav/settings or the full goal. Form builder remains
deferred, not complete. The specific rejected Quartz runtime scheme is unchanged.
## Exact raw-upload cloud acceptance
Commit d492318a1424f2cd93d3e547b5f2f9f1ea4187ec is accepted:server37570013535
all three jobs and web37570013470 are terminal SUCCESS. Direct generated-upload-
cloud-accepted-server/web.log prove both53 framework browsers, complete API/
SQL/session/grant and exact OpenAPI gates, both seven actual generated pages
with eight raw-upload history checks each,98 units and89 mocked browsers.
619 declared Maven cases have618 applicable executions per platform; Linux
executes symlink protection and skips the Windows-only junction case. The later
RichTextEditor source is independent and must receive its own final acceptance.