# Activity group disclosure replacement

## Frozen requirements (2026-10-19)

1. Replace the complete group disclosure module, both the exported phase reducer
   and React component, preserving all public props/types and real consumers.
   Do not move activity semantics or timeline virtualization into this component.
2. Preserve four phases: collapsed toggle opens through opening; one animation
   frame promotes opening to expanded; expanded/opening toggle closes; closing
   toggle reverses directly to expanded; closing animation completion collapses.
   Disable always collapses. Irrelevant completion/frame events are no-ops.
3. Keep initial defaults, external collapsed updates and immediate local user
   interaction compatible. onExpand fires on user expansion, followed by
   onCollapsedChange(false); user closure reports true. Prop synchronization must
   not emit user callbacks. canExpand=false exposes a noninteractive summary.
4. Retain a single labelled OverlayDisclosureTrigger, summary/icon/chevron geometry
   and existing CSS/ARIA/data contracts. Reduced motion must complete promptly.
   Closed bodies are not rendered; lazy children execute only while retained.
5. Animate disclosure with natural auto height, never observe/tween scrollHeight
   or introduce a second scroll writer. Already open streaming descendants grow
   through normal layout without remount. Closing body immediately stops pointer
   interaction; reversing a close retains existing descendant DOM.
6. Use the existing viewport reflow lease and projected disclosure-height port.
   Anchor at activation, complete/cancel the correct interaction, and cancel on
   supersession/unmount. Test real viewport ownership, not a local scroll shim.
7. Preserve summary key/transition modes static, immediate and deferred, including
   rapid replacement and reduced-motion behavior. Keep latest live content while
   preserving disclosure/descendant identity. Retain initial-collapse opt-in.
8. Preserve historical annotation and hashes; document author exposure and actual
   verification. Verify reducer contracts and real Web touch/mouse, normal/reduced
   motion, content growth, interruption, reflow cancellation and theme/layout.

## Authoring boundary

Exact baseline is [activity-group-disclosure-baseline.json](activity-group-disclosure-baseline.json).
Inputs are public TypeScript declaration-only compiler output (including inferred
return types), import declarations, existing tests, consumer JSX, design/CSS,
existing shared height/reflow/trigger ports and executable black-box observations.
The target's previous implementation body has not been opened for this replacement.
The public declaration comment attributed it to “Group-level disclosure
reconstructed from Codex r2440's phase machine” and specified natural auto height
for streaming content. This historical assertion remains recorded here.

The author has previously seen other recovery-related code and artwork, including
partial old code-surface policy. This is requirements-first independent replacement,
not strict clean-room isolation or historical source-rights clearance. No recovered
external renderer or BB/Paseo implementation is an authoring input for this module.
Implementation follows this separate requirements commit. Compatibility refinements
and actual validation will be recorded without rewriting the frozen observations.

## Implementation and refinements

Requirements commit: `8f8c897`. Complete replacement and fixture/test updates:
`83d7a4f`. Committed-summary refinement: `0aa37cc`. Requirements precede both
implementation commits. The new component uses a finite transition table, local
phase with explicit prop synchronization, the existing motion-height/reflow ports
and a separately committed summary snapshot. It neither measures scrollHeight nor
writes scroll positions or duplicates timeline state.

An exploratory server-render invocation initially failed because tsx's classic JSX
mode expected React in the old module's runtime scope. Its stack displayed the
single source line `return (` at line 192. No substantive old JSX/body was opened;
a second public render with React supplied yielded only rendered markup. This
minor runtime-source exposure is recorded alongside the prior exposure above,
not represented as strict isolation.

Executable observations refined initial assumptions:

- Re-enabling canExpand restores explicit collapsed=false even when that prop
  itself did not change. Defaults alone do not reopen a previously disabled group.
- Initial-collapse opt-in must mount at natural expanded height before closing;
  starting an already-zero-height closing node can omit completion entirely.
- Deferred labels throttle distinct summary keys to one-second commit slots,
  including reduced motion. Same-key live content displays immediately without
  replacing the committed snapshot used while a subsequent key is pending.
  Immediate mode cancels pending work; superseded keys never appear later.
  Preliminary fixed-delay/fade and reduced-motion bypass assumptions were corrected.

The existing reflow smoke had stale synthetic activity-unit data: missing blocks,
collapsedItemCount, status and segmentEnd prevented its worked-for scenario from
exposing any toggle under the current activity policy. The fixture now supplies
those fields plus the current inner-choice callbacks. All original geometry,
lease, growth, input and cancellation assertions remain intact. The same fixture
correction is exercised with the intact baseline module as a control.

## Verification and limits

- The complete phase/event Cartesian product (16 cases) matches the executable
  baseline and is now explicitly covered in the existing unit suite. All **20**
  focused tests pass: five disclosure, five trigger and ten provenance tests.
- A real Chromium public-prop trace covers 16 normal/reduced-motion scenarios,
  with **124** sampled component states, including initial/default/external intent,
  user callbacks, disable/re-enable, body presence, ARIA and summary updates.
  Final compared semantic fields match, and inline styles match after declaration
  order normalization. These samples are finite behavior evidence, not exhaustive
  equivalence or a frame-by-frame animation identity claim.
- A separate controlled-clock browser probe covers **18** summary samples across
  both motion preferences. Date.now and queued timer delivery are synthetic;
  actual React/component rendering remains real. Its final labels and pending
  deadlines match the intact baseline, including rapid replacement, live same-key
  updates, committed-snapshot fallback and immediate-mode cancellation. This caught
  the final snapshot refinement after the broader public-prop trace.
- Web typecheck, platform/typography/activity boundaries and the updated source
  inventory pass. All ten provenance tests pass after the inventory update.
- Existing activity disclosure smoke passes four touch/mouse light/dark cases,
  retaining earlier prose DOM, user choices and final-answer visibility through
  streaming. Activity metrics pass eight width/theme/DPR cases; the 390px dark
  screenshot was visually inspected. These actual components use synthetic
  conversation data, not live model/account acceptance.
- The fixture-corrected reflow script passes against the intact baseline. A local
  diagnostic copy of that same script also passes against the replacement: **48**
  opening/closing geometry observations have zero heading drift, plus four input,
  viewport-detachment and unmount-cancellation records. It also exercises rapid
  reversal, natural body growth and anchor retirement. The diagnostic copy adds
  logs only. An earlier development run failed at the missing worked-for fixture;
  another reported an unfinished lease while source was changing. Neither is
  counted as acceptance or silently treated as a successful run.
- Local evidence lives in `/tmp/opencraft-group-*.log`,
  `/tmp/opencraft-group-contract-{baseline,acceptance}.json`,
  `/tmp/opencraft-group-summary-clock-{baseline,final}.json` and
  `.local/activity-metrics/after/`. Local probes are not new CI scripts or portable
  artifacts. Native Electron/iPhone, live login/model and external services were
  not exercised; Web probes do not establish native acceptance.

The renderer-expression inventory retains **four** unresolved paths and five
partial dispositions; all **nine** unresolved groups remain open. Shared hooks,
consuming renderers and historical source rights are not reclassified by this
module replacement. Notices and source evidence remain preserved.
