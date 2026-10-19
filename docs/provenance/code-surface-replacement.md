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

## Implementation and compatibility refinements

Frozen requirements commit: `cca79570792c010cef4a7e486353617b7c4dd53f`.
Implementation commit: `aa160af4cc225db191f9a3110383d7888781dda5`.
The requirements commit is verified as an ancestor of implementation.

The replacement uses a closure-owned boolean and observer membership, a lexical
opening-tag/name delimiter check, a single derived surface decision and a separate
Map of canonical language names. It adds no platform imports or renderer state.
All four runtime exports and all public types remain available. The author did
not open the rest of the old target bodies or an external recovered renderer for
this replacement; the accidental policy-prefix exposure above remains a limit.

Black-box refinements preserved C++/C#, R, Perl, Lua, Diff, Makefile, GraphQL,
Visual Basic .NET, Objective-C and WebAssembly display aliases. Their conventional
labels are behavior observations, not copied implementation/table text. The first
finite matrix exposed 46 label differences; expanding to installed Shiki public
language/alias names exposed eight additional wasm display differences. Both
failed development comparisons were corrected before final acceptance.

## Verification and limits

- An untracked deterministic black-box harness performs **320,757 comparisons**
  of old/new labels, SVG recognition, policy combinations and preference
  subscription operations, with zero final differences. Inputs include public
  Shiki language/alias names, case/whitespace variants, unknown/prototype-shaped
  labels, SVG delimiters/prefixes, default/preview variants and forceWrap values.
  The count includes repeated equivalent inputs; it is finite compatibility
  evidence, not exhaustive equivalence or source-rights proof.
- **23 renderer tests** pass, including two added contract checks for duplicate
  observer membership/idempotent writes and explicit SVG/policy precedence.
  All **10 provenance tests** pass.
- Shared React, Web and Native renderer package typechecks pass, as does
  `npm run check:boundaries` including typography/activity ownership.
- An untracked Chromium probe renders the actual `CodeBlockSurface` in four
  width/theme cases (390/1100, light/dark; touch emulation at 390). It checks
  shared sibling wrap actions, computed pre/pre-wrap styles and increased wrapped
  text height, forced/preview/SVG precedence, snapshot restoration on a sibling
  remount, code DOM retention through text update, edited draft retention,
  language labels, copy-button state and absence of page overflow/errors.
  Clipboard writing alone is a synthetic boundary capturing exact code text;
  actual OS clipboard permission/contents are not claimed. Both the initial
  control probe and the stronger layout-measurement rerun pass all four cases.
- Narrow dark wrapped/unwrapped and wide light screenshots were visually
  inspected. These are real Web component probes, not native iPhone/Electron,
  live model/account or full application/release acceptance. The local probes
  are not committed as new CI scripts.
- The current inventory check reports no uncovered known annotations. The
  renderer-expression group retains **six** unresolved paths and the three
  separately recorded dispositions; all **nine** unresolved groups remain open.
  No historical notice or source hash was removed, and no dependency or consuming
  renderer is reclassified by this shared-model disposition.

The source scanner and successful tests do not establish all source origins,
distribution rights or strict clean-room isolation. SVG recognition is display
policy only; the existing renderer still owns preview construction and safety.
