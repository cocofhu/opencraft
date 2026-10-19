# Floating sidebar presentation boundary

Only `FloatingLeftPanel` and `FloatingLeftPanelContent` are selected because the
module explicitly declares restored structure and motion. The
[baseline](floating-sidebar-baseline.json) retains historical module/declaration
hashes, original annotation and actual author exposure. No recovered reference or
selected component body was printed during this bounded authoring pass.

## Requirements before implementation

Keep all public props and consumer imports. Shell owns visibility, width,
mobile progress, content/navigation and resize intent; this container projects
those values without introducing a second owner. Header, body and footer remain
slots. Presence may retain exit content, but exiting content must be inert with
pointer interaction disabled. Exit completion delegates to the Shell callback.
Ordinary resizing must retain live geometry and callback ownership; cancellation
must not become an accidental width commit. Content, input state, focus and
selection must survive ordinary prop changes and interrupted exits when the
existing owner remains mounted. Reduced motion and optional mobile progress
must retain their actual existing behavior.

Freeze real component observations for visible/hidden/exit/reversal, unified and
legacy layout, multiple widths and mobile progress, reduced motion, absent footer
and optional bounds. Keep existing Shell/sidebar interaction checks. Observe
held pointer movement and cancellation as well as settled layouts. Do not infer
new geometry from reference pixels or rewrite neighboring Shell/resize/motion
logic. The spring's ordinary numeric data is not a rewrite target.

No implementation changes exist at this checkpoint. Prior actual source exposure
remains recorded; neither behavior matching nor this document establishes strict
author isolation, historical rights, real employee/remote resources or native
hardware acceptance. Eight unresolved groups remain. No repository tests or
observation harness will be added.
