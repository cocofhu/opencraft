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
