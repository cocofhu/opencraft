# Interrupt interaction response implementation

## Explicit source boundary and exposure

The [historical baseline](interaction-interrupt-baseline.json) records the complete
module's source-equivalent Desktop cleanup annotation and exact digest. That
annotation selects this module, not its neighbors or every integration name.
The author previously saw the complete small target body, protocol definitions,
caller and tests. This is not strict author isolation or historical rights clearance.

## Requirements frozen before implementation

The protocol union in `packages/appserver-protocol/src/server-requests.ts` and
`InteractionResponse` own the wire method names and response shapes. Keep the
exported synchronous `createInterruptInteractionResponse` function and its type.
For a supported pending request, retain the exact opaque request ID and return
one newly allocated cancellation response per invocation:

| Request family | Cancellation response |
| --- | --- |
| command execution approval | command-approval, decision decline |
| file change approval | file-change-approval, decision decline |
| permissions approval | permissions-approval, empty permissions, scope turn |
| user input | question, empty answers |
| dedicated option picker | option-picker, dismiss, empty selectedOptions, null freeformAnswer |
| dedicated setup context picker | setup-context-picker, dismiss, empty selectedSources |
| MCP elicitation | elicitation, decline |
| dynamic tool call | null; server resolution owns its lifecycle |

This helper never reads parameters or mutates input and does not grant permissions,
retain an always/session grant, resolve a dynamic tool, perform network I/O or own
turn state. Caller ownership stays unchanged: only pending requests of the
interrupted turn are selected; settle all cancellation attempts before sending
interrupt, even when one response rejects. State publication, provenance, rollback
on interrupt rejection and finally cleanup remain with the conversation runtime.

Empty response objects/arrays must not be shared between invocations. Keep all
current protocol method names, even those containing Codex, because they are live
integration identifiers. Unsupported methods outside the typed protocol union
are not new API. No new repository tests or observation harness are added.

## Frozen checkpoint

This commit records the requirements and historical exposure before the next
implementation. Existing response/runtime/ledger tests and external protocol
observations will verify actual behavior. Ordinary protocol data and response
facts are retained; neither a different syntax nor passing tests proves legal
clearance or resolves other source inventory groups.


## Pre-implementation public observations

External native TypeScript invocation covered all eight protocol methods, five
opaque request IDs and three metadata variants (120 cases). Input objects were
frozen and parameter access deliberately threw; all calls passed. Returned nested
objects/arrays were distinct and mutation of one response did not affect a later
response. The frozen external observation SHA256 is `288da8d74cb9cd3887a0e827091295f8162a94e9700f59e9751e4cffe34f40e4`.
No new implementation is present at this checkpoint.


## Current implementation and verification

The complete helper now uses an exhaustive typed factory table over the existing
server-request union. Each supported method creates a fresh cancellation payload
or yields null for a dynamic tool; the runtime caller and protocol types are
unchanged. Method names and response values are required integration data, not
newly invented behavior. Prior full-body exposure remains disclosed above.

All 120 external before/after observations matched exactly. The 59 existing
response/ledger/conversation-runtime tests, runtime typecheck and platform/
typography checks passed. External invocation of the actual conversation runtime
with the existing synthetic Replica fixture verified mixed requests, other-turn
filtering, dynamic-tool preservation, waiting for all response attempts despite
one rejection, provenance and cleanup on interrupt success/rejection. The first
external fixture omitted the other turn from history, making its pending request
create the active turn; its wrong active-turn assertion failed. The failed log
is retained; adding the actual completed other turn to the fixture restored the
intended scenario without changing assertions or production code.

No tests or observation harness are committed. This is a pure helper change;
synthetic runtime observations do not prove real account/model/server behavior or
clear any historical source rights. Remaining source groups stay unverified.

The public Web release build completed with 791 runtime source files and zero
compatibility issues. The source inventory and 10 existing provenance tests
passed; the unresolved group count remains eight.
