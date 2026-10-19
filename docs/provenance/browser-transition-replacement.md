# Browser presentation transition: bounded replacement requirements

## Selected source boundary

The [fixed baseline](browser-transition-baseline.json) preserves the complete
module hash and its explicit claim that a class body was copied from a named
reference. This module is selected on that direct evidence. The manager, DOM
Host, toolbar and preset modules are not selected by directory association.
Source review distinguishes behavior, ordinary facts, already licensed/original
code and uncleared retained expression; a group count is not a rewrite plan.

## Requirements frozen before authoring

- Preserve the `createImplementation(ports)` factory and current public manager
  and Host contracts. The logger is a narrow injected port; lifecycle scheduling
  must cancel pending work on disposal and invalidate late callbacks.
- Preserve continuity when switching visible browser surfaces: retain the painted
  outgoing surface until the incoming attachment is acknowledged for the current
  identity/generation and it has completed the existing readiness/prewarm and
  frame boundary. Block interaction during the transfer and release it only at
  completion; the transition is not the session or browser backing owner.
- Rapid A-to-B-to-C changes must fence late B callbacks without releasing the
  wrong outgoing surface. Stale attachment acknowledgements and stale detach
  references/generations must not mutate the current owner.
- Preserve detach, host/tab/conversation removal, route transfer, hidden/visible
  states, timeouts/readiness failures, and all existing public operations as
  established by consumer declarations and baseline observations before authoring.
  Do not change browser execution, persistence, partitions, navigation, user
  permissions, toolbar behavior or working integrations.
- Use current tests and actual component/Host ports for verification. No new
  committed tests or harness. Historical source locks must remain honest about
  their original reference; replacement must not pretend its bytes match the
  copied historical class. Unchanged regions remain separately unverified.

## Method and current state

Freeze consumer/API contracts and observe the fixed OpenCraft baseline without
printing the old target body as authoring text, then independently implement the
required owner/lease behavior. The longer session has exposure to other recovered
modules, so this cannot claim strict author isolation or historical rights
clearance. No implementation has been authored at this checkpoint.
