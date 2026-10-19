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


## Completed pre-authoring grammar observations

The external corpus contains 40,866 structured/malformed string-and-offset cases
and 24 edge-offset cases. Empty labels or destinations do not match. Label
contents end at the first unescaped closing bracket, which must be immediately
followed by an opening parenthesis. Destination contents end at the first
unescaped closing parenthesis; inner opening parentheses are raw characters,
not a balanced-parenthesis grammar. Backslash pairs preserve raw text while
shielding delimiters. CR/LF invalidate a candidate, including an escaped CR/LF;
spaces, title-like text, angle brackets, NUL and Unicode line separators are
raw application data. Search may continue to a later valid bracket candidate.
Escaped prefixes and image punctuation do not alter the scanner's start offset;
the caller retains their interpretation.

Search offsets use UTF-16 positions. Negative offsets search from zero, fractional
finite offsets truncate, NaN/positive infinity do not match, and negative infinity
searches from zero. These observed compatibility details do not establish a new
Markdown standard. The frozen external observation SHA256 is `3b9e1dfcf60cdcc71e073a5896ff343757c9f18f915dc5fe71051d988d7c6d37`.
The implementation is still unchanged at this requirements checkpoint.
