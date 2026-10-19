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

Implementation, dependency license evidence and actual validation will be added
following this requirements commit.
