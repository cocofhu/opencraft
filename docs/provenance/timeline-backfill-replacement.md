# History backfill coordinator replacement contract

## Scope frozen before implementation

Select only the explicitly restored `TurnHistoryBackfillCoordinator` implementation
in `packages/timeline-virtualizer/src/history-backfill.ts`. Package PROVENANCE
identifies restoration of the recovered history-loading control mechanism,
including single flight, owner generation, post-page layout barrier, viewport fill
and unchanged-height stopping. Its two imported dependencies, public types,
shared React adapter, platform metrics and all other modules stay unchanged.

Public base: `0a4bbde931b0df7dc107dcdf61ea4461988eac73`.
Historical module SHA256:
`5819a01f20431c320b5b07b54537ad39320fbda6de42176e03068a5a29fd5ead`.
The baseline inventory retains exact declaration/class/member hashes, types and
positions without copying method bodies.

## OpenCraft requirements

1. A stable request command coordinates one history owner. Requests in the same
   generation share one active operation and never overlap a page load.
2. Invalidating a generation fences stale work. A new request waits for an older
   in-flight load instead of starting a parallel load. Settling an old operation
   cannot clear a newer owner's active operation.
3. Current enabled state and platform metrics decide whether another page is
   needed. A page finishes before the layout barrier; geometry is reread only at
   the current generation's permitted boundary. Fill until scrolling is possible,
   explicit stop, disabled/missing metrics, invalidation or unchanged height.
4. Retain sync/async load behavior, returned Promise identity and settling/error
   semantics. Error callbacks report current failures through the supplied port;
   neither reference text nor guessed cancellation rules replace observation.
5. Public interfaces/imports and unchanged helper policy remain compatibility
   contracts. Web and Native keep their existing adapters and scroll authority.

## Evidence and author exposure

Read before authoring: package source declaration, public types/member metadata,
existing focused history tests and the complete unchanged React ownership adapter.
Historical coordinator bodies and recovered reference bodies have not been opened
for this batch. Other recovered components have been exposed in this long-running
session; this is not strict author isolation or historical-rights clearance.

Freeze complete call-order/Promise/error/generation observations before authoring.
Use held load and held layout promises, rapid invalidation, replacement requests,
late completion and error cases as well as viewport-fill boundaries. External
observers remain outside Git; no new committed tests or harness. Preserve the
original module/class hashes and source record. Existing tests, Web/Native types,
boundaries, official Web build and actual unchanged Web consumer verification
must match the scope. Native hardware and employee/model chains are separate.

Initial status: requirements frozen; implementation not authored. The preceding
toolbar/follow batch is already integrated into Join and its original CI is live;
this next module is not part of that deployment.
