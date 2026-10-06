# Generator target-language text contexts

GeneratorOutputText provides explicit contexts for Java strings/comments and
identifiers, JSON/JS/TS string expressions, XML 1.0 values, MySQL strings/identifier
segments and SpEL string expressions. It is an internal building block; no output
endpoint or old template is changed yet. Full immutable rendering/output bundles,
context-specific use in all templates, React/EForge CRUD/tree/subtable output,
path/ZIP/custom-output boundaries and management UI remain required.

Java strings use fixed three-digit octal control escapes and escape quotes and
backslashes. Comments neutralize terminators and Unicode prelexing with character
references. JSON escapes HTML script delimiters, control characters and line/paragraph
separators; it preserves valid surrogate pairs. XML rejects characters outside XML
1.0 and references whitespace so attribute normalization does not change values.
SpEL doubles quotes; Java embedding still requires a separate Java literal layer.
Java identifier checks use the Java 17 language boundary and preserve legal Unicode
and contextual names such as record when used as a field. Class/type contexts need
additional contextual validation; this helper does not claim to validate them.

MySQL string expressions use UTF-8 hex plus explicit utf8mb4 conversion, avoiding
backslash mode and connection encoding ambiguity. Identifiers quote one segment
and double embedded backticks. A dotted name is one quoted name, never split into
a qualified expression. MySQL's identifier size/NUL/BMP limits are respected.
Invalid Unicode fails with fixed GENERATOR_OUTPUT_TEXT_INVALID, never lossily
converted. Identifier semantics still require configured table/field validation.

Five targeted tests use the actual Java compiler/classloader to recover hostile
string contents with no injected members, Jackson JSON parsing, a real XML parser
for whitespace/metacharacter fidelity and actual SpEL parsing for executable-looking
data. NULL/empty, invalid Unicode and legal identifier boundaries are covered.
The native probe evaluates and inserts generated literals under default,
ANSI_QUOTES, NO_BACKSLASH_ESCAPES and combined modes in an owned disposable MySQL
schema. It checks exact Unicode, NUL/control characters, NULL/empty and attack text,
quoted Unicode/backtick/dotted identifiers, retained rows and no unexpected table.

Final complete Maven and both native case mode results must be inspected before
acceptance. Previous target test succeeded; a first native attempt selected an old
report's packaged classpath, which did not yet contain this new class. The harness
now uses GeneratorOutputTextTest's actual resolved classpath after the final build.
This was a harness/build selection failure, not evidence about product SQL safety.
No active real application is packaged over; isolated probe containers are cleaned
by their owner only. Form builder remains deferred, other requirements remain.
Final local evidence: full Maven verify is terminal success with 495 boot tests
plus 10 data-scope parity tests (505 total). Both actual MySQL native case modes
finish with 23 assertions, including an independent Unicode code-point oracle.
The source launcher explicitly selects UTF-8. Sequential session 33292 is terminal
exit 0; prior full build/native session 67013 is terminal exit 0. Logs are
 generator-output-text-final-verify.log and generator-output-text-mysql-0/1.log
under server/eforge-boot/target. Exact-commit cloud is still pending. No template,
output endpoint, path handling or UI acceptance is claimed for this foundation.
Exact cloud acceptance (2026-10-06): snapshot implementation
5567fb2e348ba6c1faa627d5a8e7a31f12514e2c, server run 37411636219,
and text-context implementation 7c7405cec289188b911337f6f876a13b2443e7b8,
server run 37412282095, each finished successfully in all three jobs.
Direct logs generator-snapshot-cloud-accepted.log and
generator-output-text-cloud-accepted.log prove both profiles each 43 real browsers,
complete real API/MySQL/Redis/Quartz/OSHI/ACL/captcha regressions, identical live
OpenAPI and the native assertions for their exact sources. Both modes of the text
commit show 30 snapshot and 23 output-context assertions. These accepted commits
are foundations; they do not prove the later uncommitted original-preview change.