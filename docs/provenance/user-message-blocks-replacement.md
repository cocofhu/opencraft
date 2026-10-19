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
