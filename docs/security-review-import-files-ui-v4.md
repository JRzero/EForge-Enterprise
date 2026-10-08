# User import files, deferred loading and retained editor drafts

Date: 2026-10-08. Review baseline:
`8c324e8ce39fe54e415b2b8f6342a680bbd17ac8`.

This follow-up closes the file-validation difference recorded in the
[v3 import review](security-review-role-menus-import-v3.md), reduces JavaScript
loaded before a feature is needed, and protects additional system editors from
accidental disposal. It retains the modular monolith, pinned EForge packages,
canonical API schemas, server-side authorization and existing data-scope rules.

## Shared import file boundary

Both `POST /api/v1/system/users/import` and
`POST /system/user/importData` now call
[UserImportFileReader](../server/eforge-boot/src/main/java/io/eforge/enterprise/web/controller/api/v1/system/UserImportFileReader.java)
before entering the existing row importer. No row transaction starts until
the complete file passes validation and conversion. A workbook with a valid
early row and an excessive later row is rejected as a file; it cannot partially
write the early row.

| Check | Behavior |
| --- | --- |
| Upload bytes | Bound both reported size and bytes actually read to 10 MiB. Open the multipart stream once and close it on success or failure. |
| Format | Accept case-insensitive `.xls` with an OLE2 container or `.xlsx` with an ordinary XLSX workbook content type. Reject mismatched signatures, arbitrary ZIPs, corrupted files and macro-enabled OOXML files renamed to `.xlsx`. |
| ZIP budget | Reject duplicate entry names, more than 256 entries or more than 32 MiB of actual expanded entry data. Do not trust declared compressed/uncompressed lengths. |
| XML budget | Reject DTDs, external entities, nesting deeper than 64 elements or more than 200,000 elements. Inspect ordinary XML/relationship entries before opening OPC metadata, and include XML parts with unusual filenames before constructing the workbook. |
| XLS budget | Use BIFF events with a 200,000-record budget before constructing the workbook. |
| Row position | Import the first logical worksheet only. Header occupies row 1; the last accepted data position is row 1,001. Sparse rows, explicit blank rows and cell references cannot bypass the 1,000-data-row boundary. |
| Template | Require the existing `登录名称` header, preserve existing Excel column converters, and reject a sheet with no importable rows. |

The XLS event reader maps physical BIFF sheet order to the first logical tab.
The XLSX reader follows the actual workbook relationships rather than assuming
`sheet1.xml` is first. Row preflight runs before a full HSSF/XSSF workbook model
is created. Conversion then reuses that single workbook through a narrow
`ExcelUtil.importExcel(String, Workbook, int)` overload; it does not parse the
upload a second time. The caller owns and closes the workbook. Other legacy
stream-based `ExcelUtil` consumers retain their previous behavior.

### Compatibility and response semantics

Canonical validation uses HTTP 400 ProblemDetail with
`USER_IMPORT_FILE_INVALID`, `USER_IMPORT_TOO_LARGE` or `USER_IMPORT_EMPTY`.
A missing required multipart part still uses the canonical binding error.
The legacy facade keeps HTTP 200/AjaxResult, with code 400 and controlled
Chinese messages for invalid or oversized-row workbooks. A header-only
workbook keeps the legacy code 500 and its original empty-data message.
Parser exception details do not enter these controller responses.

Spring's multipart transport limit acts before either reader; its response is
checked independently by the real HTTP probe. This change does not rewrite the
global legacy exception handler.

The new budgets deliberately reject some unusually complex workbooks that
previously reached POI, including files with excessive non-imported worksheet
content or styling structures. They are local user-import limits, not global
POI settings or a promise of constant memory/CPU use for every possible Excel
file. An accepted file can still have row validation failures. The committed
row accounting, partial-success responses and SQL/Redis publication limitations
documented in v3 remain unchanged. The unused compatibility service method
`ISysUserService.importUser` is not a new HTTP entry point.

## Deferred frontend features

[Application](../web/app/Application.tsx) separately loads login, registration
and the authenticated workspace. The authenticated shell preserves permission
checks, the account/authorization owner key, screen lock and retained pages.
Unmounting it invalidates an earlier pending unlock operation.

Navigation search loads its UI and Fuse only when opened. The top-bar notice
preview no longer imports the readers table or its table dependencies. Notice
body rendering and DOMPurify load when a body is requested. Rich text still
passes through the existing sanitizer.

[DeferredFeature](../web/app/components/DeferredFeature.tsx) provides local
loading/failure states and an explicit retry. A retry recreates the lazy
wrapper, while browser-level ESM failures may still require the explicit root
reload action. There is no automatic reload or retry loop. Closing search or
a notice during loading remains available through Escape and the normal close
controls.

Notice read acknowledgement now begins after the sanitized body actually
mounts, rather than when the detail GET alone completes. The notification is
deduplicated per response and notice ID. Closing before content appears does
not mark it read; closing after the acknowledgement POST starts does not abort
that write.

### Measured production JavaScript requests

The comparison used production builds of the baseline and this revision in
the same Chromium 153 environment, isolated browser contexts and the same API
fixtures and actions. It sums every JavaScript response body actually requested
by the browser through each stated checkpoint. The gzip column independently
compresses and sums those same bodies; it is not a measurement of an enabled
server compression configuration. CSS, images and API responses are excluded.

| Checkpoint | Baseline JS bytes | Revised JS bytes | Reduction | Baseline / revised gzip bytes | JS requests |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cold login screen | 595,278 | 514,373 | 13.59% | 177,202 / 153,665 | 1 / 4 |
| Login followed by dashboard, cumulative | 711,439 | 583,742 | 17.95% | 215,758 / 176,704 | 5 / 7 |
| Existing session, cold restored dashboard | 711,439 | 576,209 | 19.01% | 215,758 / 173,556 | 5 / 6 |

The entry alone changes from 595,278 to 481,780 bytes (gzip 177,202 to 140,829),
but the table above is the relevant evidence that loading work was actually
deferred. After subsequently opening search, notice content and the posts
table, cumulative JavaScript is 723,655 bytes versus 721,824 at baseline; the
change moves feature costs to feature use and adds draft protection. Request
counts increase, so these figures are not a claim about network latency, paint
times or interaction speed. No vendor split, warning threshold, dependency
version or EForge baseline was changed.

## Editor and in-flight save protection

[useDraftProtection](../web/app/useDraftProtection.tsx) compares editable values
against their loaded initial values. Merely opening an editor is clean, and
restoring the initial values makes it clean again. Unchanged role/department
selection order does not create a false draft. Draft contents stay in memory;
only the pre-existing opt-in list of page URLs is persisted.

| Editor | Protected state |
| --- | --- |
| Users | Existing create/edit drafts also acquire the same pending-save protection |
| Role creation/editing | Form values and menu grants |
| Role data scope | Scope mode, linkage and selected departments |
| Departments | Form values and inline sort changes |
| Posts | Create/edit form values |
| Configurations | Create/edit form values |
| Dictionary types/entries | Create/edit form values |

Escape and explicit cancel open the same `继续编辑` / `放弃修改` decision when
there are changes. Department query, reset, refresh, edit and delete actions
that would clear an inline sort draft use the same decision. Completed
department reads are retained across tab switches, so resuming an Activity does
not silently refetch and clear unsaved sorting.

The workspace owns dirty and pending-save markers outside React Activity.
Hiding a page may clean up its effects, but does not remove these markers or
cancel a write. Pending saves block close, refresh and the entire affected
batch of tab-close operations before any tab is removed. A failed write
retains its draft. An acknowledged save or explicit discard clears the marker.
The exit dialog updates when a write succeeds or fails while the page is hidden.
Even an otherwise uncached page is retained while it has a draft or pending
write. Permission/account changes still replace the workspace owner.

The native beforeunload listener belongs to the authenticated component outside
the screen-lock Activity. It reads the workspace's live dirty/pending refs
through a guard scoped to the same account/permission/navigation owner key.
Locking the screen therefore keeps the warning active, including when a hidden
write completes or fails. Replacing the owner replaces the guard, so late
callbacks from an old account cannot attach its draft state to a new account.
Each page supplies one aggregate draft writer; adding concurrent independent
editors on the same path would require explicit aggregation first.

Detail GETs have a separate cancellation lifetime. Hiding the page aborts a
pending detail read; a late response cannot reopen a stale editor, and
returning to the page releases the old read's busy state. This cancellation
does not apply to a submitted write.

Browser refresh/close uses the native beforeunload prompt for dirty or pending
pages; a web app cannot prevent a user from explicitly leaving through browser
controls. Rich text announcement editor drafts, generator editors, deletion
requests and other business actions are outside this round's new editor guard.

## Verification

- `UserImportFileReaderTest` exercises real XLS and XLSX bytes, preserved
  converters, 1,000/1,001 row positions, blank/sparse rows, reordered tabs,
  extension/container mismatches, actual byte limits, stream ownership, ZIP and
  XML budgets, and ordinary workbook metadata.
- `LegacyUserImportControllerTest` exercises both real MVC contracts with the
  shared reader and importer, including file rejection before row transactions,
  missing parts, empty data and the inclusive row limit. Existing session and
  transaction lifecycle tests remain required.
- `verify-user-import-files-integration.ps1` runs from the disposable auth
  harness. Real multipart uploads check missing files, invalid extension or
  signature, corruption, empty data, missing header, transport size limits and
  1,001-row rejection. SQL snapshots must stay unchanged after every rejection.
  A 1,000-position workbook then updates exactly its populated final row.
  Intentionally blank fixture rows contain no cells, preserving physical row
  positions without manufacturing empty-string user records.
- `system-draft-protection.spec.ts` uses the real forms to exercise seven editor
  variants, cancel/Escape, restoring original values, hidden role drafts,
  pending/failed/successful saves, department sort preservation, atomic batch
  close protection and detail-read cancellation. Workspace unit tests cover
  both close-all and close-others while writes are pending, screen-lock hiding,
  acknowledgements while locked and owner changes. Actual user editor and
  screen-lock browser cases exercise the same registration through the app.
- `deferred-loading.spec.ts` verifies delayed feature requests, closable loading
  states, local failures, and notice content/read acknowledgement ordering.
  Existing navigation, screen lock, notice and workspace recovery cases remain
  required.

Validation results are recorded in the accompanying pull request after the
full local gates and remote MySQL/Redis integration jobs complete. Local
Maven clean verify and packaging passed. The current source-backed suite has
835 test cases: zero failures/errors, all 6 real Redis cases and all 10
data-scope parity cases passed, and one Windows-only junction case is skipped
on Linux. Frontend lint, typecheck, generated-client reproducibility, all 125
unit tests and the production build passed. The complete local fixture browser
suite passed in two disjoint halves: 86 + 86 = 172 tests, no failures, skips or
retries. Remote integration results are recorded in the pull request. The
500 kB entry warning threshold is unchanged.
