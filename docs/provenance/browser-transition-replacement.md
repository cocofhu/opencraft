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

## Frozen public observations (before implementation)

Runtime-only observation of the fixed baseline covered 53 sequences through the
8 externally used methods. The observer is outside the repository; it emits
Host-port calls, visible/blocked/reference/generation state, registration
subscriptions, frame queues and timeout durations, never the old target body.
Its SHA-256 is `da0c87e600a830b904cc9bc90aa243f60ec345befdf136fb0a6a483bec1b4918`.
The public factory accepts the existing logger port. `sync`/`detach` have four
arguments, attachment acknowledgement three, host removal/transfer one,
conversation removal one, and global disposal none.

Observed normal behavior: owner plus surface isolate transfers; direct sync
needs no transition when no painted predecessor exists. A pending transfer
blocks both surfaces, registers an incoming readiness listener, covers incoming
bounds with the predecessor and places the incoming surface behind it. A
matching attachment acknowledgement (including one received before staging),
or a 100ms fallback, starts two prewarm frames followed by one release frame.
Registration updates stacking without acknowledging an attachment. Detaching
the outgoing view releases its reference while retaining its paint until release.
Removing the outgoing tab finishes the incoming transfer immediately; removing
the incoming tab, disposing either host, transferring its route or removing its
conversation cancels the transfer. Returning to the outgoing view restores it;
rapid replacement retains the original outgoing view. Hidden/nonpainting sync
cancels a pending transfer involving that view. Stable Host disposal remains the
manager's responsibility; this layer only forgets its presentation claim.

Sampled adversarial sequences also exposed old behavior that is not a required
compatibility guarantee: wrong-reference/generation detach cancelled a pending
transfer, cross-surface reuse could later restore an old reference, and already
acknowledged prewarm could reveal a newer generation without its own ack. These
conflict with the frozen identity/lease requirements and actual coordinator's
stale-detach guards. The replacement must fence these cases, explicitly record
the differences and verify them; do not change expected output to disguise them.
The synthetic Host intentionally has simpler paint/block behavior than the DOM
Host; its detached `blocked` bit is not proof of actual DOM interaction state.

Only declared caller contracts and the observations above are authoring inputs.
The historical source lock will retain its original digests and distinguish a
current independently authored module digest from the historical class digest.
