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
