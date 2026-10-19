# User-message block normalization boundary

Only `preprocessUserMessageMarkdown` carries the selected direct source-equivalent
annotation. Preserve its synchronous string API and existing user-message dialect:
adjacent paragraph text must not be swallowed into a preceding list, switching
between bullet and ordered lists begins another block, and fenced content retains
its current byte behavior. Helpers, general preprocessing, compiler projection and
streaming identity are outside this replacement boundary.

Freeze actual input/output and public compiler observations before authoring.
Preserve newline, whitespace, malformed fence and streaming compatibility rather
than assuming a different Markdown dialect. This requirements checkpoint leaves
the target implementation unchanged. The baseline records exact history and
actual exposure; no strict author isolation or historical-rights clearance is
claimed. No new repository tests or observer harness are planned. Other regions
and all eight unresolved groups remain open.

## Observations frozen before authoring

8,391 public normalization inputs and 580 actual user-message compiler trees are
frozen with SHA256 `1d8d39cdc294b9ede7bcc34fccdb749c87a4a4ae0ed693d35b625d76293f4b22`.
CR and CRLF normalize to LF globally, including fenced lines; the prior annotation's
byte-preservation description applies only after that normalization. Empty/trailing
lines and other content otherwise keep their observed output.

A list followed by unindented non-list prose, or a different recognized list kind,
gets a separating blank line. Indented continuation retains active list context;
blank lines reset it. Bullet marker changes retain the same list kind. Fences
are compatibility markers rather than a new Markdown grammar: repeated marker
length and trailing closing text use existing admission. Preserve the exact
recorded behavior rather than silently fixing it during source replacement.
The function is still unchanged at this observation checkpoint; all helpers
remain outside the selected region.

## Implementation findings and actual exposure

The first independent line-state replacement produced 79 differences (77 strings,
two compiler trees): a list context survives an indented fence. Keeping that context
left one difference: a line containing only ASCII indentation is a continuation;
only a zero-length line resets context. The frozen corpus was retained, and another
102 focused historical observations covered whitespace and continuation boundaries.
All 8,391 strings, 580 compiler trees and 102 focused cases now match exactly.

The first focused extractor omitted historical regex constants and failed with
`ReferenceError: userMessageFence is not defined`. Its diagnostic exposed a
historical source line and encoded emitted function content after the initial
replacement and comparisons. This expands actual author exposure; the failure is
retained externally. The corrected observer executes the complete historical pure
module. This work does not establish strict author isolation or historical rights.
No new tests or observation harness are committed. The current implementation
preserves newline normalization and existing list/fence semantics; private helpers
and all other preprocessing bytes remain unchanged.

The document typecheck, platform boundaries and 45 existing document/cache/resource
and provenance tests passed. Public Web built with 791 runtime source files and
zero compatibility issues. Existing JSDOM resource flow is included; the compiler
trees establish the selected normalization boundary, not a native/employee device
or real-model session. Other regions and eight unresolved groups remain open.
