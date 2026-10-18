# Tool surface presentation disposition

## Bounded source finding

Baseline `6394b66f7673af0f420adeef773685b9f3f5db56` retains a
source-identical MCP fallback annotation, computer-use and dynamic sentence
catalogs, native handoff summary sentences and an explicitly recovered progress
helper. [Exact bindings](tool-surface-sources.json) preserve the target-region
hashes and the inspected reference hashes; the former implementation is not
reproduced here.

The handoff helper's slicing, synthetic rollback and first-pending promotion
match the named reference implementation. The browser and script-title fallback
branches and step-message catalog are located separately. The computer-use
catalog's exact reference version remains unknown: its surrounding annotation
is a review concern, not proof that every label is copied. A single matching
literal does not classify the large dynamic-tool reference file either.
Redistribution rights for these references have not been established.

## Replacement requirements and method

The authoring inputs are OpenCraft's existing `ToolCallTimelineBlock`, execution
states, handoff result/step contracts and actual Web/Native consumers. The new
representation is operation title, optional context, and explicit phase. It
does not maintain per-operation active/completed sentence catalogs. Generic
identifier formatting preserves custom and future operation names. Existing
app identity resolution and bounded text details remain; browser context,
application display names, scroll direction and typed text remain visible.
Provider titles are display data, never execution status or authorization.

Handoff summaries independently identify the transfer, optional conversation
title, destination and reported phase, including queued and warning outcomes.
Progress consists of the reported step list with its reported states. Failure
does not manufacture a rollback operation, and pending is never promoted to
running by the view. Explicitly reported rollback remains visible. Step titles
derive from identifiers, with branch/destination context retained for the
operations that need it. Unknown step identifiers remain readable.

This replaces the representation and display-state policy, rather than
translating the former sentences. The author has inspected the reference during
review; **this is not a clean-room assertion**. The independent replacement
disposition applies only to these specified regions and their replacement,
not the whole files or historical Git commits. Parsers, navigation targets,
created-thread cards, protocol schemas, grouping keys and execution ownership
are retained. All Web/Electron/Expo clients remain in scope.

## Evidence and remaining work

The nine new tests in `tests/chat-tool-surface-state.test.ts` fail against the
unchanged baseline and pass after the replacement. They cover four execution
outcomes across five surfaces, future computer tools, process/display identity,
queued and failed handoff steps, explicit rollback, transfer outcomes and
branch/destination labels. Existing chat tests retain content envelopes,
registered presenter precedence, navigation and created-thread cards.

The real Conversation/browser fixture exercises mobile/desktop and light/dark
layouts, operation phase updates, transfer disclosures, reported step status,
navigation and created-thread callbacks. These are synthetic protocol fixtures,
not real external-engine or native-device sessions. Web/Electron builds and
workspace type checks are separate recorded validation steps.

The wider `codex-tool-surface-fallbacks` record stays **unverified**: source
annotations also remain around web-search compaction, command summaries,
content interpretation and specialized presenters. These require their own
actual-expression/lineage review, rather than treating a passing test or a
removed comment as clearance. Historical source and the four other unresolved
inventory groups remain separate. No repository visibility, Join deployment or
npm publication changes are part of this disposition.
