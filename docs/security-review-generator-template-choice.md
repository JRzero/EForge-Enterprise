# Canonical generator frontend template choice

The canonical update previously always wrote eforge-react. A complete generator
editor must also preserve the three original template choices. UpdateRequest now
has one optional fixed-enum webType; omitted/null keeps the old canonical React
default, and explicit eforge-react/element-ui/element-plus/element-plus-typescript
is stored. This changes existing metadata only, adds no schema, performs no
physical DDL and does not resolve arbitrary template/component strings.

Actual MVC19 tests pass, including four selections with authenticated actor,
the unchanged default, original edit permission/no-role denial, physical identity,
clearing/options and transaction error cases. An arbitrary ../../private/template
is rejected before any SQL mapper interaction.

Full local Maven615 (605boot+10 data-scope, one existing host-specific skip) passes:
generator-template-choice-full-verify.log, process42325 terminal0.
Actual default32185 and enabled7854 full original Boot/MySQL/Redis/API/browser
processes are both terminal0, each43 original real browsers:
generator-template-choice-disabled/enabled-runtime.log. Each saves all four
choices, reads the precise selected metadata, performs actual previews containing
the selected Vue/React family, preserves owned physical rows, and verifies invalid
selection leaves a full metadata snapshot unchanged. The complete existing SQL
rollback/guard/creation/output/session/ACL/permission/captcha checks also pass.
Vue dialect-specific renderer fidelity remains covered by existing native/template
tests; the new HTTP check does not claim every generated control variant.

Both live main OpenAPI snapshots and the committed contract are identical:
7C431ED9D0876F95649E9432A6B06759BF741E93BE8B58BE9AD1FC33B4EE5E5D.
The client is generated twice reproducibly from this actual main schema; its
request exposes the optional four-value union. Frontend lint/typecheck/83 units/
production build pass, process88672 terminal0.

Exact new cloud acceptance is pending. Earlier8157 route installation is accepted
by server37522840964 all three and web37522840972; it does not prove this later
contract change. Full generator manager UI and all control variants remain
required, alongside shared shell/final active parity. Form builder stays deferred.