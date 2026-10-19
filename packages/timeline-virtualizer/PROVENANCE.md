# Timeline virtualizer provenance

The package historically began as a typed, renderer-neutral restoration of the Codex Desktop
`VirtualizedTurnList` model. The behavior baseline is:

- `reference://codex/.runtime/source-tree-build-r1316-owner-adoption-abi/lazy/app-initial/thread-virtualizer-D5BSbZuA.js`
- `reference://codex/.runtime/source-tree-build-r1316-owner-adoption-abi/lazy/app-initial/open-sources-side-panel-tab-CfgjOF5O.js:139-820`
- `reference://codex/.runtime/source-tree-build-r1316-owner-adoption-abi/lazy/app-initial/thread-scroll-layout-xQ2_L08y.js`
- `reference://codex/.runtime/source-tree-build-r1316-owner-adoption-abi/lazy/app-initial/local-conversation-thread-CShhuS2f.js:9159-9795`

The shared package intentionally contains no React, DOM, Expo, or React Native
imports. Web and Native adapters must supply measurement, scrolling, and layout
scheduling through the ports in `src/ports.ts`.

Historical `src/history-backfill.ts` restored the history-loading control mechanism from
the latest recovered source:

- `reference://codex/.runtime/source-tree-build-r1973-initializer-state-control-closure/lazy/app-initial/thread-scroll-layout-xQ2_L08y.js:145-182`
- `reference://codex/.runtime/source-tree-build-r1973-initializer-state-control-closure/lazy/app-initial/local-conversation-thread-CShhuS2f.js:10799-10820`

It retains the original single-flight rule, layout-owner generation, post-page
layout barrier, viewport-fill loop, and unchanged-height stop condition. The
React callback-identity boundary lives in `@opencraft/timeline-react`; DOM and Native
hosts continue to provide their own metrics and frame scheduler.

Historical `src/follow.ts` restored the parent `LocalConversationThread` policy that sits
above the list itself. Its `static`, `prework_watch`, `prework_follow`, and
`user_follow` reducer was the typed form of the recovered `OD` state machine at
`local-conversation-thread-CShhuS2f.js:8896-8933`. Latest-Turn placement,
response-spacer geometry, and restore normalization retain the recovered
24/300/2⁄3/240 constants. They stay renderer-neutral; Web and RN adapters own
only their scroll calls, measurement events, and animation primitives.

## Current follow policy disposition (2026-10-20)

Only `src/follow.ts` is independently replaced from the frozen OpenCraft public
contract, existing tests, consumer interfaces and complete black-box observations.
The old module SHA256 is
`ae0646da9193e00fe3a4d99f663863072806956e4c4e476a7b3e39abde37e472`;
individual historical function hashes and actual author exposure remain in the
[baseline inventory](../../docs/provenance/timeline-follow-baseline.json).
The [replacement contract](../../docs/provenance/timeline-follow-replacement.md)
records authoring order, retained interfaces/constants, behavior comparisons and
verification limits. Historical source records above remain historical facts.

The shared response-positioning controller, window/layout,
restoration and platform adapters retain their current implementations. This
single-module disposition does not establish rights for them, the recovered
reference, or historical commits. It does not claim strict author isolation or
Native device acceptance. Compatibility export names and numeric/spring data
remain unchanged; changing a name is not the implementation replacement.

## Current history backfill disposition (2026-10-20)

Only the complete `TurnHistoryBackfillCoordinator` class in `src/history-backfill.ts`
is independently replaced from frozen OpenCraft requirements, public types,
existing tests, the unchanged React adapter and black-box observations. Its
historical module SHA256 is
`5819a01f20431c320b5b07b54537ad39320fbda6de42176e03068a5a29fd5ead`.
The [baseline inventory](../../docs/provenance/timeline-backfill-baseline.json)
retains class/member hashes and actual author exposure. The
[replacement contract](../../docs/provenance/timeline-backfill-replacement.md)
records complete policy and real Conversation comparisons, the initial rejected
parameter-mapping attempt and finite verification limits. Imports, public types,
shared loading policy and Web/Native adapters retain their implementations.

This disposition does not clear other package files, recovered references or
historical commits, and does not claim strict author isolation or Native hardware
acceptance. Historical restoration records above remain historical facts.

## Platform rule

`VirtualizedTurnViewportState.renderedRange` is the only window authority on
every platform.

- Web renders the slice inside a full-height spacer, observes Turn elements with
  `ResizeObserver`, and normalizes the inverted scroll container to
  `distanceFromBottomPx`.
- Expo/RN renders the same slice inside a full-content-height Native container,
  reports row heights through `onLayout`, and normalizes `contentOffset`,
  `contentSize`, and viewport size to `distanceFromBottomPx`.
- `FlatList`/`VirtualizedList` may be used as a mechanical host only when its
  internal window does not become a second source of truth. Passing the complete
  Timeline to an independently configured Native virtualizer is not compatible
  with this package's cross-platform contract.
- Both platform adapters consume the same Turn follow reducer. A local
  `isAtBottom`/`followOutput` boolean is a second policy and is not allowed.
