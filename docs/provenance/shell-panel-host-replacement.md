# Shell right-panel host replacement

## Frozen requirements (2026-10-19)

1. Replace the complete AppShellRightPanel module, preserving its single exported
   component, props, consumers and shared CSS/ARIA/data contracts. This component
   projects external shell geometry and visibility, never owns a second visibility
   animation, browser resource or draft model.
2. Use the existing panel animation port for occupied width and retention until
   terminal zero. keepMounted retains descendants even when closed at zero.
   Semantic close immediately sets aria-hidden and inert while exit can retain DOM.
3. Surface width and minimum share one atomic CSS target signal based on the
   supplied right-panel content width. Clip width follows occupied width; open
   streaming/browser surfaces keep their target width throughout exit. Preserve
   live width changes and browser presentation invalidation ticks.
4. Keep resize ownership solely on the existing edge handle. Full-width mode
   omits the handle; parent supplies actual full-width geometry. Read current bounds,
   current size and default width from shared panel-model ports with Shell's
   mainMinimum reserve and current available width/height.
5. Resize changes only the preferred width ratio. Raw pointer sizes below the
   160px shelf close the panel; exactly 160 stays open. The 320–160 corridor
   retains minimum rendered width. Crossing back reopens; avoid redundant callbacks.
   Cancellation restores start geometry through the existing handle port.
6. Preserve keyboard resize, Home/End and double-click default sizing, temporary
   resizing feedback and progress/size subscriptions with cleanup. Parent remains
   sole animation writer. Do not add whole-panel pointer capture or scroll writers.
7. Preserve child DOM, edited draft, iframe/browser state and layout continuity
   through live resize, close/reopen, full-width transitions and rapid reversal.
   Verify actual held-pointer frames rather than only a settled screenshot.
8. Freeze requirements before implementation; retain baseline hashes, historical
   annotations and author exposure. Verify public finite behavior and real Web
   integration, relevant tests/types/boundaries and normal upstream CI/PR merge.
   Keep native-device, external-account and historical rights conclusions bounded.

## Authoring boundary

Exact baseline is [shell-panel-host-baseline.json](shell-panel-host-baseline.json).
Inputs are declaration-only TypeScript output, import declarations, public consumer
JSX, existing tests/design/CSS and executable black-box observations. Previous
AppShellRightPanel implementation bodies have not been opened for this replacement.
A targeted comment search exposed its historical attribution: “Typed semantic
restoration of Codex's AppShellRightPanel layout contract”, source
`terminal/app-shell-right-panel-06052` and
`shared/toggle-maximize-side-panel-button-01708`. Additional matched comments
asserted ownership and stable-surface behavior. Exact source remains in the
baseline Git blob; these annotations are evidence, not new authoring instructions.

Existing shared usePanelAnimation, resize-handle and workbench-panels model ports
were read to understand integration. Some carry unresolved recovered-source
annotations themselves. They are reused unchanged as explicit dependencies and
are **not** reclassified or copied into this module. The author previously viewed
other recovery-related code/artwork and a partial code-surface policy. This is
requirements-first independent replacement, not strict author isolation or
historical source-rights clearance. No recovered external renderer/BB/Paseo
implementation is used as an authoring input. Implementation follows this separate
requirements commit; actual refinements and verification will be recorded below.

## Implementation and refinements

Requirements were committed as `15dc265` before implementation. The complete
replacement and a source-structure guard refinement were committed as
`a809afcd9169ed1d20874aa6ef5f48498088930b`. This implementation projects external
motion values, subscribes a shared invalidator to progress/content-width changes,
retains the host during a held resize and emits bounded resize intent. Existing
animation, handle, geometry, CSS and browser implementations remain unchanged.
The oracle checkout's target Git blob was independently checked as
`3b2e297730a8fc98a2ff155496982fb135748676`, exactly matching the frozen baseline;
its body was executed without opening it as an authoring input.

The first focused run failed a lexical test requiring an inline progress callback
followed textually by `rightPanelLayoutTick.set`. The implementation declares one
named invalidator before both subscriptions. The guard now checks the subscription
and invalidation separately; runtime tick behavior is independently checked below.
The other animation-ownership, atomic-width and browser guards are preserved.

A public drag probe refined the mounting requirement: when a held drag closes the
panel and progress reaches zero, the host/handle must remain until the gesture
ends, allowing a reversal to reopen it. A direct jump below the 160px shelf must
preserve the previous ratio, whereas resizing within the ordinary range updates
it. These refinements came from executable behavior, not old function bodies.

## Verification and limits

- 93 existing focused tests pass across timeline-host ownership, panel state,
  workspace pane geometry and provenance. Web typecheck and boundary checks pass.
  The final provenance manifest also passes its 10 focused tests.
- Chromium executes the actual old/new component and unchanged shared ports.
  Exact observable snapshots match for **347** finite inputs: 12 geometry/tick/
  keyboard/default/visibility observations, 320 cross-product cases, 12 held-drag
  retention samples and three direct shelf-jump samples. The cross product uses
  main widths 390/1200, supplied content widths 0/100/500/1200, progress
  -0.2/0/0.25/1/1.2, and both open/keepMounted/fullWidth flags. It deliberately
  includes inconsistent public input states; these are finite contract checks,
  not proof of every production state or animation trace.
- Observed fields include occupied/surface/clip widths and style strings,
  aria-hidden/inert, handle current/min/max, descendant presence, ratio, tick
  counts and open-change sequences. Keyboard arrows, Home/End, double-click
  default, close-at-zero retention, reversal and preference-preserving magnetic
  close are exercised. Literal JSON observations match without normalization.
- The unchanged `scripts/smoke-workspace-presentation.ts` passes with both normal
  and reduced motion, using the real AppShell, RightPanel, Composer and Web iframe
  presentation. Draft survives maximize/hide/restore, the browser counter remains
  live and continues through three interactions, and explicit close releases it.
  External terminal/Host/model/account behavior is not provided by this fixture.

### Integration-check failures retained

The first readable-pane fixture run hit duplicate React loading in Sonner before
it could test layout. Its local retry explicitly prebundled Sonner and motion.
The existing script also searched for the obsolete separator name “Resize right
panel”, silently skipping held-drag checks with the current “Resize preview panel”
name. Requiring the current handle exposed its other stale premise: a viewport
transition left the preferred panel width at the 320px minimum, so a further
narrowing drag could not increase main width. Both new and exact old implementations
failed identically (`before=960`, `held=960`, panel width 320 at viewport 1280).

The maintained fixture now supports the explicit Chromium executable, prebundles
those dependencies, requires the desktop handle, and uses existing End/ArrowRight
controls to enter the ordinary range before pressing the pointer. It asserts
held narrowing, held reverse widening and cancellation back to start, preserving
its existing frame alignment, draft/DOM identity, scroll-anchor, overflow,
open/close/maximize and rapid-reversal assertions. The target module is unchanged
since `a809afc`; a baseline control swaps only that exact historical target at
Vite transform time without exposing its source body. Final results follow below.

No real native Electron/device, operating-system pointer capture, external
account, network model or historical rights clearance is claimed. Shared ports
and all other unresolved provenance groups remain open; passing finite samples
and CI do not establish strict clean-room isolation or release readiness.

Two preparation refinements were also required and are not hidden as successful
runs: issuing End and successive ArrowRight events without frame barriers could
read the previous derived width and reset the ratio to minimum; both full-matrix
controls then failed the held assertion. With the starting width inside bounds,
both implementations passed held narrowing/reversal but failed immediate cancel
measurement. The fixture now waits two requestAnimationFrame boundaries after
keyboard changes, each held move and cancellation, and explicitly asserts its
starting width is inside the ordinary range. This samples rendered geometry while
the pointer is still held and after cancel, without relaxing width tolerances or
using arbitrary time delays. A one-viewport prepared diagnostic passed before the
final full matrix; only final completed matrix results count below.


### Final completed Web matrices

The maintained smoke fixture at `de692a5` passes **120** transition scenarios and
**eight** held gestures across seven viewport widths (320–1600), light/dark and
normal/reduced motion. It samples **6,299** rendered frames. The control with only
the exact historical target swapped back passes the same 120 scenarios/eight held
gestures, sampling **6,245** frames. Frame counts vary with scheduling; the eight
held geometry records match exactly. At 1280, main width is 580 at start, 644
while narrowing the panel, 540 on held reversal and 580 after cancellation; at
1600 those widths are identical, with the larger complementary panel width.
The fixture records these separately in `held-resize.json`; its regular transition
samples remain in `result.json`. No page errors occur; the isolated server's
unserved favicon returns 404. The 390px light and 1280px dark screenshots were
visually checked: narrow full-pane presentation and wide split layout retain
bounded chrome and the intentional synthetic unavailable-tool fallback. This is
not a real terminal/Host session.

Final rerun: all 93 focused tests pass after the manifest and fixture updates;
Web typecheck and platform boundaries exit successfully. Historical failed runs
above remain part of this verification record. Nine provenance groups, including
three remaining renderer-expression paths, are still unverified. Normal upstream
PR CI/merge is tracked separately from these local results.
