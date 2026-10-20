# Sidebar content replacement boundary (pre-authoring)

The user requests continued replacement of explicitly attributed/restored implementations, normal upstream integration and periodic Join delivery. Usable integrations remain; ordinary data, public API names, protocol shapes and code without evidence are not automatically rewritten.

## Evidence and selection

Public baseline: 47f615caa1614ad5f44d3687565919c5e8c7b296. sidebar.tsx carries the explicit comment `Semantically restored from the r1442 AppShell left-panel ownership model.` The proposed implementation boundary is the exported memoized Sidebar declaration (byte range/hash recorded in the external declaration inventory). This is a bounded next portion, not a finding that every adjacent declaration has copied expression.

Keep imports, public interfaces, ExtensionCatalog, SidebarPagination and SidebarNewChatButton unchanged unless separate evidence justifies a change. Keep attribution honest for remaining unreviewed portions. Do not remove history, LICENSE, NOTICE, wire names or working Codex/ChatGPT features. This work cannot establish historic rights or strict author isolation; prior source exposure exists. No implementation replacement has been authored at this checkpoint.

## Requirements from interfaces and documented contracts

- Parent owns thread catalog, active and pending Host/Thread identity, navigation and mutations. Composite identity must preserve equal Thread IDs on different Hosts. Sidebar projects these inputs and uses existing action/modal owners.
- Installation UI preferences own search/filter/group disclosure settings where the existing public contracts require them. Server filtering uses stable origin Server identity; missing rows and reconnect do not silently clear the selection. Product grouping/filter data remains plugin owned, subscribes and releases normally.
- Needs-attention, pinned and recent partitioning/order remain delegated to existing shared policy. Recent page budget is ten and pinned budget independent; only explicit click or end-pull reveals more. Rendering, programmatic scroll and catalog notifications do not drain pages.
- Existing rows retain DOM identity across page expansion and input/presentation changes. Layout store remains owner of bot ordering; no second draft, Host, connection or scroll owner.
- One sidebar menu owner coordinates context and overflow entry identities; stale close callbacks cannot close a different menu. Existing thread capabilities, pending title, badge and modal contracts remain intact.
- Existing quiet background catalog loading, actionable catalog/discovery retry, user-facing strings and i18n remain. Loading is not a successful empty result.
- Primary/footer contributions, Start/New chat, settings, management navigation, catalogs, bots, footer visibility and dialog-vs-inline search flags remain supported.
- Shell retains layout/theme/material/gesture ownership and dismissal semantics. Touch/desktop, light/dark and existing portal/presentation-root behavior remain usable.

## Evidence plan

Use actual public-baseline Sidebar with its own installed dependencies and synthetic public props. Freeze external observer inputs and full recorded outputs before authoring. Cover paging/disclosures, title and server filtering, optional plugin filtering, menu/callback Host identity, pending selection, contributed navigation/catalogs, loading/error/retry and search presentation. Supplement with unchanged existing recent-pages, catalog, running-menu and full-Shell mobile checks as applicable; those are not interchangeable coverage. Web evidence does not establish native Electron/physical iPhone acceptance or live account/engine behavior.

Pilot artifacts and failed observer acquisitions are retained, not reported as passing baselines. Freeze final observer only after selectors and scenarios actually run. No new committed tests/harness, dependency changes or machine paths. Replacement should be authored from public contracts and frozen observed behavior, not copied or transformed from the selected old function body.


## Current evidence boundary

The first external observer records 108 complete states across light/dark and desktop/touch-emulated scenes on the original public baseline. It covers paging, disclosures, search, server/plugin filtering, callbacks, pending selection, contributed actions/catalogs, loading and retry. It does not alone cover all optional contracts: bot creation/order/drag, custom grouped presentation and badge overlays require complementary observations before replacement authoring. Menu acquisition here uses keyboard activation; it does not stand in for physical touch validation. The `searchInDialog` flag suppresses Sidebar inline search; the actual search dialog and its opener belong to the surrounding Shell. Failed pilot acquisitions remain part of the external evidence.

No implementation changes or rights clearance are represented by this requirements-only commit. Remaining helpers and historically exposed versions retain their existing review status.

Complementary actual-component observations now add 48 states covering custom grouped projection/disclosure, badge open/switch and suppression, plugin mode/notice transitions, Bot invocation, delegated creation.open and contribution removal. Both observers run four light/dark desktop/touch-emulated scenes without page errors (156 recorded states total). Provider-owned creation dialogs, Bot drag/drop and native hardware remain outside those observations. No selected implementation has been authored or treated as cleared.

A third frozen observer adds 60 states on the original component: pointer drag actually commits Alpha after Beta; keyboard start/commit/cancel retains its observed original order; provider selection and synthetic creation pending/success/error/cancel are recorded. The unchanged neighboring DnD and creation controls remain delegated capabilities. The selected declaration has not been opened or authored during this preparation; prior historic exposure is not excluded. Initial ambiguous transition targets and provider-label acquisition failures are retained externally.
