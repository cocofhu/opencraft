# Licensed activity and new-task artwork replacement

## Frozen requirements (2026-10-19)

1. Replace the entire custom activity/resource glyph module and the recovered
   classic new-task glyph using the existing `lucide-react` dependency. Select
   artwork by task meaning, without tracing, transforming or copying old paths.
2. Keep all current activities recognizable: browser, stop, search, reading,
   files, patching, terminal and change review. Keep all existing tool and engine
   integration behavior; this replacement concerns artwork only.
3. New task uses the shared `start` icon in both standard and classic presentation.
   Keep its 16px action slot, decorative accessibility and owning control behavior.
4. Shared activity CSS owns glyph size/stroke and the 20px rail. Preserve summary
   typography, centered geometry, balanced painted size and reading-preference
   independence. Recalibrate for licensed artwork rather than force old contours.
5. Forward SVG consumer properties, CSS classes and accessibility labels. Preserve
   compatibility data attributes used by current metrics/disclosure consumers.
6. Remove the duplicate recovered new-task SVG from its reference test fixture.
   Update the corresponding test to the semantic action/accessibility contract;
   do not require geometry identity with the removed artwork.
7. Retain exact baseline blobs/hashes and previous source annotations in provenance
   records. Keep the other seven renderer-expression candidates unverified and
   do not classify unrelated navigation/toggle reference artwork as resolved.
8. Verify affected unit tests, Web types, boundaries and real browser rendering
   across presentation styles, themes and screen widths. Exercise activity
   disclosure, stable owning controls and the full shared activity metrics corpus.

## Authoring boundary

This is substitution of identified SVG resources with an existing licensed icon
library, not a claim of independent creation of Lucide artwork or strict clean-room
isolation. Before these requirements the author viewed both complete old modules,
the duplicate fixture function and their consumers/tests. Earlier recovery-related
exposure is also known. Historical source comments identified source-faithful Write
artwork, a Codex 26.930 resource-card glyph and source-shaped recovered activity
glyphs. Their exact baseline records are retained in
[activity-icon-baseline.json](activity-icon-baseline.json), alongside the existing
[annotation inventory](annotation-coverage-20261019.json). Removing these current
paths does not establish rights in history or any other artwork.

## Implementation and license evidence

Requirements commit: `b53a8fb57193c8a094679b29031fdcdefc83db3d`.

The new `activity-glyphs.tsx` selects FileDiff, Globe2, Square, Search, BookOpen,
Folder, Pencil and TerminalSquare. `NewTaskIcon` delegates to the existing
Workbench `start` semantic icon in both presentation styles. Current consumers
use semantic export names; compatibility data attributes remain because current
CSS/probes consume them. No historical path strings are transferred to the new
module. The duplicate `ReferenceNewTaskIcon` function is removed entirely; other
reference fixture functions remain outside this disposition.

The existing locked dependency is `lucide-react` **1.58.0**. Its installed full
LICENSE is copied byte-for-byte to [vendor/lucide/LICENSE](../../vendor/lucide/LICENSE)
and indexed by root NOTICE. It contains the ISC notice for Lucide and the full
Feather-derived MIT notice, including Search and Square. The retained license
SHA256 is `b495047bd93a9b06913511076f504daba17d5bbeb3e0650f3bb53a4220329c57`.
This statement concerns the package's supplied notices, not a new legal review
of every contributor or unrelated icon/resource.

The shared activity CSS removes custom recovered-contour sizing. BookOpen, Pencil and Folder join
the calibrated 18px Lucide group; Globe2 already resolves to the licensed Earth
class in that group. Other activity replacements use the normal 20px canvas. The rail
remains 20px; actual painted size, effective stroke and disclosure behavior are
verified below rather than assumed from nominal SVG width.

## Verification

- 28 focused tests pass: product/navigation icons, activity visual ownership,
  source-provenance and change-review contracts.
- Web typecheck and `npm run check:boundaries` pass, including typography and
  activity ownership checks. The source inventory check has no errors; all nine
  unresolved groups remain open. The renderer-expression group now contains
  seven remaining paths, with both artwork dispositions retained separately.
- The unchanged `scripts/smoke-icons.ts` passes both presentation styles,
  light/dark and DPR 1/2, including real navigation selection/toggle geometry.
- The unchanged `scripts/smoke-conversation-activity-metrics.ts` passes all eight
  cases: widths 390/1024, DPR 1/2 and light/dark. It measures the actual full
  renderer corpus, painted silhouette, effective stroke, centering, label gaps,
  compaction/collaboration typography, disclosure and reading-size independence.
- The unchanged `scripts/smoke-activity-disclosure.ts` passes all four light/dark
  mouse/touch cases: chronological steering, prose DOM continuity, fold eligibility,
  explicit choice, streaming and reload.
- An untracked local probe reuses the turn-diff fixture with the actual completed
  `TurnDiffBlock` and a synthetic review callback. All four width 390/1280 and
  light/dark cases show the licensed FileDiff at 24px; clicking invokes review
  before and after a count update while preserving the owning button DOM.
- Visually inspected narrow dark activity gallery, narrow light change resource
  and classic dark icon gallery. No page errors in the successful browser runs.
  These are real Web component probes, not native Electron/iPhone, live engine,
  external account or release acceptance. No normal browser assertions were
  weakened and no new tracked browser test script was added.
- Exact representative old path strings and old module/component imports have no
  remaining match in executable apps/packages/tests/scripts. Historical hashes,
  annotations in records, and unrelated notices remain. This finite search is
  not an exhaustive origin detector for the rest of the repository.

Development failures: the first metrics probe was started
before all imports were migrated and encountered an unresolved old-module import;
that development run is not counted as a pass. The remaining interaction consumer
was then migrated along with the activity and change-review consumers.

A later fixed-import metrics run correctly rejected Pencil's 16.67px painted
width at the shared 14px summary font. Measurements also showed the same issue
for Folder. Both were calibrated through the shared CSS owner to a 15px painted
width with 1.2px effective stroke; the final full eight-case metrics run passes.
These failed development runs are retained in the execution evidence, not counted
as acceptance. The historical source status of other glyphs and fixtures is not
resolved by these checks.
