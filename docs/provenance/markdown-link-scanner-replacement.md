# Markdown link scanner implementation boundary

## Explicit source selection

The [baseline](markdown-link-scanner-baseline.json) records the direct
source-identical annotation on `findMarkdownLink`, the exact historical file and
region digests, and actual author exposure. Only that function is selected.
The surrounding compiler, preprocessing, tokenizers, document model and resource
opening policy are not rewrite targets merely because they share a file.

## Requirements frozen before authoring

Keep the exported synchronous `findMarkdownLink(text, startIndex)` API and
`MarkdownLinkMatch` with start/end offsets, raw label and raw destination path.
Offsets remain JavaScript UTF-16 slice positions, with end exclusive. Existing
consumer `composerLinkTokenizer` retains unescaping and token construction; this
helper does not open a URL, read files, grant resource access or select a Host.

Preserve current accepted/rejected inputs and matching position under black-box
observations. Known existing tests require searching a prefixed link and rejecting
an empty destination, an incomplete destination and a multiline label. Freeze
additional delimiter, escape, malformed-input, search-offset and Unicode outputs
before implementation; do not infer a different Markdown standard and silently
change the application grammar. Raw response values are parser compatibility
requirements. No new tests or observation harness are committed.

## Initial checkpoint

This commit precedes implementation and expanded observations. Public interface,
consumer and existing tests were authoring inputs; old scanner expressions were
not printed in this bounded pass. This does not establish strict author isolation,
clear historical source rights or resolve other annotated compiler regions.
