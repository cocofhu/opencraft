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

## Complete pre-authoring component observations

Two real Chromium scenes (ordinary and reduced motion) contain 46 full DOM,
geometry, slot, input/focus, mount-count and callback snapshots. The frozen
raw SHA256 is `87cf30846428dcc6137b99d7d1d25703d4baa8b9948ac2571dcd31b744dd5156`.
The external observer SHA256 is `68d10eb00955ab99ba9762eba5634871bbe0da5bae40a61c28967dc1153a20b2`;
the comparison projection SHA256 is `5d4e2fe6e5d4da88d87f138eb4a8b1b4f4feeabd2620fe3af61248a5a7f143a5`.
The comparison retains complete structural DOM, attributes and CSS property
values, geometry, slots, draft/focus, mounts and callback order. Only attribute
and style declaration order is sorted. The explicitly in-progress exiting sample
excludes frame-dependent root/header translation and x coordinates, with the
full motion frame traces retained separately. No universal frame-timing or
pixel-identical screenshot claim follows. Comparator self-check passes; its
initial JSDOM non-iterable style access error was corrected before authoring and
retained, without any product change.

The floating root consumes the live width port. Four held-pointer changes and
direction reversals immediately update width, release reports its chosen width,
and cancellation restores the transaction's starting width. The existing resize
port implementation owns these rules and is not selected for replacement.
Normal-motion exits retain the subtree with inert/aria-hidden and disabled pointer
events, with equal-and-opposite header translation and approximately 8px exit
travel. Reversing that exit retains its mount and draft; focus already removed by
inert is not silently restored. A completed exit followed by a new opening gets
a new mount. Reduced motion may complete before the sampled reversal, so that
case legitimately remounts; the new implementation must preserve this distinction.

Mobile progress 0/0.5/1 projects scale 0.9/0.95/1 and opacity 0.45/0.725/1 in
ordinary motion; out-of-range progress clamps. Reduced motion retains full
scale/opacity while preserving the mobile projection surface. Existing spring
numbers, class names, slots, header counter-translation and resize-port ownership
are compatibility contracts, not claims to protected expression.

All 28 existing sidebar/control tests pass before authoring. The unchanged full
Shell smoke does **not** pass: after an initial 8-second navigation timeout, a
warmed run fails its docked footer comparison (right inset 12px versus computed
padding-right 0). This occurs before this replacement and outside the selected
component; no footer source or assertion was changed. Keep the failure and
recheck affected complete Shell flows during implementation verification.

Initial external observation import paths were wrong and then a React page error
appeared in a preliminary 26-state run. Both are retained as invalid baselines.
Absolute project imports, an isolated Vite cache and explicit React/Motion
prebundling yielded error-free 26-state, 42-state and final 46-state runs before
authoring. Screenshots of the final ordinary and reduced-motion component scenes
were inspected. Synthetic slot controls and browser emulation do not establish
full Workbench, real-account, remote or native hardware acceptance.

The two selected component bodies are still unchanged at this freeze.
