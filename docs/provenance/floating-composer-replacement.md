# Floating composer state replacement

## Frozen requirements (2026-10-19)

1. Replace the complete floating-composer-state module: snapshot projection,
   route store, bounded registry and wheel-gesture controller. Preserve all public
   exports, signatures and active Web/Electron renderer consumers. This module
   owns presentation intent, never drafts, editor DOM or browser resources.
2. Start enabled, visible, unfocused, with no collapsed tabs. Publish immutable
   snapshots synchronously; retain snapshot identity on no-op focus/hide/show.
   Subscribe/unsubscribe uses callback membership, with a void cleanup return.
3. Keep global enable intent separate from per-tab manual/automatic reasons.
   Hide requires a nonempty tab and an enabled, uncollapsed store; show removes
   only an existing tab reason. Toggle reveals a collapsed tab before changing
   global enable intent. Automatic collapse cannot overwrite existing reasons or
   act while editor/menu is active; automatic reveal removes only automatic reasons.
4. Visibility transitions publish intent before phase, run for 120 ms unless
   reduced motion is requested, cancel superseded callbacks and settle explicitly.
   Hiding clears focused-tab intent; showing/toggling preserves it. Different
   collapsed tabs remain independent. Retain observable publication order.
5. Projection separates actual floating mode, global enable, ready-browser tab
   collapse, phase, focus density and forceExpanded. Inline presentation remains
   available; loading/unavailable browsers cannot trap the editor in peek. Exit
   immediately disables interaction while retaining animation content; peek
   retains its mounted presentation. Expansion does not erase collapse intent.
6. Registry belongs to a shell instance. Get refreshes route recency; release
   trims oldest unsubscribed entries to 20 retained routes. Never evict subscribed
   owners; temporary overflow is allowed when active owners require it.
7. A wheel gesture retains momentum with its initiating action. Idle windows are
   400 ms for peek and 150 ms for composer (strict boundary), measured from the
   last accepted event. After 200 ms, renewed acceleration above the last absolute
   delta plus 8 ends a gesture that has decayed to half its initial magnitude.
   A rejected continuation stays rejected until beginSwipe starts another gesture.
8. Preserve historical hashes/source annotations and record author exposure.
   Verify public behavior against executable baseline, focused tests, affected
   types/boundaries and real Web composition with preserved draft and submit target.
   Do not infer native-device, external service or rights acceptance from these.

## Authoring boundary

The baseline is recorded in [floating-composer-baseline.json](floating-composer-baseline.json).
Inputs are existing tests, consumer code, design invariants, TypeScript
**declaration-only compiler output** and executable black-box observations. The
previous target implementation bodies have not been opened for this replacement.
The declaration output exposes private member names, types and historical comments:
“Codex overlay state ports”, “create-composer-overlay-reactive-state /
compute-contain-scale-factor” and the wheel reference
`ref/codex/modules/ui-islands-v8/use-toggle-diff-panel-subscription.js mDc`.
These historical assertions remain evidence, not new implementation instructions.

The author has previously viewed recovery-related code and artwork in other
modules, including a partial old code-surface conditional exposed by an earlier
signature script. This is requirements-first independent replacement, **not strict
clean-room isolation** or source-rights clearance. No recovered external renderer,
BB or Paseo implementation is used as an authoring input for this module.
Implementation and actual verification will follow this separate requirements commit.
