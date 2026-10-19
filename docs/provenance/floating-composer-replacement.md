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

## Implementation and compatibility refinements

Frozen requirements commit: `9d41771`.
Initial complete implementation and four added contract tests: `3f6a6004a76bb9b72dcdface7042d8801ff7c689`.
Release/eviction settling refinement and fifth contract test: `7ba4dd4`.
The requirements commit precedes implementation. No previous target body was
opened during this replacement; the public declarations include inferred cleanup
return types, avoiding the earlier code-surface extraction ambiguity.

The replacement uses a snapshot value and observer membership, pure presentation
projection, cancelable visibility transactions, an insertion-ordered route registry
and an independently authored gesture record. All four runtime exports remain.

Finite black-box comparison refined several preliminary observations without
rewriting the frozen requirements above:

- Unready browsers override global disable as well as tab collapse. Inline and
  unready projections preserve entering, otherwise show visible presentation.
- Empty-string IDs are supported by projection, focus, automatic intent and
  toggle; manual hide/show require nonempty IDs. Public show also requires global
  enable. Toggle enables/reveals a collapsed tab even while globally disabled.
- Only manual hiding clears focused-tab intent. Automatic intent can update
  while globally disabled and automatic reveal removes its reason regardless of
  editor/menu activity. It does not re-enable global floating intent.
- Focus/phase updates preserve the collapsed-map identity; toggle creates a new
  map even when its entries do not change. Intent and phase have separate
  synchronous publications, including repeated phase values.
- Wheel decay uses the running peak absolute magnitude, rather than only the
  initiating magnitude. The decay observation latches for the gesture lifetime;
  acceleration checks start at 200 ms, with a strict increase above last delta + 8.

A final lifecycle audit found release and eviction must settle pending animation,
even for subscribed owners being released. The merge watcher was stopped before
this correction; the expanded registry matrix also tracks retained store snapshots
through animated hide/show. The initial registry matrix checked only identity and
subscriber retention, so it did not detect this omission. The corrected head is
validated and pushed before normal merge.

Initial development comparisons exposed these differences, and were corrected
before final acceptance. No assertion was weakened to hide a mismatch.

## Verification and limits

- An untracked deterministic black-box harness compares **21,812** old/new cases:
  6,912 snapshot/input projections, 2,400 operation sequences with fake timers,
  snapshot/map identity, publications and queued deadlines, 12,000 wheel event
  sequences and 500 registry/subscriber/transition operation sequences. Zero final
  differences. This is finite compatibility evidence, not exhaustive equivalence
  or proof of source rights.
- **32 tests pass**: 12 floating composer tests, 10 workspace presentation tests
  and 10 provenance tests. The five added contracts cover release/eviction settling, readiness/global intent,
  focus/automatic intent, retention recency and wheel timing/peak boundaries.
- Web typecheck and platform/typography/activity boundary checks pass. The updated
  provenance inventory has no uncovered known annotations; its 10 tests also pass
  after updating the disposition.
- The existing unchanged real Web `smoke-workspace-presentation.ts` passes with
  reduced motion and with normal animation. It renders actual AppShell,
  ThreadComposerPresentation, CodexComposer and browser iframe runtime; backend
  and controller data are synthetic. It verifies draft/submit-target retention,
  one editor, browser counter/resource continuity, hidden inert state, keyboard
  reveal, bounded response preview and light/dark panel layouts at 1280/800 widths.
- An untracked copy adds explicit DOM object identity assertions through panel
  relocation, browser presentation, hide/reveal and before submit. It passes with
  normal animation. The DOM continuity probe, Web types, expanded matrix and all
  32 tests pass again after the release/eviction refinement. The latest-turn dark
  screenshot was visually inspected.
  Local logs/artifacts are `/tmp/opencraft-floating-web-{reduced,normal}.log`,
  `/tmp/opencraft-floating-dom-continuity.log` and
  `/tmp/opencraft-floating-dom-continuity/`; these are local evidence, not portable
  CI artifacts. No new broad browser script is committed.
- Native Electron/webview, physical devices, OS clipboard, live model/login and
  external services were not exercised. The consuming Shell, browser source and
  other renderer expressions retain their own unresolved classifications.

The renderer-expression group now retains **five** paths with four historical
partial dispositions. All **nine** unresolved groups remain open. Historical
notices and hashes are preserved; this change neither establishes strict
clean-room isolation nor clears historical source rights or public releases.
