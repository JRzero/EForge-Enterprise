# Rich-text upload ownership, hidden results and retained cursor

## Actual implementation boundary
The shared RichTextEditor separates a sent upload from the Quill mount controller.
Activity cleanup still removes Quill listeners and DOM; it does not cancel the
sent write. Each component instance owns one pending upload and a queue of
sanitized completed images. A visible current editor inserts its own result;
a hidden editor queues the result until restoration. A truly disposed instance
cannot flush that queue into a new form. There is no automatic upload retry.
The original JPG/PNG/SVG, size, readonly, HTML/video/paste sanitization boundaries
are retained. Backend upload authorization remains authoritative.

Upload settlement captures its own busy callback and releases it once. NoticesPage
counts outstanding image operations rather than letting an older editor's boolean
false unlock a newer pending upload. Generated controls retain their existing
UploadContext counter. Workspace identity/grant invalidation remains unchanged;
old instances cannot populate new identity forms.

The editor retains local emitted HTML, the last actually received parent value,
and its selection separately. StrictMode/Activity reconstruction must not replace
just-emitted restored content with the same older parent value before React
commits the new parent state. Actual external backfill still applies; queued
images flush after controlled-value synchronization. The retained cursor prevents
subsequent images from being inserted before the restored image.

## Failure evidence and corrections
generated-rich-upload-before-runtime.log ended1 on the original shared editor:
a genuine generated image POST crossed browser history and the Save button
became enabled because hide cancelled the upload. Two initial actual-notice
fixture failures were test mistakes:the real profile entry is a link, and the
canonical image endpoint returns201, not the legacy generic uploader's200.
The corrected real notice test then exposed an actual cursor/content defect:
after hidden completion, the last image was the4-pixel earlier PNG instead of
the10-pixel SVG. rich-upload-cursor-before/after/final-browser.log each had3
passed/1failed while the repair was incomplete; the stronger synthetic sequence
proved image widths were [3,10,4] instead of [4,3,10]. Local-only diagnostic logs
identified an effect remount replacing just-emitted HTML; all instrumentation
was removed before final genuine validation.

rich-upload-cursor-owned-browser.log ended0 with all4 real Quill/StrictMode cases:
complete original formatting/backfill/readonly/video/paste safety; hidden result
queue and exact subsequent image order; true disposal/new-form isolation; and
older settlement cannot unlock another pending upload. No stale image emits into
the new form. The parent fixture uses the same counted ownership as NoticesPage.

## Final authoritative local evidence
1488 ended0 as one sequential command:real notice and complete APIs, default and
enabled generated deployments, then default and enabled full framework browsers
and complete APIs. No source changed during these live processes.
- rich-upload-notice-owned-runtime.log:all3 original actual notice cases pass.
  A held real image POST crosses profile/back twice; Save stays locked and one
  request remains alive. It completes with genuine201 while hidden, restores one
  image, and the original PNG/JPG/SVG order, SVG dimensions/pixel safety, persisted
  rich content/read state/clear/delete remain proven.
- rich-upload-generated-disabled/enabled-runtime.log:each seven installed
  Java/MyBatis/React/generated-client categories passes. Eleven held genuine
  writes per profile comprise the original eight raw parent/child uploads and
  three parent rich-content uploads in crud/tree/sub. Save stays locked, request
  failure is null, exactly one POST yields genuine200 and the uploaded rich image
  is present in actual SQL-backed detail JSON. Original controls/CRUD/tree/sub/
  precision/XLSX/role withdrawal/logout/audit and physical row checks pass.
- rich-upload-full-disabled/enabled-runtime.log:each53 actual framework browsers
  and complete MySQL/Redis/Quartz/OSHI/ACL/captcha/permission/metadata/physical-row/
  original compatibility regression passes; both real OpenAPI gates match.
- rich-upload-final-maven.log:BUILD SUCCESS,619 declared cases,618 applicable
  local executions; the existing Windows symlink privilege skip is honest and
  real Windows junction protection passes.10 data-scope cases pass.
- rich-upload-owned-final-frontend.log:reproducibility/lint/typecheck/98 units/
  production build/all91 mocked browsers pass on the final source.

Both final framework contracts and the committed contract equal SHA256
65642E8458E11E179197EB8060A2F197E0BB0DB8351E4E18DDAFF8E458DCD8BC.
Both installed generated fixture contracts independently equal
1B92C88E2974AAF19BA152C4D97847802BA7DFCBAC716771EAF1CBA9022CB0C0.
Do not equate these different contract scopes.

## Independent existing test timing correction
The first complete frontend run was90passed/1failed:the cache confirmation test
released its mocked successful response after a fixed500ms before the later
assertion that Escape must keep the busy dialog visible. Evidence showed normal
completed closure, not a cache product change. The fixture now holds that response
until the busy/cancel/Escape checks finish, then releases it and still verifies
successful scoped clearing. No CacheEntries product source changed.42 repeated
cache/editor cases and the complete91-case suite passed; the final source's full
91-case run is also green.

## Scope still open
Exact new-source cloud acceptance is pending. This does not accept all editor/
resource/monitor/embedded lifecycle, nested rich-image upload-specific final
audit, sidebar/topnav/settings or the complete goal. Form builder remains
deferred-not-complete. The explicitly rejected Quartz runtime scheme is unchanged.