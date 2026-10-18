# Upstream transition

The target upstream is [opencraft-app/opencraft](https://github.com/opencraft-app/opencraft).
Core development, public issues, pull requests, CI and releases belong there.
Downstream products consume immutable source revisions and own their product
composition. This replaces the previous mono2-to-GitHub mirror direction.

The cutover is **in progress**, not completed by this document. The latest
mono2 core still contains product imports and code with unresolved provenance.
Until the independently buildable candidate is accepted upstream and consumed
downstream, preserve existing runtime owners; do not overwrite a working
product with the older GitHub tree. No second writable copy is established.

## Ownership

| Upstream core | Downstream product |
| --- | --- |
| Actor identity, verified identity bindings, authorization, audit, Hub routing | IOA verification, employee fields, enterprise avatar service |
| Local/OIDC account adapters and public identity/execution ports | Vela account, billing, Bot discovery and TAT/Hermes composition |
| Chat, Composer, timeline, design tokens, public Web/Electron/Expo clients | Join branding/navigation and LightVela native/embedded product entrypoints |
| Public build/release tools and contribution/maintenance skills | Internal deployment, release channels, business service config and integration ledger |

A private provider establishes verified identity; core owns membership and
resource authorization. Removing a configured provider must fail closed.
Private startup code is supplied by a product composition root, not imported
unconditionally by a public Application or hidden only behind a menu flag.
Public clients must remain useful clients, not empty replacements for the
private product. Native product code must still be packaged, not fetched as
remote executable code.

## Current blocking edges

- Shared-package snapshot verification still detects existing Collaboration CSS
  drift: the downstream snapshot uses typography tokens while the source and recorded
  fingerprint describe the older stylesheet. This was reproduced on the clean
  aggregation baseline. Regenerating it would revert current product styling;
  preserve the current UI until source/overlay ownership is resolved. A passing
  core gate does not substitute for this separate failing snapshot check.
- Web Application/Supervisor now consume the trusted `@opencraft/client-product`
  lifecycle rather than creating a Vela account. The public entry selects no
  private product. Downstream explicitly selects a local composition using
  `OPENCRAFT_CLIENT_PRODUCT_ENTRY`; the private client package owns early login
  callbacks, one account, ordered platform/Hermes activation, embedded preflight
  and optional Collaboration descriptors. Its borrowed cache port preserves
  product credential namespaces and profile hydration behavior. The private client
  and Collaboration plugin sources, manifests and tests are downstream-owned in
  `products/vela/plugins`; the public workspace no longer installs those packages.
  Platform/Hermes and the account SDK now live in downstream `products/vela`
  as well. Public workspace manifests and locks no longer install those six
  private runtime/snapshot packages; this does not resolve source provenance.
- The private embedded element, account/physical-connection adapter, root and
  integration tests live in downstream `products/vela`. The trusted build owner
  selects its local entry with `OPENCRAFT_EMBEDDED_PRODUCT_ENTRY`; default public
  Web/Electron builds have no embedded product input or loader. Explicit product
  builds retain the existing element API and loader URL. An embedded-only build
  without an explicit entry fails instead of producing an empty replacement.
  Generic paint, prompt, panel, audio and connection helpers remain core. The
  Web application manifest no longer depends on Vela plugins. Original native
  product sources and private package entities are owned downstream. Original
  private probes and synchronizers are now downstream-owned as well; core has
  no private CLI compatibility imports. Generic approval/extension behavior
  checks and dependency boundary rules remain public. Private static assets are now selected
  explicitly through the trusted local product public directory. Web build policy,
  checker and release aliases are downstream-owned: product configs compose the
  core Vite factory rather than making a product label select private defaults.
  Existing CI and native Bot generators explicitly select their product config.
- Join's brand package, artwork, original generation tool and product browser
  assertions are downstream-owned. Its explicit client entry adds the original
  managed builtin to the existing product lifetime, after deployment defaults
  resolve. Core has no Join package dependency or unconditional manifest import;
  generic branding/extension support remains public. The product Vite config
  serves/copies its own plugin assets at the original URLs.
- Server-backed Web accepts trusted extension factories. The default server
  extension entry is empty; a downstream build explicitly selects its local
  assembly with `OPENCRAFT_SERVER_EXTENSIONS_ENTRY`. Headless alone no longer
  selects IOA. This removes that assembly edge, not the remaining LightVela
  imports or private plugin/package dependencies. Browser compatibility analysis
  follows the actual runtime graph across the workspace boundary, so moving
  product sources outside the prefix does not silently drop typed API checks.
  Trusted external sources can resolve public core dependencies from this build's
  workspace after their own valid dependencies; Web keeps existing React dedupe.
  Headless and Relay use a workspace dependency fallback as well. The typed checker retains
  imported core API types and rejects unresolved runtime TypeScript modules.
  These mechanisms are verified with external build fixtures; they do not by
  themselves move the remaining private plugins or prove their physical extraction.
- Headless and Relay startup accept trusted identity adapters; their default
  startup closures have no IOA dependency. The downstream product owns private
  CLI/configuration compatibility, human qualification and presentation and
  explicitly selects standalone/managed bundled entries. Headless core continues
  to own local/OIDC login, membership, Actor authority and execution lifetime.
  The IOA implementation, private catalogs and enterprise integration tests are now
  downstream-owned; the public workspace no longer depends on that package.
  Generic Actor/relay/storage tests remain public and use a synthetic signed
  identity source where needed. The product installs its own locked workspace
  against this exact checkout and validates private catalogs and lifecycle tests.
  The generic
  HTTP/WS gateway now consumes a trusted request-identity port, with no IOA
  imports, private route names, expiration rules or employee mapping. Managed
  document admission uses the core endpoint; the IOA plugin owns its legacy
  alias. The assertion verifier no longer hardcodes that private alias; trusted
  Join startup declares it as an additional exact admission probe. Default core
  assertions only recognize the generic endpoint, with all original binding and
  replay checks retained. This removes one dependency edge, not the product entrypoint closures.
- Expo's default entry now composes the existing native Workbench/Composer and
  direct WebSocket Host without selecting the Vela Router, account or Bot DOM.
  `OPENCRAFT_EXPO_PRODUCT_ENTRY` and `OPENCRAFT_EXPO_PRODUCT_CONFIG` are trusted
  local build inputs. Downstream `products/vela/run-expo.cjs` selects the original
  Router or agents-next entry, owns edition configuration and the private iOS
  Bot prerequisite, and passes this choice through the entire native build.
  The shared runner generates only public math/Mermaid assets. Original private
  routes, account/region components, Bot views and their original tests now live
  in downstream `products/vela/native`. The original Router registration consumes
  an explicitly selected product route context; core keeps the shared native
  Workbench and rendering adapters. Downstream styles scan the moved sources,
  and the product resolver binds shared SDK dependencies to the host instance.
  Platform/Hermes entities now live downstream too. Private native build aliases and agents-next assembly now belong downstream;
  generic APK/IPA commands no longer select a private product. Vela owns its
  original release naming and permission text, while core retains SDK/signing
  mechanics. Private smoke/tool aliases are now downstream-owned as described
  above; independent validation, provenance and the fixed-revision source cutover
  remain incomplete.
  Public native development identifiers remain legacy values in this phase;
  product release identifiers and callbacks are unchanged.
- The original Platform/Hermes plugins, account SDK and three product snapshots
  (`lightvela-agent-core`, `vela-chat-client-core`, `vela-collaboration-web`) live
  in downstream `products/vela/plugins` and `products/vela/packages`. Their package
  names and runtime implementations are preserved. Product tests own the original
  private cases; mixed suites keep generic Actor/Host/Workbench checks in core.
  Product SSR tests bind transitive dependencies to the core renderer's React
  instance, matching the production bundler's deduplication.
- Product shared-package and frontend-closure generators now live in downstream
  `products/vela/tooling`. Private core CLI aliases and compatibility wrappers
  are removed; downstream commands explicitly select the original core working
  directory and toolchain. Core boundary checks reject product source paths in
  public tools and package commands. The Console generator
  writes original skill artwork to downstream `products/vela/public`, which also
  owns the original TAT proxy Worker. `products/vela/build-web.mjs` and explicit
  Join builds select this trusted local directory using
  `OPENCRAFT_PRODUCT_PUBLIC_DIR`; public default builds do not carry it. Original
  URLs and bytes are preserved, and native Bot documents retain
  `copyPublicDir: false`. Private probes and build aliases are downstream-owned. Snapshot
  drift remains a real failing check, not a reason to edit generated copies or
  revert current styling. The private desktop provider's original prohibitions
  run in the product default test command after the provider moves downstream.

The first boundary work must preserve credential-scope revocation, identity
expiry, participant metadata, browser/WS admission and runtime disposal. A
successful build with those behaviors disabled is not a completed split.

## License and provenance

Apache-2.0 is selected for original core contributions. Existing recovery
annotations establish source lineage but do not establish redistribution
rights. `config/source-provenance.json` inventories the affected files and
required disposition; it does not assert that every behavioral reference is
copied expression. `NOTICE` retains this distinction and third-party notices.
The [review inventory](source-provenance-review.md) records the affected
components and resolution criteria. The selected first-release scope preserves
full clients. Independent-replacement work is paused while source-specific rights
and lineage are reviewed; unverified provenance does not establish a need for
replacement. A Headless-only first release is not selected.

```sh
node scripts/check-source-provenance.mjs --json
node scripts/check-source-provenance.mjs --release
```

The first command emits file SHA256s and unresolved groups. The release form
also rejects unresolved groups. Removing an inventory record cannot hide
remaining known source annotations. New findings must extend the inventory;
this is not a claim that keyword scanning proves absence of other issues.
Resolve each group with an evidenced source-rights conclusion, independent
replacement or actual exclusion from the candidate tree. Keep its historical
record; renaming files or deleting comments is not resolution.

## Downstream import

During the transition, a source-tree import avoids the known external
committer ancestry rejection without rewriting contributors. The mono2 tool
`scripts/opencraft-upstream.py` reads a separately fetched upstream clone:

```sh
python3 scripts/opencraft-upstream.py plan --source /absolute/upstream \
  --revision FULL_UPSTREAM_COMMIT
```

Review its immutable source tree and destination head. In a fresh isolated
feature branch, `import` with `--expected-head` and `--expected-tree` writes
exactly that tree under `opencraft/`, with one local parent and a receipt at
`docs/upstream/opencraft.json`. It transfers source blobs, not foreign commits;
the receipt and commit trailers retain the GitHub source SHA, tree and URL.
The tool refuses dirty worktrees, ignored files in the replaced prefix, stale
plans and direct imports onto main/master/env/join. It does not fetch, push or
deploy. After the first pin, it also refuses committed subtree edits that have
not returned upstream and invalid prior receipts, rather than overwriting
those edits. Normal downstream review, tests, integration and deployment remain
separate operations. Never use it to discard an unported local core change.

This tool is ready for fixture validation; no actual pinned cutover has yet
been performed. Products must be composed outside the replaced prefix before
the first full upstream import.

## Release lifecycle

Once source review and product isolation are complete, merge a release PR
that raises `packaging/web-server/package.json` and includes the exact
`## vX.Y.Z` changelog section. The main workflow creates the immutable tag and
performs preflight, package-once, exact-byte npm publication and verification.
Existing-tag manual dispatch remains the retry path. The npm-release
environment stays restricted to main and uses OIDC; no long-lived token is
introduced. Publication remains blocked while source provenance is unresolved.

The present migration does not make the repository public or claim npm/desktop
release success. Verify actual GitHub settings, CI, registry bytes and a clean
consumer before declaring the upstream operational.
