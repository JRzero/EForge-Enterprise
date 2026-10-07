# Original generated upload controls

Current implementation is uncommitted and awaiting actual generated-page
verification. The previous image-gallery stage does not accept these changes.

The pinned original FileUpload/ImageUpload components support editable lists,
file opening/image viewing, one-item deletion and default drag ordering. Both
reject comma filenames, limit lists to five, and require each file to be less
than five MiB. Original document extensions are doc/docx/xls/xlsx/ppt/pptx/txt/pdf.
Previously generated editing only displayed filenames and removal buttons.

The generated React controls now use safe HTTP(S) links and image viewing,
ordinal deletion (including duplicate paths), pointer ordering with capture,
touch-action suppression on the handle and accessible arrow-key ordering.
Disabled/read-only and pending-upload controls cannot reorder or remove.
Ordering remains CSV data and is saved by the original generated write flow;
it is not a direct filesystem operation. No EForge source was copied.

Per-file checks precede HTTP. Mixed invalid/valid and failed/successful batches
retain successfully acknowledged paths and report individual failures. The
five-file overflow rejects the entire selection before upload. Comma rejection
is specific to the CSV widgets, not the rich-text editor's single image URL.
Uploaded-response commas also fail safely rather than corrupting CSV values.

Pure resource URL handling rejects script/data schemes, credential URLs and
control characters while preserving legal Unicode paths. New windows use
noopener/noreferrer. Existing gallery encoding and security tests remain.

Local strict frontend lint/types,106 units,143 simulated browsers and build
passed. First actual Maven checks exposed Velocity parsing of TypeScript
template expressions; these were replaced with ordinary concatenation.
The targeted template compile, final full Maven and real MySQL/Redis installed
generated-page verification are pending. Real assertions cover SQL ordering,
one duplicate deletion, root/child editing, nested preview focus, zero HTTP for
bad type/comma/size/count, retained partial successes and original model data.
Neither this document nor helper tests establish full parity or project completion.

Final661 declarations passed after the four actual template tests proved both
new interpolations were fixed. The first file-window fixture mistakenly checked
the UTF-8-decoded Chinese string in browser text. Actual uploaded text without
charset/BOM is decoded by Chromium's document heuristics, producing a different
display string while HTTP bytes are unchanged. The original widget opens that
same URL without transcoding. The fixture now verifies the exact raw UTF-8
bytes, actual window navigation/nonempty document and null opener; it does not
claim an arbitrary uploaded document encoding can be inferred or repaired.
Two intermediate failed fixture runs remain in upload-controls-actual-generated
and upload-controls-popup-fixed-generated logs. The final byte-exact authority
is live and not yet accepted. Production upload data is never rewritten for it.

The next real save diagnostic proved the test fixture left original editOnly
required data blank (native "Please fill out this field"), so no save HTTP was
sent. The fixture now fills root editOnly and childEditOnly before testing
upload persistence; required-field product checks are unchanged. Authority
upload-controls-required-final-generated.log is current, awaiting completion.

The subsequent hit diagnostic found a genuine subtable layout defect: its wide
table expanded the entire grid form to3741px, clipping the root upload handle.
The generated page now has a scoped class; its form grid uses minmax(0,1fr),
and the complete child table has its own labelled, keyboard-focusable horizontal
scroll region. No child field was removed. Actual pointer assertions use visible
handle hit-testing, not the centre of a potentially off-screen wide row.

83259 terminated0. upload-controls-contained-final-maven.log proves final661
declarations (651 Boot, one existing platform skip,10 scope) with zero failures;
upload-controls-contained-final-generated.log and
upload-controls-contained-enabled-generated.log prove all seven installed
families under both configurations. CRUD/tree/sub root and child real SQL saves,
pointer/key ordering, exact single-duplicate deletion, nested preview, no-opener
file windows/exact bytes, zero upload for invalid selections, individual HTTP
failure and retained successful uploads all passed. Original lifecycle/date/
prototype/permission/audit/XLSX/automatic/String PK checks remained green.
The pending source cloud acceptance must include all four server jobs and web.

Published sourcea2045512ef41b448ea9506ff1d0697c8a9153411 has successful
web37677153277: exact client/lint/types/106 units/build/143 simulated browsers.
Server37677153350 remains pending. Direct web logs revealed hosted Ubuntu
actually uses file:/etc/apt/apt-mirrors.txt; rewriting only sources.list and
ubuntu.sources did not change that selected mirror. The bounded installer is
being corrected to include the demonstrated mirror-list file, preserving
other vendor sources and priorities. The syntax and exact Azure/archive-only
substitution were checked without modifying local operating-system sources.
This is not yet accepted cloud evidence for the corrected installer.

The failed a204551 verify log additionally proves the unprivileged timeout
left sudo's apt child holding lists/lock, so its retry could not start. The
installer now runs the dependency-only timeout as root, owning that apt process
group, and downloads browsers separately as the ordinary runner user. It uses
the already-installed pinned Playwright CLI, two-minute bounds per part and two
attempts, without terminating unrelated processes or dropping dependencies.
Syntax and the installed CLI's install-deps command were checked. The current
mirror-only62e57ec cloud run is still independent evidence, not final acceptance
of this last process-ownership correction.
