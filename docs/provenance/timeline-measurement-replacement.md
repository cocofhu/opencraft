# Turn measurement transaction replacement contract

## Scope frozen before implementation

Only `createTurnMeasurementTransaction` in
`packages/timeline-virtualizer/src/measurement.ts` is selected. Its declaration
explicitly calls the implementation a recovered Codex measurement transaction
(the virtualizer nt path). Neighboring rekey/reconciliation/height helpers,
imports, interfaces, layout/window/scroll policy and all consumers stay unchanged.
Behavior-only coordinate comments and ordinary compatibility data do not select
additional code for rewriting.

Public base: `c96f309e4ba8483c1fe5ee134a8b7f37e1fa37c6` (PR149 merged).
Historical module SHA256:
`604701370aea7d30124ae030f4b3b6e5bf38845b4794514056eb328a9525b7a3`.
Historical selected function SHA256:
`2a0e140a43839c79a97390de1492050084d428e4c28cf5ebafd7160bfb304fb3`.
The baseline retains exact declaration hashes, signatures and source annotation
without copying function bodies.

## OpenCraft requirements

1. One platform measurement batch produces a coherent measured-height table,
   layout, mounted window and scroll decision. Web and Native must not independently
   reinterpret this transaction or apply a second correction for its layout.
2. Preserve the nullable result contract, public readonly interfaces, existing
   import/helper policy and config defaults. Freeze no-change, invalid/unrecognized
   measurements, duplicate measurements, signed/nonfinite input and identity
   behavior before authoring rather than guessing normalization rules.
3. The synchronous controller distance is the viewport authority. Detached readers,
   bottom state and synthetic bottom padding retain their current compensation
   boundaries. Row folding and history/measurement changes preserve permitted
   reading geometry through unchanged shared layout/window helpers.
4. Latest-Turn height notification and its baseline are distinct from total layout
   delta. The current response/follow owner decides whether it may compensate;
   viewport preservation cannot become a second response-placement policy.
5. A pending restore delegates distance through the existing callback. Previous
   pending transactions, callback presence versus returned value and restoration
   error/call order must retain their observed semantics across batches.
6. Web retains its synchronous latest-Turn DOM-height fast path and pending-layout
   commit path. Native retains its generation/lease filtering and frame scheduler.
   No consumer, platform mechanics or unchanged helper is selected for replacement.

## Evidence and author exposure

Before authoring, read public interfaces, signature/declaration/hash metadata,
existing focused measurement tests, bounded actual Web/Native commit consumers and
the shared timeline wrapper. These consumers contain historical reference comments;
other recovered modules were also exposed in this long-running session. No original
selected function body or recovered reference body has been opened for this batch.
This does not establish strict author isolation or historical-rights clearance.

Freeze full output, input mutation/identity and callback observations before
implementation, including chained pending transactions and thrown callbacks.
Freeze actual current Conversation geometry/scroll/checkpoint behavior before
installing the replacement. External observers and evidence stay outside Git;
no new committed tests or harness. Run existing focused tests, shared/Web/Native
typechecks, platform boundaries and official Web build. Preserve original source
records, finite verification limits and actual failures. Native hardware,
employee/model/remote-Host chains remain separately unverified.

Initial status: contract frozen, implementation not authored. Toolbar/follow is
already deployed and verified on Join368; history backfill PR149 is upstream-merged
but has not yet entered that runtime. These are distinct delivery stages.
