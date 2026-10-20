# Sidebar content replacement boundary (pre-authoring)

The user requests continued replacement of explicitly attributed/restored implementations, normal upstream integration and periodic Join delivery. Usable integrations remain; ordinary data, public API names, protocol shapes and code without evidence are not automatically rewritten.

## Evidence and selection

Public baseline: 47f615caa1614ad5f44d3687565919c5e8c7b296. sidebar.tsx carries the explicit comment `Semantically restored from the r1442 AppShell left-panel ownership model.` The proposed implementation boundary is the exported memoized Sidebar declaration (TypeScript UTF-16 text offsets and hash recorded in the baseline inventory). This is a bounded next portion, not a finding that every adjacent declaration has copied expression.

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


## Current bounded replacement

The exported memoized `Sidebar` declaration is now independently expressed from the
above public contracts and frozen observations. Requirements were committed in
`af0ab04`; the 108-, 48- and 60-state observations were committed in `d4663c6`,
`aca0596` and `b940be3` before implementation authoring. No selected old body was
opened during this preparation or authoring. Prior historical source exposure
exists, so this is not strict author isolation or historical-rights clearance.
No recovered Desktop, BB or Paseo implementation was used as an authoring input.

The implementation projects composite Host/Thread identities, delegates shared
task-flow policy, maintains independent pinned/recent budgets and projects plugin
subscriptions, grouping and filters. Existing menu/action owners, catalog retry,
Bot DnD/creation and Shell layout/dismissal interfaces retain their ownership.
Imports, public interfaces, constants and the three neighboring helper declarations
are byte-identical. The historical header is retained as a quote with an explicit
current/remaining scope note; all other bytes outside the selected declaration are
unchanged. The baseline records immutable old hashes separately from the current
module/declaration locks.

## Comparison results and retained failures

- The complete 108-state contract observer and 60-state Bot ownership observer
  match their pre-authoring raw outputs byte for byte. Each uses four light/dark,
  desktop/touch-emulated scenes with no page errors. Pointer reorder actually
  commits; the original keyboard sequence preserves order and is not described
  as successful keyboard reordering.
- The original 48-state optional observer retains a difference at its fixed
  100-millisecond Bot transition capture: an exiting row exists alongside the
  Bot tile in one original scene, while the candidate already has the tile only.
  The other 47 recorded states agree. This is not an all-216-state raw match.
  A supplemental observer, authored **after** replacement, waits for the actual
  existing row-to-tile transition to settle before that capture. Its complete
  48-state raw output matches between sealed original and candidate. This is
  supplementary settled-state evidence, not a retroactive frozen baseline or
  proof that transition timing is identical. The product adds no delay to force
  a sampling match.
- Initial comparison failures exposed page-budget resets, badge suppression and
  stale badge ownership, plus a missing filter tooltip label. Corrections follow
  the frozen behavior. Those failed outputs and acquisition failures are retained
  externally; no output normalization hides differences.
- Web typecheck, 33 existing focused Sidebar tests, boundaries, typography and
  conversation/activity checks pass. The Web build reports 791 runtime source
  files with zero browser-compatibility issues. Existing eight-scene recent-page
  and running-menu smoke checks pass.
- The unchanged existing thread-catalog smoke fails its `geometry[0]` long-path
  assertion on both the candidate and sealed original. Its fixture puts the long
  running row before review/error input rows, whereas shared task-flow policy
  displays attention rows first. An external diagnostic selects the exact long
  project identity instead; the original passes that geometry assertion and
  proceeds to a later Load-more timeout. The existing script is not reported as
  passing or changed to force a green result. Catalog loading/retry and paging
  have independent actual-component coverage in the frozen contract observer.

These are Web observations with synthetic public inputs. They do not establish
physical iPhone/Electron acceptance, live employee services or account/engine
behavior. Adjacent helpers, other Shell files and all eight unresolved source
groups retain their review status. Ordinary data, protocol/API names and behavior
references alone remain insufficient grounds for unrelated rewrites.
