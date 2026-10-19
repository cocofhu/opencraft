# Browser manager class replacement boundary

## Selected scope and requirements before authoring

The module explicitly claims a copied class body. The complete selected class,
not merely the storage/claim subset in current unit tests, is the next bounded
replacement target. The [baseline](browser-manager-baseline.json) preserves the
exact historical file/class hashes and reference manifest. Keep factory/port
binding bytes outside the class, except the direct copied-body annotation when
replacement is complete. Existing host, independent transition, viewport helpers,
toolbar and thin adapter retain their current implementation and ownership.
Do not classify those neighbors as copied because they share the browser feature.

Keep all manager-facing methods, observable maps/sets and listener subscriptions
required by the current adapter and coordinator. Inventory all class methods and
actual consumers before implementation, including snapshots/media, stable storage
identity and restoration, ephemeral/persistent modes, route ownership, mount claims
and generations, backing Host creation/registration/focus/staging/detach, prewarm,
agent-use tabs/cursor/capture/viewport state, transfer/reassociation and teardown.
Logical close, presentation unmount and backing destruction remain separate.
Registration, renderer/host identity and generations must fence stale asynchronous
callbacks; automation release must not revoke a presentation handoff block.
Keep full cleanup and explicit subscription ownership, not a simplified manager
that only passes current storage/mount tests. Preserve observed keys, defaults,
notifications, structural sharing and error/cancellation semantics used by clients.

Before replacement, freeze valid consumer-driven method/event sequences and
controllable Host/registration/transition callbacks through opaque execution of
the historical module. Record all public-method coverage and remaining gaps;
existing tests alone cannot establish this much larger contract. Do not print old
target bodies or emitted-code diagnostics. Fake only declared external ports and
state exactly which synthetic/native behaviors were exercised. Actual browser
coordinator/Host behavior and relevant existing tests/types/build must follow.
No repository tests or observation harness are added; update existing integrity
assertions only if required to retain historical digests separately from a new
implementation lock. No reference Desktop implementation is authoring input.

This is a requirements freeze and bounded candidate, not a completed replacement,
current source classification or a rights conclusion. Prior author exposure is
recorded; strict author isolation and historical rights remain unverified. Eight
unresolved groups remain open. No Join pin or running version is changed by this
next candidate, which follows the separate Hook/dictation batch already in CI.

## Consumer inventory and initial execution

The current adapter is instantiated only by BrowserPresentationCoordinator and
the existing manager test. The coordinator owns Page/backing/use factories,
logical close, present/measure/dispose handles, page snapshot subscriptions,
storage restore, layout projection and deferred mount detach. Its late ready
callback checks the same current presentation record before attachment. The
manager class has 60 method declarations plus state fields and subscribe; direct
consumer call counts alone do not cover constructor-routed events and internal
lifecycle helpers. No target body has been printed in this bounded pass; the
factory port bindings outside the class were read as integration contract.

Opaque initial execution records nine router topics, window focus/document
visibility handlers and sixteen default getter observations. Renderer/storage IDs
are mocked as deterministic opaque identities. This initial sample does not
exercise Host creation, asynchronous registration, transfer, destruction, media
projection or the complete class. Those remain explicit observation work before
implementation. No runtime implementation or source classification has changed.

## State observations before authoring

A separate opaque run records 153 calls with two owners and two tabs: storage ID
allocation/reuse, promotion and required restoration, shared and stale mount
claims, snapshot/toolbar notifications, browser-use viewport/capture/cursor state,
transfer source/consumption, tab removal and conversation cleanup. The exact
results, notification counts and serialized observable state are frozen by the
baseline digest. Ordinary ports and snapshots are synthetic; no Host was created.
The old implementation throws on a null cursor update (`visible` is required);
this is retained as an invalid-input observation, not asserted to be a current
consumer operation. An audible snapshot alone produced no media tab in this run;
that does not establish complete media projection behavior.

This run still does not cover Host registration readiness, stale identity
fencing, presentation transitions, prewarm/destroy or constructor router payloads.
The class remains unchanged and those coverage gaps still block replacement
authoring. State calls and default getters are evidence for only their exercised
inputs; they are not a claim that all sixty methods have been validated.

## Host and invocation inventory before authoring

A second run uses the actual independent CodexPresentationHost and transition,
with synthetic guest/DOM ports, controllable Host readiness and a frame queue.
Its 53 observations create six Hosts, exercise rapid A/B/C presentation, delayed
registration across replacement and final disposal, automation/capture viewport
state, focus/visibility notifications, empty prewarm, reassociation and close.
Zero frames or timers remain after teardown. The initial observer passed owner/
tab strings to detach and received two sanitized TypeErrors; the exploratory
output is retained separately. Calling the same port with Host/reference/surface/
generation succeeds. No historical class body or emitted diagnostics were read.

Prototype invocation counters across state and Host runs reached 55 of 60 method
declarations. With counters removed, complete serialized outputs equal their
uninstrumented runs. Default-only observations additionally cover the two
browser-use predicates, but there is no claim of full branch coverage. The exact
five not-invoked names and artifact digests are retained in the baseline. Host-
request destruction, current-identity disposal and empty-conversation cleanup
still need valid consumer-driven scenarios; constructor router payloads, rejected
registration and genuine browser coordinator/guest behavior also remain gaps.
A running counter is not completion evidence for those cases. No replacement
implementation or current provenance classification has changed.

## Actual Web consumer baseline before authoring

A local Chromium run exercises the actual BrowserPresentationCoordinator, thin
manager adapter, historical manager, independent Host/transition, Page runtime
and WebIframeSurfaceHost together. Ten checkpoints cover initial readiness,
rapid A/B/C switching, returning to A with the same iframe/document and an edited
draft, live responsive widths 390/600/430, a 393×852 device viewport, moving the
same Page to floating presentation, logical close and full disposal. Assertions
confirm the outgoing frames park, the selected frame paints, the original draft
and Host identity survive remount, layout updates without replacing the Page,
and close/disposal remove frames and manager Hosts. No browser page errors were
observed; the floating-frame screenshot was inspected. This is the actual Web
consumer and a real local same-origin iframe, not a fake manager/Host geometry
model. The exact observation digest and source identity are frozen separately.

An additional consumer search includes scripts: the existing desktop browser
smoke observes `isBrowserUseActive` after background inspection/capture. It must
remain available and accurately release automation. This run does not execute
that Electron smoke, native guest navigation/storage, full Workbench or employee
sessions. The other lifecycle/router rejection gaps above remain explicit. No
new repository harness or test is added and no implementation is authored yet.
