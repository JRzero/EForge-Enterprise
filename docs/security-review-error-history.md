# Denied-page history parity

The fixed original frontend baseline's views/error/401.vue provides a back action:
history back unless the original noGoBack query is truthy, in which case home.
The canonical permission-denied page previously offered only home. This was an
actual uncovered capability, not an API operation or an inventory mapping.
The canonical 403 page now offers both history return and the existing home
action. The 404 page retains its home action. No permission or server contract
changes are involved.

Query semantics preserve the original router representation: absent or a single
empty value uses history; nonempty strings (including `false` and `0`) use home;
repeated values are an array and therefore truthy, including repeated empties.
No query value is interpreted as a return URL. Browser history is used directly;
the home branch always navigates to the fixed dashboard path.

error-back-before.log proves the previously missing action fails in an actual
browser. The six session cases then pass in error-back-session-fixed.log,
including history, single empty, nonempty and repeated-empty query branches,
404 behavior and zero protected-role data requests. Full lint/typecheck/client
reproduction/build,98 units and142 simulated browser cases pass in
error-back-final-*.log. A real freshly registered no-role account also tests return
to its own profile, continuing server403 on role reads, fixed home and unchanged
empty roles/permissions. Its runtime authority is pending; precise new source
cloud acceptance is required. Java source and the contract are unchanged.

Form builder remains user-deferred. The five task mutations and the specific
rejected runtime consistency proposal remain pending. Full project completion
is not claimed.

Local authority48423 completed0: actual no-role registration/history/home/continued403 proof and complete MySQL/Redis/Quartz/OSHI/ACL/permissions/rollback/captcha API PASS. Live OpenAPI equals committed CF4E3C111DC4D537201CF809E36F1B7907F6D38C678D7FB1467B576FE8DFF50C. All parent-owned fixtures/processes cleaned. No fresh local Maven for unchanged Java source; exact CI remains required.

