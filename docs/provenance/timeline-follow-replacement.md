# Timeline follow policy replacement contract

## Scope fixed before implementation

Only `packages/timeline-virtualizer/src/follow.ts` is selected. Its package provenance explicitly describes the reducer as a typed restoration of the recovered parent LocalConversationThread OD state machine and its placement/spacer/restore helpers as retaining recovered constants. Other virtualizer algorithms, history backfill, response-positioning controller and platform adapters retain their current implementations. A behavioral reference elsewhere is not sufficient to select another module.

Public base: `1bfea3daf9dbf6dabaad44b7665f2ad0af8feb69` (toolbar PR #147 merged). Historical follow module SHA256: `ae0646da9193e00fe3a4d99f663863072806956e4c4e476a7b3e39abde37e472`. The separate baseline inventory retains each original function hash and public type declarations without copying function bodies.

## OpenCraft requirements

1. A single renderer-neutral policy owns `static`, `response_watch`, `prework_watch`, `prework_follow` and `user_follow`. Web and Native remain consumers, not additional writable follow owners. Public types, exports, default behavior, ordinary threshold constants and animation compatibility data remain compatible.
2. Initial mounting considers progress, phase, saved mode and normalized distance. Restored response watch must not acquire fresh follow ownership. Preserve boundary behavior around 24px and identity of unchanged reducer results.
3. Explicit bottom commands grant follow according to phase; reading away withdraws ownership. Placement may opt into response watch; overflow then advances to following. Phase completion and new text must not pull a detached reader to the bottom. Preserve the prework-to-answer handoff when ownership already exists.
4. Submit placement snapshots exclude existing synthetic spacer, retain the scroll-height baseline, and preserve signed content-height deltas for submissions that do not place. A missing pending snapshot preserves the established default.
5. Spacer capacity/overflow and restore projection retain current 300px, 2/3, 240px and 24px compatibility boundaries. Saving a checkpoint is pure: normalization may select a saved mode but cannot mutate current mounted follow state.
6. Preserve public input mutation behavior, finite/edge-number behavior, state identity and extra fields where they are currently observable. Black-box observations freeze actual boundary semantics before replacement authoring; any uncertainty is resolved there, not by reading historical function bodies.

## Evidence and limits

The author has read public declarations, existing focused tests, package provenance, current shared response-positioning controller and bounded Web/Native consumer code. Those consumers themselves contain historical source references, which remain in scope inventory; this is not strict author isolation or a rights conclusion. Historical follow function bodies and the recovered reference module have not been opened for authoring in this batch. Compatibility constants and public interfaces are ordinary retained data. Previous work in this long-running session has exposed other recovered modules.

Before authoring: freeze transition/initialization/geometry/restore observations and actual shared-controller sequences, with immutable input/output hashes. Validate both Web and Native type contracts, existing focused tests, boundaries, official Web build and an actual browser consumer. External observers stay outside Git; no new committed tests or harnesses. Historical provenance remains readable, and replacement disposition is limited to this module rather than clearing the package or history.

Status: contract frozen; implementation not authored. Observations and validation are recorded in later events.
