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

## Frozen policy observations, before authoring

The unmodified historical module produced 846 initialization/factory cases, 680 complete reducer cases (five modes, every typed event, all phase pairs, finite boundaries, nonfinite numbers and negative zero), 15 follow/preservation predicates, 289 placement/pending cases, 1,728 signed-resize cases, 144 capacity cases, 1,728 overflow cases and 25,920 restore projections. Ninety actual shared-controller sequences each record 15 checkpoints, including capture purity, placement, phase transfer, overflow, restoration settlement, user takeover, historical-height adjustment, bottom intent, completion and removal. Frozen policy observation SHA256: `f26f90dfc6477f96ef381a38952b47f8b40679763e69126b73dc0ee073942f0e`. Nonfinite numbers and negative zero are explicitly tagged to preserve information. State identity and extra fields are observed. This is bounded compatibility evidence, not proof for all possible inputs or Native hardware.

Observed details refine the initial prose: a missing pending snapshot is **false**, not permission to place; negative dimensions are retained compatibility inputs rather than silently sanitized. Restored watch modes are handled differently (`response_watch` resets, `prework_watch` is retained away from the bottom). A fresh phase transition into prework affects only static/user-follow, the prework-to-answer handoff maps prework-follow to user-follow and prework-watch/user-follow to static, while response-watch survives until overflow or completion. Inputs with NaN also retain the old predicate boundary behavior.

## Baseline verification and authoring sequence

All 141 existing focused virtualizer, Native-host and Workbench timeline tests passed on the unchanged module. The existing `smoke-conversation-scroll.ts` passed its first live-viewport section, then failed at line 282 on the unchanged historical implementation: its direct-final-answer static expectation predates the currently tested `response_watch` local-submit policy. The original script, fixture and failure remain unchanged; this is not counted as a full passing smoke. A separate external observer reuses the actual existing Conversation fixture to record current local-submit/remote-submit/initial-live, real wheel takeover, growth, completion, explicit bottom and remount behavior.

The replacement body was first authored outside the checkout after policy/controller observations were frozen, while the unchanged-module browser observer was running. No original follow function body or recovered reference was read. The replacement will be installed only after the browser observer's source hash guard completes. The external observer initially selected the Playwright CommonJS namespace incorrectly; that observer-only error was retained and corrected to its actual default export, without changing product code.

Unchanged-module actual Conversation baseline completed: three scenes, 28 checkpoints, no page errors. Complete raw observation SHA256: `9dbc4718ba2b720a37257dae757e03044b28ed250c04325b362e9cc90e82b9b5`. No per-case payload normalization is applied. The screenshots and raw geometry/scroll/restore output remain external evidence; this is local synthetic content in a real Web consumer, not employee-session, model or Native-device acceptance.
