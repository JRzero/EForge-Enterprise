# Pagination total shrink — 2026-10-08

The original Element UI 2.15.14 pagination watches the successful page count and
normalizes a current page beyond the last page. The shared EForge consumer did
not do this after another session removed rows. A service failure must not be
interpreted as a successful zero count.

The shared Pagination accepts an optional total: undefined means there is no
successful current result. It normalizes only a known result after loading and
pending writes finish. Thirteen framework consumers preserve that distinction;
generated CRUD/sub pages pass an unknown count when their request failed. Tree
pages retain their full hierarchy. No API, permission, filter or SQL semantics
changed.

The exact mocked posts case failed before the correction (pagination-shrink-before.log)
and passed after it. A failed page-two refresh preserves page two and its filter;
a successful retry returning nine rows requests pages two then one; a successful
zero result also normalizes to one without looping. The complete frontend gates
passed with106 units and144 mocked browsers. Full Maven verification passed with
661 declarations, including10 data-scope cases and one existing platform skip.

Actual MySQL/Redis/browser verification passed: pagination-shrink-live.log proves both live posts cases, the two independent sessions and the full canonical API regression. The existing live posts case
now uses two independent authenticated browser contexts: the other session
removes only three owned fixture rows, and later all remaining owned rows. The
original page must refresh from page two to page one, preserving its filter and
displaying the exact surviving SQL rows. Existing numbered/jump/10/20/30 and
twelve-row bulk deletion checks remain. Fixtures belong only to the isolated
verification database. The sequential authority96741 terminated0. Both default and enabled
configurations passed all seven installed generated families, with the original
CRUD/tree/sub, upload, exact ID, permission, activity ownership and audit checks.
Logs: pagination-shrink-generated-default.log and
pagination-shrink-generated-enabled.log. The real root OpenAPI SHA256 remains
CF4E3C111DC4D537201CF809E36F1B7907F6D38C678D7FB1467B576FE8DFF50C. No cloud acceptance is claimed for this stage.


Exact cloud acceptance: 2a20eb3726b75ec663588ac10e4a42281052ed3e has terminal SUCCESS in server37683623514 (all four jobs) and web37683623639. Direct pagination-shrink-cloud-{server,default,enabled,web}-accepted.log proves661 backend declarations (10 scope and one existing skip),106 frontend units,144 mocked browsers, both62 real browser/fullAPI/OpenAPI profiles and both configurations of all seven installed generated families. The independent-session post shrink case passed in both cloud profiles. No product failure occurred in this stage. Current inventory retains119 operations/114 accepted/five task mutations pending and175 source-path assignments; assignment alone remains weaker than semantic evidence. Whole goal remains incomplete; form builder deferred.
