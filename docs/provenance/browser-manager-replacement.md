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
