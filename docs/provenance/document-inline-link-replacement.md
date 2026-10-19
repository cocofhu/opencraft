# Inline link node construction boundary

## Explicit selection

Only the `link` case inside `mapInlineTokens` in the document compiler is
selected, because its historical annotation explicitly declares source-equivalent
construction. The [baseline](document-inline-link-baseline.json) records the old
module/case hashes, exact scope, annotation and actual author exposure. The rest
of the compiler, preprocessing, inline token mapping, streaming identity,
classification, sanitization and resource opening implementations remain outside
this replacement. Behavior-only references do not mandate rewriting them.

## Requirements frozen before authoring

Preserve the synchronous public `ChatDocumentCompiler.compile` API, both existing
message dialects, streaming mode, source ranges, node kinds, href/title values,
inline nesting and raw output ordering. Labels preserve Markdown structure while
suppressing interactive text decorations (`$skill`, workspace references and color
swatches), including nested formatting. Existing tests explicitly require the
plain label `$skill @repo/src #AABBCC`. Node construction must not authorize or
open a URL, read a file or select a Host. Existing renderer policy remains the
owner of those actions; document caches and stream identities keep their owners.

Freeze complete compiler outputs for formatted/nested/escaped labels, malformed
and partial inputs, title/target variations, blocks, UTF-16 source positions and
both dialects before implementing. Keep original observers and inputs when a
candidate differs. Observe the actual Web renderer and retain the existing
resource-flow checks; do not add repository tests or an observation harness.

This requirements commit precedes the replacement. Selected historical expression
and recovered reference bodies were not printed in this bounded pass, but earlier
exposure remains recorded; this is not strict author isolation or historical-rights
clearance. Eight unresolved inventory groups remain open.

## Frozen observations before implementation

The unchanged compiler produced 5,788 complete public compile observations
and six every-prefix streaming sessions, including committed snapshots and repeat
cache identity. Raw output SHA256: `42cda1de84394157963b3ffef970fa27063f647132ec46ea43fa52779fd5aec7`.
A sealed execution of the unchanged private mapping port adds 560
label/title/child-token/offset/decorate combinations; its implementation was
executed without printing the body. Raw output SHA256: `b777b7b0e64930ab7766b2db6ee9e46fddccfb65f3b1c0e5f31cb7e590efc714`.
Empty or non-string label text falls back to an empty text child, while an
explicit empty title remains an empty string and a non-string title becomes null.
Label child ranges retain their existing link-start origin rather than a new
Markdown-source interpretation. Nested formatting/images remain typed children;
only text decorations are disabled. No grammar or source-range correction is part
of this replacement.

The 35 existing document/cache/resource-flow tests passed before authoring.
The existing actual Web URL smoke passed heading preservation, sanitized target,
favicon/tooltip, ordinary/modifier/context-menu intent, clipboard and the 500ms
streaming activation guard. Its baseline screenshot was inspected. It uses
synthetic targets/ports and does not establish employee, remote Host or native
hardware acceptance. No selected implementation changes exist at this freeze.

## Current replacement and completed checks

The new branch separates label projection from the typed link node assembly.
It consumes only the existing token fields and shared base/text/token/mapping
ports. It never opens or sanitizes a resource. No neighboring helper is rewritten.
The old annotation remains in the baseline rather than being silently erased.
The final module SHA256 is `b233ea7a64ce61abaec035d4ef5607e508b4afe968d7d201694255a53880a523`;
the replacement-case SHA256 is `589786c4eeea3d546935a36d92e9e215c58e4b9c18fb9fac86625e0b4864eb47`.
Prefix and suffix hashes prove every compiler byte outside the selected case
unchanged. Both complete raw observation files match their frozen baselines on
the first candidate; no observer input or assertion was changed after authoring.

All 45 existing document/cache/resource-flow/provenance tests and the document
typecheck pass. The existing actual Web URL smoke passes its unchanged assertions
for heading structure, target safety/intent, context actions and streaming guard.
Before/after screenshots were inspected; tooltip timing differs between captures,
so this is not a pixel-identical screenshot claim. The browser uses synthetic
resources and ports, without employee login, real remote actions or native-device
acceptance. Platform boundary and official Web build results are recorded below
when terminal; no new repository tests or harness are introduced.

This is a partial compiler implementation disposition. Eight inventory groups,
other annotated regions, historical rights and strict author isolation remain
unresolved. No licensing or release-readiness conclusion follows from matching
finite behavior outputs.

Platform boundaries passed. The official public Web build completed with 791
runtime source files and zero browser compatibility issues. Final source-inventory
validation reports no errors and keeps eight unresolved groups/releaseReady=false;
ten existing provenance checks pass after the inventory update. Original source
records and notices remain in history and the bounded baseline.
