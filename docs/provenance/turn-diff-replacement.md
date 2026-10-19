# Turn diff summary replacement

## Requirements fixed before implementation

Replace the complete `packages/chat-core/src/turn-diff.ts` module. At baseline
`c4d9915` its Git blob is `96c4954432fafbf0675c2ee1d66e20197f7c0291`, SHA256
`bf53cea7bc6a88d51519668276931ac76712f75cf4ca5029f362a99c555db644`.
The prior aggregate has a source-equivalent annotation; preserve that historical
source and evidence, rather than presenting a removed annotation as clearance.

Authoring inputs: exported signatures and data types, existing TurnDiff tests,
projection/review consumers and black-box OpenCraft observations. Extracting the
multiline createTurnChangeSummary signature exposed its initial null/blank guard;
no other old implementation body or recovered Desktop/BB/Paseo implementation
was read for this replacement. Other recovery-related code was inspected earlier
in the conversation. This is requirements-driven independent implementation,
not strict clean-room separation or clearance of historical rights.

1. Preserve `summarizeTurnDiff(string)` and `createTurnChangeSummary(turnId,
   status, string | null)` with their existing public output types.
2. Identify files from Git `diff --git` headers, using the destination path;
   support quoted paths containing spaces. Plain unified headers without a Git
   file header and arbitrary prose do not introduce a file. Binary-only Git
   sections retain a zero-count file. Paths are presentation data, not authority
   to read or write a filesystem.
3. Merge repeated Git sections for the same destination while preserving first
   appearance order. Count plus/minus lines belonging to the active section,
   excluding `+++`/`---` header-prefix lines. Preserve compatibility with partial
   streams that have no hunk header yet. Rename/delete metadata does not replace
   the Git header's destination identity.
4. Return per-file and aggregate addition/deletion counts, including zero-count
   files. Empty/prose input gives an empty summary; a nonblank prose string may
   still be retained as a raw Turn change summary.
5. A null or whitespace-only diff gives no Turn card. Otherwise preserve raw
   unifiedDiff, id `<turnId>:turn-diff`, empty sourceItemIds and type `turn-diff`.
   Pending/streaming map to running, complete to complete, failed/interrupted to
   their corresponding execution status.
6. Remain renderer-neutral and keep the dedicated Turn resource distinct from
   live patch Activity. Validate selected-file review and the real change-card
   component, with synthetic input clearly distinguished from a live engine.

Requirements were committed as `526dbde` before implementation (`09fdd6a`).

## Implementation and compatibility observations

The replacement uses a file-section iterator and an insertion-ordered map of
per-path counters. Git headers supply identity; additions/deletions are derived
from the active section. It does not import recovered code or retain the prior
module's implementation body.

A 160-case black-box matrix covered eight header variants, LF/CRLF, five content
bodies and repeated sections. Initial discrepancies corrected two presentation
requirements: trailing whitespace makes a Git header invalid, and quoted paths
retain wire escapes such as `\\t` and octal sequences while unescaping only quotes
and backslashes. These are observed OpenCraft compatibility requirements; no old
parser/helper implementation was inspected to make these corrections. The final
matrix matched all 160 cases.

Validation of the implementation:

- `node --import tsx --test tests/chat-turn-diff-summary.test.ts tests/chat-core.test.ts tests/workbench-turn-diff-review.test.ts`: 113 passed.
- `npm run typecheck --workspace @opencraft/chat-core` and `npm run check:boundaries`: passed.
- A local Playwright probe of the existing change-card fixture passed at 390px
  and 1000px in light and dark themes. It exercised expansion, binary zero counts,
  selected-file review, streaming counts with stable DOM identity, removal and
  remount, with no page errors. This used synthetic data in the real component,
  not a live model or authenticated engine session. The 390px light screenshot
  was also visually inspected.
- The existing full `scripts/smoke-codex-change-card.ts` fails its header-height
  assertion (68px observed against the script's 64–66px expectation). The same
  assertion fails on the unchanged parser baseline after PR #99. This replacement
  changes no CSS and does not weaken that assertion. The targeted semantic
  browser checks passed; complete visual-smoke clearance is **not** claimed.

Historical source remains available by the recorded blob and in Git history.
This disposition applies only to the complete current turn-diff summary module,
not the renderer, other chat semantics, historical commits or legal rights.

After integrating the hook-statistics and scanner follow-ups, the combined turn-diff,
chat-core, review, hook, skill-path and provenance suite passed 132 tests. The
inventory has no structural errors, and all eight unresolved groups remain.
