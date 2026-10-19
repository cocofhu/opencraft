# Browser device toolbar: bounded replacement contract

## Selected declaration and retained owners

The [fixed baseline](browser-toolbar-baseline.json) records an explicit adaptation
annotation naming a recovered toolbar and numeric-input renderer, with compiler
caches and internationalization wrappers removed. Select only `BrowserDeviceToolbar`
and its local `DimensionInput`. Keep the preset compatibility data, imports,
shared style rules, `Edge` declaration and `BrowserDeviceHandles` implementation.
The latter is not selected because it shares a file. Its geometry helper has a
separate bounded disposition; its capture and gesture owner stays in place.

The actual browser panel supplies the current viewport mode, width/height update,
close-to-responsive action and optional Page zoom setter. The toolbar presents
those values; it does not own the Page, backing Host, dimensions preference,
authorization, persistence or a second viewport model.

## Requirements before implementation

- Preserve the exported props and retained preset IDs, labels, order and dimensions.
  These are application compatibility data, not verified hardware specifications.
- Preserve the existing compact toolbar, accessible dimension/zoom/close controls,
  licensed Lucide icons and current shared CSS slots in light/dark and narrow/wide
  layouts. Keep current dimension editing, bounds, reset/rotate/preset/zoom actions
  and focus/blur behavior, freezing actual observable outputs before authoring.
- Prop changes must update the projection without changing the caller's object or
  creating persistence writes. Input transactions, invalid/empty/decimal values,
  keyboard completion and cancellation will be observed through the actual component.
- Preserve `BrowserDeviceHandles` byte for byte, including the shared geometry
  helper, capture/resize/disposal behavior. No neighboring Host, registry, preset
  catalog, protocol name or integration removal. No committed new tests or harness.

## Evidence method and author exposure

Author from the selected declarations, existing panel/CSS/public preset contract,
existing tests and frozen opaque observations of the actual component. The old
selected function bodies are not being read as authoring text. The initial bounded
reference search did expose JSX lines containing the toolbar container/label,
dimensions group, optional zoom selector, close button and numeric-input opening,
as well as the short custom-mode update at the start of the function. The header,
imports and compatibility labels were read. Prior session context includes other
recovered modules. Record this actual exposure; do not claim strict author isolation
or clearance of historical rights. The eight unresolved groups remain inventory,
and this record does not classify the untouched handles or adjacent files.

## Current checkpoint

This commit freezes scope and observable requirements only. Both selected functions
and the surrounding source remain unchanged. SSR, interaction and actual browser
baselines must be completed and committed as requirements before implementation.


## Frozen initial component observations

Before implementation, the actual component produced 136 complete static markup
outputs across all 13 preset entries, unknown and fit modes, zero/out-of-bound
dimensions, four zoom values and supported/unsupported zoom. Rendering invoked no
action callbacks and did not mutate any supplied mode object. First SSR setup
failed because the observer omitted the classic JSX React binding; the external
observer supplied that binding and passed without changing product code.

Actual Chromium with the original app stylesheet and licensed Lucide icons records
four scenes (390/1100 widths, light/dark), each with 16 complete checkpoints.
They include preset selection, decimal live input, Enter, minimum/maximum and empty
blur, Escape, rotation, zoom, external props while editing, another preset, close,
unsupported zoom and disposal. Full rendered DOM, input values, focus, callbacks,
props and control geometry are retained. All scenes have no page errors; the narrow
dark screenshot was viewed. Narrow hidden zoom was exercised by a programmatic
select event, not described as a visible narrow control. The controlled parent
acknowledges callbacks; this is not a complete panel, Page service or native guest.

Observed input semantics are live updates: valid edit changes the caller's mode
while retaining its raw input text during focus. Enter/blur may submit the current
value again; Escape does not undo an already acknowledged live update. Empty blur
restores the prop without issuing a mode action. Preset selection also resets zoom
to 100 when supported; rotation exchanges current dimensions and selects the
custom/responsive preset. These observations supersede a speculative transaction
cancellation interpretation in the initial plan; retain caller identity and the
actual outputs rather than inventing a new interaction contract. The full result
hashes are locked in the baseline. Supplemental boundaries may be frozen before
authoring; no implementation is changed in this checkpoint.


## Supplemental boundaries frozen before authoring

A further 258 actual Chromium cases run before implementation: 96 dimension
cases (both fields, 12 raw numeric/empty inputs, live/blur/Enter/Escape endings),
156 preset cases (six initial device/fit/unknown/custom/out-of-bound modes, all
13 options, zoom supported/absent), and six rotations. Each case mounts a fresh
component with a controlled parent. Complete props, callback order, raw input
values/validity, focus and bubbled keyboard default-prevention are retained.
There are no page errors. These are a finite compatibility baseline, not an
exhaustive branch claim or a new authorization/validation owner. The selected
source remains at its original hash; no implementation has yet been authored.
