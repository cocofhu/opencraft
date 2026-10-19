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

## Supplemental pre-authoring motion and resize ports

An unchanged-component entry trace starts ordinary desktop presentation at -8px
with opacity zero and the header at +8px, then settles at zero/opaque. Reduced
motion starts fully visible. Exit translation retains opacity one. An additional
18-state real-component observation verifies below-minimum held width clamps to
240px and commits 240 rather than collapse/null, keyboard Home/End consume the
existing width bounds, and double-click restores 275px. Mobile exit does not add
a horizontal or depth animation: it keeps the externally supplied depth until
removal, with immediate inertness. Both ordinary/reduced modes have zero page
errors. Hashes and full traces were frozen before authoring; no selected bodies
changed during either supplement. The original 46-state comparison remains fixed.

## Independent replacement and first verification

After the requirements, 46-state complete observation freeze and supplemental
entry/18-state resize/mobile freeze were committed, both selected components were
independently authored. Public import/interface bytes are identical. The Shell
still owns visibility, live width, mobile progress and content identity. The
existing resize handle retains transactions; the wrapper only opts out of
collapse, as the below-minimum baseline requires. The container owns presence
projection and header counter-translation, with no copied reference body, new
dependency, second width/progress owner or business-state policy. The historical
header is replaced by this record's link; its original text and hashes remain in
the committed baseline.

The first candidate matches all 46 primary and 18 supplemental complete raw
states byte-for-byte, including full DOM/style, slot geometry, drafts, focus,
mount counts and callback order. The fixed pre-authoring structural comparator
also reports zero differences. Ordinary/reduced exit frames retain immediate
inertness and disabled input, equal-and-opposite header translation and removal;
individual animation sample timing is not claimed byte-identical. Synthetic
component screenshots in both modes were inspected. All 56 existing focused
sidebar/control/Shell-geometry tests, Web typecheck, platform boundaries and
official Web build pass (791 runtime sources, zero browser compatibility issues).
The unchanged full Shell footer smoke failure remains an explicit limitation;
supplemental full-Shell checks, if completed, are separate evidence and must not
be represented as that original smoke passing.

## Corrected first-frame initialization and final evidence

The first candidate's settled observations matched, but the extra entry trace
found that its header counter-translation appeared one frame late. Initializing
the horizontal MotionValue from the same desktop entrance geometry fixes that
first frame. The observer and expected contracts were not changed. Final entry
traces begin with surface -8px/header +8px/opacity zero in ordinary motion and
zero/full opacity in reduced motion. Every sampled entry/exit frame preserves
counter-translation and exiting input withdrawal. Timing/sample counts vary and
are not claimed byte-identical. The corrected candidate still has zero differences
under the fixed 46-state structural projection; its full raw output differs only
in the explicitly frame-dependent exit translation/x fields. All 18 supplemental
resize/mobile states remain byte-identical to their frozen baseline.

A supplemental actual AppShell observer, authored after the first implementation,
executes the historical component through a sealed hash-checked Vite load hook
and then the corrected component. All 22 complete ordinary/reduced legacy Shell
states match byte-for-byte, including held resizing/reversals/cancellation,
re-docking, narrow open/close, content identity, drafts, scroll and mount counts.
Both component modes and representative full Shell screenshots were inspected.
This uses synthetic slots and does not exercise employee accounts or remote Hosts.

Initial supplemental attempts incorrectly used unified desktop edge-hover, which
the current unchanged Shell explicitly disables. That failure was retained; the
legacy hover observer and current mobile trigger are used for their actual
owning paths. The legacy baseline also loses its 500px list scroll offset in
reduced-motion reparenting. Its failed scroll expectation remains recorded; the
final supplemental comparison retains the complete scroll field and verifies the
candidate has the same behavior. This is not a passing assertion of scroll
preservation. No product owner, footer, smoke script or assertion was modified.

All 56 existing focused tests and ten provenance tests pass. Final Web typecheck
and official build pass (791 runtime sources, zero compatibility issues). Original
full Shell footer smoke remains failed. The separate existing mobile stack smoke
fails while reading a missing backdrop element; historical-component reproduction
is tracked separately and must not be counted as passed. These known failures do
not justify expanding this source replacement into unrelated Shell/style work.

## Coverage correction before the mobile wash implementation

The initial 46-state observer serialized the selected panel root, not every
sibling rendered by the component. The existing full mobile stack smoke caught
a real omission in the first replacement: the stationary wash sibling was absent.
The same unchanged smoke with a hash-checked historical-component Vite loader
passes. Its live transformed-module source map was checked against the historical
module SHA256, proving that reproduction actually loaded the old component. This
is a replacement regression, not an existing Shell failure. Neither the mobile
script nor its assertions were weakened.

Before correcting the missing sibling, a separate 20-state ordinary/reduced
observer executes the hash-checked historical module and captures the complete
fixture root including siblings. It observes a sibling div after the panel,
aria-hidden=true, class app-shell-mobile-sidebar-wash. Ordinary progress
0/0.25/0.5/0.75/1 maps its opacity to 0.65/0.4875/0.325/0.1625/0, with clamping.
Reduced motion keeps the sibling but sets opacity zero. It mounts only for
mobile presentation and disappears with that presence. The existing Shell CSS
owns stationary material/placement/hit-testing. These supplemental requirements
were recorded after the first replacement and before the missing-wash correction;
they must not be described as part of the initial pre-authoring freeze.

## Final wash correction and complete mobile verification

The stationary sibling is independently implemented from the supplemental DOM,
progress/opacity and lifetime observations, retaining existing Shell CSS and the
same progress port. The full 20-state fixture-root comparison has zero differences
after sorting only attribute/style declaration order; wash DOM/computed opacity,
geometry and pointer behavior match exactly. The frozen 46-state panel projection
also remains at zero differences after this correction. Both initial regressions
(first-frame header offset and omitted wash) remain documented; neither is called
a pre-existing product failure.

The unchanged existing mobile stack smoke now passes all twelve combinations of
light/dark, ordinary/reduced motion and widths 320/390/430, as it does with the
historical component. Its 36 evidence entries include held reversal/cancellation,
stationary safe-area material, progress/depth/wash, search, Escape, reopen and
underlying draft/input ownership. Representative old/new dark held frames and
the new reduced-motion light scene were inspected. This is real browser/React/
Shell input and rendering with synthetic data, not employee/native hardware
acceptance. Final Web build passes 791 runtime sources/zero compatibility issues;
56 focused tests and Web types pass. The original footer smoke and historical
reduced-motion legacy scroll reset remain limitations, not newly passing checks.

Final module SHA256: `7350e652e9c6c2fa82649e0bcb6c0b40693ebb453f7d90e61a7e1d695b00e506`. No repository tests/harness,
dependencies, Shell/resize/style/spring implementations or integrations changed.
Historical source records and all eight unresolved groups remain. Public PR
acceptance and downstream Join integration/deployment are separate later events.
