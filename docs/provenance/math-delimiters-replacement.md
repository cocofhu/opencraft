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

## Implementation findings

The first replacement missed display closure line-tail admission and produced
106 differences: 58 tokenizer observations and 48 full compiler trees. The original
corpus and first failed replacement remain external evidence. Another 42 sealed
historical tokenizer calls clarified the rule: after the first closing delimiter,
spaces/tabs may precede LF or end-of-source; other content, CR/CRLF and Unicode
line separators reject the candidate. Horizontal whitespace is not consumed in
`raw`. Later closures do not rescue an invalid first closure. This refines the
pre-authoring contract; the original observations were not rewritten.

The replacement expresses block-start eligibility and inline delimiter admission
with explicit forward scans, retaining the existing extension registration and
compiler owners. All 8,925 frozen tokenizer inputs, 1,440 public compiler outputs
and 42 focused closure-tail cases now match exactly. Non-target compiler prefix
and suffix bytes remain identical; historical region SHA256 is
`b516965509b684b82e8c8c5f9fed3d2a5af823f140c91369489d56af822c2ab9`.
No new tests or observer harness are committed. This is current implementation
provenance, not strict author isolation or historical-rights clearance.

The document typecheck, platform boundaries, 35 existing document/cache/resource
preview tests and ten existing provenance tests passed. Public Web built with
791 runtime source files and zero compatibility issues. The existing JSDOM
link-to-resource flow is included; no employee/native session, physical device
or real-model invocation is claimed. Inventory validation retains eight unresolved
groups and does not establish release readiness.
