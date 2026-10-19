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
