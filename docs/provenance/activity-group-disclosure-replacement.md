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
