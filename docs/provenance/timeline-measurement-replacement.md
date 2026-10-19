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

## Frozen observations before authoring

The unchanged historical function produced 4,065 complete cases: 3,840 combinations
of list size, existing measurement, ten batch patterns, synchronous distance,
padding, preservation and restore callback; 180 sequential pending-transaction
steps; and 45 signed/nonfinite/default-config cases. Full raw output SHA256:
`7b907bda4455cbf0d63d713e4f8baab5b1e95b3ae67ee0756732f2730101645e`.
Observations preserve Maps, NaN/infinities/negative zero and undefined explicitly,
complete output values, input mutation, object identity/frozen state and callback
call order/throws. All input snapshots remain unchanged. Callback throws are
intentional synthetic observations, not a passing claim that exceptions disappear.
An earlier before-authoring run lacked frozen-state fields and remains retained;
no product code changed between the runs.

Actual unchanged Conversation produced three scenes and 28 checkpoints for live
content, local/remote submit, latest-row growth, real wheel takeover, completion,
bottom intent and remount. Raw output SHA256:
`9dbc4718ba2b720a37257dae757e03044b28ed250c04325b362e9cc90e82b9b5`.
The actual history fixture produced ten checkpoints for underfill, callback changes,
unmount/remount and growth; raw SHA256:
`c287759a150719db6d34c72ec5c9799bd183f267084b6b7d0457f82bc7c66cb9`.
Both external observers guarded the original measurement-module hash throughout.
They report no captured page errors; the history fixture's existing Vite
ResizeObserver notification-loop warning is retained. This uses real Conversation,
shared owners/virtualizer, DOM/ResizeObserver and synthetic content, not employee,
remote-model or Native hardware acceptance. All 141 existing focused tests pass
on the unchanged implementation. Browser and policy observer hashes are in the
baseline inventory. Implementation remains not authored.

Observed boundaries refine the initial prose: a pending restore callback's presence
is distinct from calling it, and a changed height table does not always allocate
a new viewport or issue an immediate scroll correction. A shrinking row may request
platform preservation for the next layout instead. These branches, latest-row delta
and pending-transaction state are frozen in full observations, rather than replaced
by a guessed general compensation formula.

Before authoring, 1,728 additional cases freeze fully measured visible anchors,
nonzero viewports, padding/gaps and a controller clock ahead of the viewport mirror.
The complete combined 5793 cases have raw SHA256 `5d820d436c86b1ecab8d245ad2d3efce4afd86e78f4c6c5418545852f0e257e4`.
Original 4,065-case evidence remains retained. Inspection also confirmed duplicate
measurements retain per-input baseline accumulation and pending decisions carry
across batches; neither is replaced by deduplication or a guessed final-height delta.

Final before-authoring refinement adds row bottom/top/distance edges and pending
restore/preservation handoffs, including repeated latest-row batches. All
6189 cases have raw SHA256 `b3262256fa2989ceafe00898e88274d74df9f6d968123d582f178cc45d04ff0f`. Earlier files remain retained;
no selected implementation body has yet been read or authored. The existing
current synchronous distance (excluding padding) gates measured-row compensation,
and previous latest-height notification accumulates across uncommitted batches.
