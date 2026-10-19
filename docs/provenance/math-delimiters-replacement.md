# Application math delimiter tokenizer boundary

Only the directly source-attributed `mathBlockTokenizer` and
`mathInlineTokenizer` declarations are selected. The baseline records the exact
compiler blob, direct annotation and actual author exposure. Surrounding compiler,
preprocessing and streaming logic are not selected by directory membership.

## Requirements frozen before implementation

Preserve the current extension registration contracts, start hints and token
shapes, raw consumption and trimmed math source. Existing public compiler tests
require inline backslash-parentheses, display backslash-brackets, ordinary dollar
prose and untouched fenced source. Freeze additional delimiter/escape/malformed
observations and actual compiler trees before authoring. Current application
compatibility, rather than a newly assumed Markdown standard, is the requirement.

The current two declarations are still unchanged at this checkpoint. Prior narrow
search output showed several historical return expressions; no strict author
isolation or historical rights clearance is asserted. No new repository tests or
observation harness are planned. Other compiler regions and the eight unresolved
groups remain open.

## Frozen runtime observations

Before authoring, 8,925 tokenizer inputs and 1,440
full public compiler outputs were recorded. The observation SHA256 is
`2eefb0bafb5c098fa54d610359385dddfa48125bd9f00ad283021edce7e29fb6`. Both modes accept empty formula contents and trim
formula source while preserving the consumed raw text. Display delimiters are
`$$` and backslash-brackets; inline uses backslash-parentheses. Closures are
literal first matching pairs, without escape-parity or nesting interpretation.
Dollar prose and fenced/inline code retain their existing compiler interpretation.

The block start hint reports the preceding LF position or zero at the start,
allowing only spaces/tabs before the delimiter; it is not necessarily the actual
delimiter offset. Token creation still requires a delimiter at offset zero.
Inline start hints locate backslash-parentheses anywhere; token creation requires
offset zero and rejects LF before its first closure while allowing CR and Unicode
line separators. These are measured application contracts, not new Markdown rules.
The two historical tokenizer declarations remain unchanged at this checkpoint.
