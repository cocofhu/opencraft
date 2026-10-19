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
   semantics. Error callbacks report failures, including stale failures, through the supplied port;
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

## Frozen observations before authoring

The unmodified historical class produced 446 complete cases: 224 viewport and
page-result combinations, six synchronous/async failure cases and 216 held-load /
held-layout combinations covering invalidation, replacement requests, disabled or
missing metrics and throwing error callbacks. Complete raw output SHA256:
`c577196fd1ad47d497b9bf8ce766a0250984f469d728763cd31be430ee57881f`.
The actual existing Conversation history fixture produced ten checkpoints for
underfill, callback identity changes, unmount/remount, repeated fill and growth.
Complete raw browser output SHA256:
`c287759a150719db6d34c72ec5c9799bd183f267084b6b7d0457f82bc7c66cb9`.
Both observers guarded the unchanged historical module hash throughout execution.
External observer hashes are recorded in the baseline inventory; harnesses,
synthetic input and raw observations remain outside the repository.

These observations refine the initial prose: successful page loads always finish
the layout barrier, even after invalidation or an explicit stop result. Generation
and enabled checks follow that barrier. Stale failures still call onError; a
throwing error callback rejects that operation, while a replacement request can
continue after the old rejection. Initial isEnabled exceptions reject directly;
metric/load/layout failures are reported through onError. Height change in either
direction permits another pass, which rereads geometry. Identical active requests
share a Promise; replacement requests wait for the previous operation to settle.

All 141 existing focused tests passed before authoring. Browser checkpoints have
no page errors; Vite separately logged one ResizeObserver notification-loop warning,
which remains part of the evidence rather than a claimed warning-free run.
This exercises real Conversation, React ownership adapter, virtualizer, DOM metrics
and ResizeObserver with synthetic content; it is not Native-device, employee-login,
paid-model or remote-Host acceptance. No historical coordinator body was read.

## Replacement and observed outcome

The complete class is now independently expressed with operation/epoch ownership,
a stable request command and a viewport-fill loop. Imports, public type declarations
and both shared/platform adapters are unchanged. Current module SHA256:
`6682cd21405b10ada3ea3171f8a10d60aa147abcdb19065ff1bed0e571f2216b`.

The first attempt passed scrollHeightPx directly to the shared policy, whose
contract requires contentHeightPx. Typechecking rejected that mismatch and 36
frozen policy cases differed; its first browser output also differed. The first
focused test run's underfill loop was stopped after the cause was established.
Correcting only the caller's field mapping yields exact raw-byte equality for all
446 policy cases and all ten actual Conversation browser checkpoints. The original
observers and expected payloads are unchanged; first-attempt evidence is retained.
The same ResizeObserver notification warning occurs before/after, with no captured
page errors. No reference implementation body was opened for the correction.

All 141 existing focused tests pass on the corrected implementation. Subsequent
type, boundary, official Web-build, source inventory and protected PR results are
recorded separately as they complete. No new committed tests/harness or dependencies.

## Verification completed before PR

Shared virtualizer/React, Web and Expo/Native typechecks pass; all 141 existing
focused tests, typography/platform boundaries and source inventory validation
pass. The official Web build contains 791 runtime source files and zero
compatibility issues. The final real Conversation screenshot was inspected.
The corrected module and all frozen observation hashes above remain unchanged.
Eight inventory groups remain unresolved and releaseReady remains false. No
Native hardware or complete employee/model/Host chain was exercised. Upstream
integration and Join runtime deployment remain separate subsequent events.
