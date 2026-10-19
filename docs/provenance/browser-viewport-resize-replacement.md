# Browser viewport drag geometry: bounded replacement

## Scope and evidence

The [fixed baseline](browser-viewport-resize-baseline.json) records an explicit
claim that function bodies were taken from a named recovery reference. Only
`apps/workbench-web/src/browser/codex/viewport-resize.js` is selected here.
The device toolbar, preset dimensions, browser manager, transition state machine
and other modules are not selected merely because they share the directory.
A behavioral reference or a package-level inventory entry does not establish
that a whole module needs replacement. Keep usable integrations and history.

## Requirements frozen before authoring

- Preserve the existing `computeDragResizeDimensions` declaration and consumer:
  a pure computation returns width/height and never mutates the drag snapshot.
- Preserve all five exposed handles: left, right, bottom, bottom-left and
  bottom-right. Horizontal movement acts on a centered viewport; vertical
  movement acts on its bottom edge. Convert physical pointer displacement into
  viewport dimensions using the scale captured at pointer down.
- Preserve observed size bounds, fit-area limits, rounding and unchanged-axis
  behavior, including shrinking/growing/reversing from the same drag origin.
  Document these through black-box calls before authoring, not by printing the
  old implementation. The consumer owns capture, cancel, keyboard, persistence
  and valid-positive-scale admission; the helper must not acquire those owners.
- Keep current presets, labels, UI appearance and all browser/Host/session
  capabilities. Do not rename protocol integrations or expand to unannotated
  files. No new committed tests or harness; reuse existing consumer checks.

## Method and limits

Author from the public declaration, the existing toolbar's use and frozen
black-box observations of the OpenCraft baseline. Read only the target header
and exported declaration, not its function body as authoring text. The longer
session has exposure to other recovered modules, so this is not strict author
isolation, historical rights clearance or a determination about untouched code.
The existing browser group stays unverified until its other actual regions
are reviewed. Implementation and validation evidence will be added separately.


## Pre-authoring observations

The fixed module was called through its public export for 1,371 recorded inputs
before replacement authoring. The finite sample set covers all exposed handles,
unknown edge names, positive fit scales, zero/tiny fit regions, fractional
pointer motion and fit limits, growth and reversal. Additional out-of-contract
zero/negative scale calls are recorded without treating them as UI support.
Only outputs and input immutability were inspected, not the old function body.

Observed geometry uses two units of width change for each scaled horizontal
pointer unit because the viewport remains centered, and one unit vertically.
Left handles invert horizontal displacement. Bottom-only leaves width intact;
side-only leaves height intact. Changed axes round after bounding to minimum
240 by 160 and maximum 4096, additionally limited by positive available physical
space divided by captured scale; a nonpositive fit dimension adds no fit limit.
Unknown edges retain the historical right-side behavior, without adding new UI
handles. The consumer continues to own admission, capture and cancellation.
The baseline records exact artifact hashes; these finite calls are evidence,
not a universal equivalence proof or a rights determination.
