# DSH / AppServer protocol boundaries

## Ownership

- DSH owns sessions, durable events, running turns, queued messages, pending
  questions and approval decisions. The bridge must not infer an answer from
  a tool label or terminate a wait merely because a renderer disconnected.
- `DshClient` owns HTTP envelopes, per-request transport deadlines and
  multiplexed event envelopes. A caller-owned cancellation signal narrows the
  request lifetime; it never replaces the finite transport deadline. The client
  preserves the native `rpcId`; `/api/respond` uses `client-response`, not
  `client-request`.
- `DshRoutedClient` owns bounded history-window reads and shared in-flight work.
  It does not maintain a second full-history index. Every shared flight must
  settle and be evicted after success, failure, cancellation or timeout so one
  stalled native request cannot poison later restores.
- `ThreadLifecycle` serializes operations for a logical Thread. It does not own
  another transport timeout or terminate native DSH work; its delegates must
  already have bounded lifetimes at the transport boundary.
- `DshInteractions` owns only pending wire correlations and response translation.
  It replays pending requests to subscribers, suppresses simultaneous duplicate
  responses, and withdraws requests on DSH resolution or an accepted receipt.
- Each downstream WebSocket tracks which threads it opened and which requests
  it was offered. Initializing a client or probing a connection is not permission
  to answer every pending question on the host.
- `DshToolProjection` joins calls/results for both history and live projection.
  The result identity is `message.source.callId`, and output is nested inside
  `message.content[].content`. Never invent a shared `unknown` item ID.

## Mapping

| Native input | AppServer output |
| --- | --- |
| question/requested + envelope rpcId | item/tool/requestUserInput server request |
| question/resolved | serverRequest/resolved |
| approval/requested | item/commandExecution/requestApproval, allow once or reject only |
| approval/resolved | serverRequest/resolved |
| JSON-RPC answer | POST /api/respond using the original DSH rpcId |
| tool/call | item/started with stable call identity |
| tool/result | item/completed for the same item, preserving name and arguments |
| turn/end with unfinished tool | unsuccessful tool completion before turn completion |
| foreground bash | commandExecution with commandActions, outputDelta, exitCode and duration |
| todo/write | turn/plan/updated and a stable plan item for history |
| goal/change | thread/goal/updated or thread/goal/cleared, independent of TODO |
| thread/goal/get | authoritative session.history goal projection |
| assistant/message | deferred phase: commentary before further work, final_answer on successful turn end |
| thread status `notLoaded` or `idle` | neutral Workbench Thread state; no attention marker |
| thread status `active` | running Workbench Thread state |
| thread status `systemError` | explicit error state; never a running or review marker |

`DshTurnProjection` is the shared ordered fold for history and live events.
An unfinished message keeps a null phase until its execution boundary is known.
Command classification is display-only and conservative: compound shells,
expansions and unsupported flags remain unknown. Background bash stays a generic
tool result rather than pretending its process has exited. Foreground result
markers distinguish nonzero exits, timeout and signals from success.

Goal reads and notifications do not implement goal mutation or budget accounting.
DSH exposes no goal token/time counters: protocol-required counters are zero
(no recorded usage), tokenBudget is null; they are not measured consumption.
Goal mutations must not be advertised as supported until explicitly translated.

Generic tool approvals have no fabricated shell command: command remains null
and reason names the tool. Persistent grants are rejected, not silently widened.
DynamicToolCallStatus has no interrupted variant; the tool becomes failed while
its owning Turn carries the interrupted status.

## Verification and remaining limits

`npm run test:dsh-bridge` covers native envelope round trips through real HTTP/
WebSocket transports with a fake DSH server, downstream reconnect, preflight
isolation, response races, cancellation during context lookup, and tool identity.
It does not replace a live model/macOS acceptance test.

This is not a claim of complete DSH feature parity. In particular, native question
multiSelect/intent presentation, recovery of missed upstream timeline events,
history pages beginning after a tool's call, and model-modality catalog propagation
still need explicit protocol work. Do not add renderer heuristics or mark these
capabilities supported merely because a generic tool card can be displayed.

The Workbench owns only the presentation of projected Thread state. A review
marker requires a real product attention source; restore not yet loaded is not
review work. Sidebar colors consume semantic design tokens and do not reinterpret
transport or AppServer lifecycle state.

## Indexed assistant blocks and thread instructions

The local `DshBlockProjection` supplements the fixed HyperNode interpreter.
Native `block-start` tracks block identity without creating empty reasoning
Items; `block-end` reconciles the complete indexed block. Reasoning closes
before text begins, including streams without explicit block-end. A final
assistant envelope corrects the same reasoning Item rather than creating it
again. Text retains deferred commentary/final phase ownership at execution
boundaries. Live delivery and history replay use this same ordered fold.

`baseInstructions` overrides the native scoped deployment persona slot; harness,
tools and repository context remain native contributions. `developerInstructions`
is an additional scoped section. RPC strings remain literal, including `{{...}}`.
Omitted/null RPC fields retain the saved value;
an empty string suppresses the base persona or removes the additional developer
section. Changes affect subsequent prompt assemblies without recreating or
interrupting the Agent. A history-only resume without overrides remains lazy. An external engine without
the native thread port rejects explicit overrides instead of silently dropping them.

Native Session creation metadata holds initial choices; the owned non-surface
`opencraft/instructions` event records later complete choices. There is no user
message injection or parallel transcript store. The locked rc.2 runtime exports
its accepted event vocabulary but lacks a plugin registration method: the local
controller registers exactly this event for its composition lifetime. Unknown
unrelated required events still fail closed. An older Host without this
registration cannot interpret logs containing the extension; preserve the data
and upgrade the Host instead of removing events or silently ignoring instructions.

Fork inherits settings at the selected native history boundary and applies
explicit overrides. Cold resume, engine-generation recovery and live updates
share one scoped controller. Legacy catalog instructions are migration input
only when the native session has no instruction state; they cannot overwrite
newer native choices during ordinary activation. Existing sessions that never
persisted their old baseInstructions cannot recover that previously discarded
value. Prompt contents and arbitrary provider errors are not diagnostic output.

`tests/dsh-blocks.test.ts`, `tests/dsh-instructions.test.mjs` and
`scripts/smoke-dsh-instructions.ts` exercise block completion/reconciliation,
scoped isolation, bounded forks, concurrent resumes and real locked-runtime
requests across whole-Host and engine-generation recovery. Inference in the
smoke uses an isolated local synthetic endpoint. These corrections do not prove
that prompt wiring caused any particular model's communication frequency.
