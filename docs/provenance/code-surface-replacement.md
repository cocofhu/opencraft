# Shared code-surface policy replacement

## Frozen requirements (2026-10-19)

1. Replace the complete shared model module, including the singleton word-wrap
   preference, SVG snippet predicate, display labels and wrap-policy projection.
   Keep public exports/types and both Web and Native consumers working.
2. Wrap preference starts false for the module lifetime, exposes a snapshot and
   synchronous subscriptions, supports set/toggle and suppresses redundant writes.
   Duplicate callback registrations share membership; unsubscribe removes it.
   Do not add persistence, platform state or a second renderer-specific owner.
3. Preview surfaces and recognized SVG snippets keep wrapping off even when
   forceWrap is true; other surfaces choose always for forceWrap and otherwise
   user-controlled. Preserve the requested/default surface variant.
4. SVG recognition requires an explicit normalized html/xml/svg language and an
   SVG opening tag at the start after leading whitespace. Keep the established
   delimiter behavior (whitespace or `>` after the name); do not reinterpret XML
   declarations, comments or unrelated markup as a preview. This is a display
   predicate, not HTML/XML validation or sanitization.
5. Display language names use the established common-language aliases, ignoring
   case and surrounding whitespace for lookup. Preserve the original unknown
   label. Missing/whitespace-only language is Code when closed, empty when open.
6. Preserve code-copy, scrolling, highlighted content, Markdown streaming and
   user-controlled wrap actions through existing renderers. Do not replace or
   classify their implementations through this shared-model change.
7. Retain historical source hashes/annotations, author exposure and requirements
   commit. Keep the rest of the renderer-expression group unverified.
8. Verify finite black-box inputs, shared renderer tests, affected Web/Native
   types, boundaries and actual Web code controls in light/dark and wide/narrow
   layouts. Distinguish these from native-device or external-model acceptance.

## Inputs and author exposure

Inputs are existing renderer tests, Web/Native consumer contracts, public AST
export/type/object-member declarations, and executable black-box observations of
the intact OpenCraft baseline. The previous module's source-faithful policy
annotation and exact baseline are retained in
[code-surface-baseline.json](code-surface-baseline.json). No recovered external
renderer, BB or Paseo implementation is used as authoring input for this module.

An initial AST signature-extraction script incorrectly mixed a trimmed node text
with an untrimmed source offset: it exposed the first conditional in
resolveCodeSurfacePolicy, showing preview/SVG precedence and a truncated return.
That exposure is recorded, not treated as isolation. The author also previously
viewed other recovery-related code and the old icon SVGs. No strict clean-room
isolation or historical source-rights clearance is claimed. The replacement will
be authored after this frozen requirements commit; validation will document actual
compatibility and any refinements.
