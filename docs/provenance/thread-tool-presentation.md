# Native thread-tool activity disposition

## Reviewed boundary

At accepted baseline `bd1270d58329ff2e6c7a6f1dbc31a3816ccdd11f`,
`packages/chat-core/src/tool-activity.ts` contains the recovered
`CodexAppToolLabels` / `CODEX_APP_TOOL_LABELS` declaration, 21 label values and
four per-tool grouping flags. SHA256 of that declaration region (up to, but not
including, `codexAppSummaryKey`): `2b43026dc3cace1ef4e3b141afca688f7986f28bb0d792d90f0b5fda23af1538`.
The historical exact reference bindings remain in
[`source-reference-bindings.json`](../source-reference-bindings.json).
This is a table-specific finding, not a finding about every line in the module.

## Current implementation

That declaration and lookup are removed. OpenCraft now formats these supported
protocol operations as an operation title plus an explicit execution phase:
`List threads · Running`, `List threads · Failed`. An optional provider-authored
`actionName` supplies the title; otherwise the existing generic identifier
formatter reads the protocol name. Worktree context is an independent suffix.
There is no per-tool active/completed sentence catalog.

Local disclosure policy classifies calls as transfer, status polling, inspection
or ordinary change. This preserves the established requirements that a transfer
owns a separate activity, successful polling is summarized with its transfer,
and successful read/list sequences can bridge calls. A failed or interrupted
inspection cannot keep an activity live, and an unsuccessful poll remains
visible. These are display decisions, never permissions inferred from tool names.
Transport failure/interruption takes precedence over a stale transfer progress
result. A successful polling RPC may still describe an active transfer.

Authoring inputs were the existing OpenCraft `ToolCallTimelineBlock`, execution
states, native argument/result parsers, generic identifier formatter and actual
Web/Native consumers. The change implements a different representation and
state policy; it does not replace the former sentences with synonyms. It was
written in the same review context that had inspected the historical reference;
this is **not a clean-room claim**. Independent implementation disposition is
limited to this removed table and its replacement, not the entire module or
historical commits. Other legacy sentences/algorithms remain subject to review.

## Behavior evidence

`tests/chat-thread-tool-activity.test.ts` checks failures and interruptions for
all ten supported operations, provider display titles, worktree context and stale
transfer results. Its initial run against the unchanged baseline fails all twelve
cases; the original logs retain that result. Existing `chat-core` tests retain
navigation targets, created-thread cards, transfer results/steps, argument
rejection, stable summary identities and successful inspection/poll grouping.

`scripts/smoke-thread-tool-activity.ts` mounts the real Conversation and builtin
renderer with protocol fixtures, including navigation callbacks, created-thread
cards, transfer steps and failed polling. It exercises running/completed/failed/
interrupted updates on desktop/mobile layouts in light/dark themes. Its data is
synthetic; it does not claim a real execution engine or native-device session.

## Remaining review

The wider review also found the module's explicit “source-identical” MCP fallback
annotation, native handoff summary sentences and recovered handoff-step behavior in `codex-app-tools.ts`. Those
regions were outside the original 21-value finding. The follow-up [tool surface disposition](tool-surface-disposition.md) records
their bounded replacement. The separate unresolved `codex-tool-surface-fallbacks`
inventory entry retains the wider annotated regions for source-specific review; this table disposition does not clear them, add authorization or reduce
that work to a harmless protocol-name assumption. The full clients remain.
