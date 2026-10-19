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
