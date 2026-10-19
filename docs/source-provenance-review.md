# Source provenance review

## Neutral theme presentation correction (2026-10-19)

The built-in neutral theme is now presented as **Neutral**, with the description
"A neutral palette with light and dark appearances." The previous visible
`Codex` name and "OpenCraft's source-faithful neutral theme." description are
retained here as historical evidence and in the exact baseline record below.
Those phrases described an OpenCraft appearance preset rather than an execution
engine integration and could imply an affiliation or source status not established
by this review.

This bounded wording correction preserves the stored theme ID, palette, compiler
APIs, CSS variables and fallback behavior so existing appearance preferences keep
working. It does not classify or independently replace the theme implementation.
`codex-renderer-expression-followup` remains **unverified**, with the same nine
paths. Historical annotations, notices and source hashes remain available.

Validation: 13 existing appearance/material tests and Web typecheck pass. An
untracked Chromium probe renders the actual `SettingsContent` appearance page
with the existing theme-material fixture: light/dark at widths 1000 and 390,
including touch emulation at 390. All four cases show Neutral and the new
description, omit the old Codex theme choice, restore the existing stored ID,
switch away and back, and retain selection after reload with no page errors.
The narrow dark screenshot was visually inspected. This is Web evidence, not
native Electron/iPhone acceptance. The source-provenance inventory check passes
without changing any group's disposition. This presentation correction does not
establish distribution rights or release readiness.

## Additional explicit-source inventory coverage (2026-10-19)

The follow-up audit at `f979bb477180a2346d2e96dba21314eb7ff50f8c` found
16 source-lineage candidates missed by the previous scanner. The exact paths,
Git blobs and SHA256 values are retained in
[the baseline record](provenance/annotation-coverage-20261019.json).
Two additional **unverified** groups now cover them:

| Group | Review boundary |
| --- | --- |
| `codex-browser-source-followup` | Seven files: four browser implementation modules claiming copied bodies/identical helpers, their pinned source manifest, and two related toolbar/host contracts |
| `codex-renderer-expression-followup` | Nine files: theme presentation, activity/new-task glyphs, disclosure, panel/composer contracts, tool rendering and code-surface policy |

This raises the current unresolved group count from eight to **ten**. Earlier
counts below are dated snapshots, not the current total. No implementation is
reclassified or independently replaced by this inventory change. Some claims
refer to a bounded region or to behavior only; actual retained expression and
rights still require review. The theme's visible `Codex` name and source-faithful
description were identified here and later corrected in the presentation-only
change recorded above; its implementation remains unverified.

The scanner now catches explicit class/function-body claims, source-identical,
source-faithful and source-shaped annotations, reconstruction/restoration claims
and `ref/codex/` bindings, including JSON source manifests. Regression fixtures
start with an otherwise resolved inventory so an uncovered annotation cannot
silently report release readiness. Generic connection/focus recovery, ordinary
behavior comparisons, product names and Codex/ChatGPT protocol identifiers do
not become copy findings. The scanner remains a known-annotation inventory
check, not an exhaustive code-origin detector or legal review.

Validation: all ten source-provenance tests pass. Running the same new test
against the baseline scanner fails because it reports `releaseReady: true`.
The current inventory check reports no uncovered known annotations; `--release`
continues to exit with status 1 for the ten unresolved groups, as required.

All historical notices, source annotations and browser operations are retained.
The existing Agent Activity replacement is still in progress separately;
this change does not claim it is complete. No application UI, protocol, runtime
or deployment behavior changes in this follow-up.

## Turn user-message normalization replacement (2026-10-19)

[The complete normalization module](provenance/message-normalization-replacement.md)
has a bounded requirements-first independent replacement record. Its historical
blob remains in partial dispositions. Agent Activity is the remaining unverified
path in the chat-semantics group; all eight unresolved source groups remain open.
Message identity, Composer content ownership, Host-staged file presentation and
local steering acknowledgement are retained. This does not clear the consuming
renderer, source history, other modules or distribution rights.


## Realtime transcript replacement (2026-10-19)

[The complete realtime transcript parser](provenance/realtime-transcript-replacement.md)
has a bounded requirements-first independent replacement record. Its historical
blob remains in partial dispositions. Agent Activity and user-message
normalization remain unverified in the chat-semantics group, and all eight
unresolved groups stay open. The Web/Electron voice renderer uses the generic
Assistant speaker label; engine integration identifiers remain intact. This does
not reclassify that renderer or clear historical code or distribution rights.


## MCP elicitation replacement (2026-10-19)

[The complete shared elicitation module](provenance/mcp-elicitation-replacement.md)
has a bounded independent replacement record for metadata, field normalization,
drafts, validation and display values. Its historical blob remains in the chat
semantics partial dispositions. Agent Activity, realtime transcript and message
normalization remain unverified in that group; all eight unresolved groups remain
open. Existing Web/Expo contracts, protocol identifiers and working integrations
are preserved. This does not reclassify the consuming UI, historical code or
other recorded sources.

## User message semantics and Web layout (2026-10-19)

[The two complete modules](provenance/user-message-replacement.md) now have a
bounded independent replacement record. Their previous paths and Git blobs are
retained as partial dispositions. Four other files in the chat-semantics group
remain unverified, and all eight unresolved groups remain open. Wrapper parsing,
Goal display and typed attachment/status layout use the frozen requirements;
protocol constants and working integrations remain. This disposition neither
clears historical code nor asserts strict clean-room separation.

## Turn diff summary replacement (2026-10-19)

[The complete turn-diff summary module](provenance/turn-diff-replacement.md) now
has its own bounded replacement record. Its historical path is retained as a
partial disposition of `codex-chat-semantics-followup`; the other six files in
that group stay unverified. The three-group, 15-file inventory snapshot below
is historical: replacing one file does not retire any unresolved group. Eight
unresolved groups still block source-provenance release readiness.

The requirement commit precedes implementation. Tests and black-box observations
cover summaries; actual browser probes cover the synthetic change-card fixture.
The unchanged full visual smoke also fails on baseline (header geometry), as
recorded in the disposition. No strict clean-room or legal clearance is claimed.

## Continuing independent replacements and inventory coverage (2026-10-19)

The owner now requests continued clean-room-style work and normal upstream
integration. Targeted requirements-driven replacements are active; preserve
complete clients and working integrations. Each record must state actual author
exposure. No strict clean-room separation or redistribution-rights conclusion
follows merely from a new implementation, test pass or annotation removal.
Historical migration exclusions remain historical; they do not cancel this task.

[Skill path replacement](provenance/skill-path-replacement.md) records the
accepted bounded replacement. Hook statistics have their own requirements-first
PR/disposition; its actual acceptance and current inventory entry must be checked
separately. Neither is permission to reclassify unrelated modules.

The coverage follow-up is based on `c4d9915554708e04e1ec1d1c92177e166927712c`.
The previous marker pattern missed `Source-equivalent` and semantic-adoption
annotations; it also omitted plugins and JavaScript files. A regression fixture
with an otherwise resolved manifest and untracked annotated source incorrectly
reported `releaseReady: true` before the fix. The scanner now requires those
annotations to be inventoried, including specific recovery assertions. Mere
product names, ordinary behavior comparisons and statements that a module is
independent from the recovered renderer do not trigger a copy finding.

The following three groups add 15 previously untracked review candidates after
the separate skill-path and hook-statistics replacements. These are annotation
boundaries, not conclusions that all code in each file was copied:

| New unresolved group | Actual scope | Next review |
| --- | --- | --- |
| `codex-chat-semantics-followup` | User-message Web layout, activity/Thinking ownership, MCP elicitation, realtime transcript, turn diff, user-message normalization and wrapper parsing | Fix public requirements and actual input/output contracts per module, establish lineage, then replace or license only bounded expression |
| `codex-document-streaming-followup` | Markdown compilation/preprocessing and streaming segment identity | Separate standard Markdown behavior from source-specific tokenization/reconciliation; verify complete rendered documents and streaming identity |
| `codex-client-host-followup` | Lab journal, hook projection, interrupt cleanup, dictation footer and panel geometry | Distinguish reference-inspired observations from retained expression; preserve runtime cancellation, dictation and layout behavior |

With these additions the earlier “five unverified groups” is a historical count,
not the current complete total. The manifest/report is the authority for current
membership and status. The new records deliberately remain unverified; the
release check still refuses an unresolved inventory. This fixes a demonstrated
coverage gap, not the general limits of keyword scanning. Code without a marker,
unidentified references and historical commits still require separate review.

## Keyword and source-risk cleanup (2026-10-19)

The current request resumes targeted source-risk review of Codex, ChatGPT, BB
and Paseo references in the GitHub upstream. Preserve working integrations and
the complete client. The earlier removal of cleanup from the migration
prerequisites remains a historical migration decision; it does not resolve the
outstanding inventory or prevent this separate cleanup. Blanket rewriting is
still outside this bounded pass.

The reviewed baseline is `13498b18b258fb7f4a95d7de6d98e8e3b712706d`.
Case-insensitive searches of tracked source and documentation distinguish:

| Occurrence | Treatment and remaining evidence |
| --- | --- |
| Codex engine adapters, ChatGPT authentication, provider endpoints and generated AppServer protocol | Retained compatibility interfaces. Do not rename wire values, account headers, credential fields or durable identifiers as cosmetic cleanup. A valid integration name does not establish rights in other implementations. |
| Generic command/network approval prompts and automatic-review fallback summaries | Remove the hardcoded ChatGPT identity. Fallback review summaries now derive from the reported review status, with separate approval and denial outcomes; a supplied rationale still takes precedence. This is a bounded presentation change, not disposition of a recovery inventory group. |
| BB and Paseo comments, design comparisons and source records | Retained as review evidence. Current keyword matches do not establish imported expression, its license, or independent authorship. Review actual lineage before changing their disposition; deleting the names would not establish rights. |
| Codex renderer recovery/adaptation annotations and import map | Retained. Five inventory groups remain unverified: renderer import map, shell follow-up, timeline virtualizer, timeline adapters and tool-surface fallbacks. The first follow-up should inspect the mapped Shell/Composer/theme/conversation targets and their pinned source bindings, then the timeline packages and remaining tool regions. |
| Existing third-party licenses, notices, excluded artwork records and historical source bindings | Retained. Neither a text edit nor a passing integrity check clears historical source or distribution rights. |

Authoring inputs for the new fallback summaries are the existing
`AutomaticApprovalReview.status` and `rationale` fields; for approval prompts,
the existing command/reason and network destination fields. No external reference
implementation is introduced by this pass. Tests cover all five review states,
blank versus supplied rationale and the replica's default command prompt.
Existing network projection tests continue to verify protocol-supplied titles.
This does not assert clean-room development or classify either entire module.

`check-source-provenance.mjs` validates inventory integrity. Its `--release`
mode still reports the five unresolved groups; this pass changes none of their
statuses. No license grant, repository visibility change, release, npm publication,
history rewrite or downstream deployment is part of this cleanup. Actual rights
assessment remains separate from keyword counts and software tests.


> Historical source inventory. On 2026-10-18 the owner removed source cleanup
> from the migration scope. No further replacement work is required for the
> GitHub upstream cutover; existing records are retained without changing their
> unresolved status. See [the current decision](upstream-transition.md#current-delivery-decision-2026-10-19).

The current decision is **unverified: inventory and resolve before public
redistribution**. Apache-2.0 is the intended license for original OpenCraft
contributions; it does not establish rights in recovered implementations,
third-party code, artwork or trademarks. References to behavior alone do not
establish that a whole file is copied either. Review actual expression and
lineage before reaching a conclusion.

The machine-readable inventory is
[`config/source-provenance.json`](../config/source-provenance.json). Generate
the exact file list and SHA256s for the candidate being reviewed:

```sh
node scripts/check-source-provenance.mjs --json > provenance-review.json
node scripts/check-source-provenance.mjs --release
```

The report is specific to that checkout. The public and downstream candidates differ;
a report for one cannot clear the other. Commit the eventual conclusion and its
evidence, rather than treating this generated file list as a rights opinion.

| Inventory group | Existing evidence | Current disposition | Work required |
| --- | --- | --- | --- |
| `codex-renderer-import-map` | `vendor/codex/IMPORT_MAP.json` links Shell, Composer, theme, conversation and right-panel targets to renderer recovery/adaptation | Unverified; retained for internal review | Establish applicable source rights, or independently replace affected expression while preserving OpenCraft behavior |
| `codex-shell-followup` | Source annotations in panel/sidebar animation, docking and history restoration | Unverified; behavior modeling and expression need separate review | Inspect each target and its lineage; record which implementation is original, licensed, replaced or excluded |
| `codex-stable-callback` | `packages/react-runtime/PROVENANCE.md`, exact dependency pin and full MIT notice | Current replacement is third-party licensed; former Git history remains unverified | Preserve notices in distributed artifacts and verify callback freshness/lifetime semantics |
| `codex-timeline-virtualizer` | `packages/timeline-virtualizer/PROVENANCE.md` | Unverified | Establish rights or independently implement against OpenCraft's requirements; verify scrolling, history prepend, measurement and restoration |
| `codex-timeline-adapters` | `packages/timeline-react/PROVENANCE.md` and `packages/timeline-host-web/PROVENANCE.md` | Unverified; these were missing from the initial machine inventory | Review the React ownership and Web measurement/reflow adapters individually; separate behavioral references, retained expression and original browser additions |
| `codex-tool-presentation-labels` | Historical exact bindings and [bounded disposition](provenance/thread-tool-presentation.md) | Identified native table replaced by protocol-derived operation titles and explicit states | Keep navigation/results and verify failure/interruption; this is not whole-module or historical clearance |
| `codex-tool-surface-fallbacks` | [Exact source/target bindings and bounded replacement](provenance/tool-surface-disposition.md) | Known fallback catalogs and handoff inference replaced; wider annotated regions remain unverified | Review web-search compaction, command summaries, content interpretation and specialized presenters individually |
| `product-and-brand-assets` | Retained exact-source hashes and [artwork disposition](provenance/connector-artwork.md) | Current image files excluded; private product artwork downstream; historical rights unverified | Verify no image files/imports remain in source and distributable assets; retain source notices and full connector operations |

## Recording a resolution

Keep the inventory ID and historical source evidence. A resolved record needs
an explicit conclusion and evidence for that conclusion:

- `original`: establish the implementation's independent origin. A new header
  or deleted recovery comment is insufficient.
- `third-party-licensed`: identify the exact source/version, applicable license
  or authorization, distribution scope and required notices. Preserve those
  notices in the source and shipped artifacts.
- `independently-reimplemented`: record the replacement commit, its public
  requirements/contracts, authoring method and behavior verification. Renaming,
  reformatting or mechanically translating the recovered code is insufficient.
- `excluded`: remove the implementation/assets and their imports, generated
  copies and packaged outputs from the public candidate. Keep the disposition
  evidence and validate the remaining client; removing functionality requires
  an explicit product scope decision.

The stable-callback replacement has a recorded licensed source and the connector
brand images are excluded from current core; five other groups remain unverified.
The product scope remains
**preserve the full Web/Electron/Expo client**. The earlier recommendation to
replace all unverified client modules is **paused** (2026-10-17), following the
user's question about why rewriting was necessary. Unverified source rights do
not establish that rewriting is necessary. Existing isolated replacement
candidates must not be integrated on the strength of that earlier recommendation.
A Headless-only first release is not the selected scope.

Review source-specific evidence first. Keep implementations that are original
or appropriately licensed, along with the required notices. Only consider
replacement for a specifically identified scope whose retained expression
cannot be cleared; establish that scope before proposing the replacement.
The disposition labels above describe possible evidenced outcomes, not standing
instructions to rewrite. The 2026-10-18 scoped treatment authorization permits
replacement of specifically bounded uncleared expression while preserving the
complete client; it does not resume blanket rewriting or grant third-party
rights. Product dependency isolation can continue separately.

## Source-specific review boundary

The import map supplies fixed module paths and SHA256 values. Matching a local
reference file to that hash proves which reference was recorded; it does not
prove redistribution rights or how much expression remains in today's target.
Similarly, a provenance note that describes behavior is not a finding that the
entire implementation was copied.

The two adapter packages require separate inspection:

- `timeline-react` describes stable callback dispatch, pagination generations
  and geometry deduplication as behavioral references. Review its actual React
  implementation and changes, not just the names of those mechanisms.
- `timeline-host-web` records recovered behavior for measurement, reflow and
  scrolling, but explicitly identifies the VisualViewport keyboard adapter as
  an OpenCraft browser addition. A package-level inventory entry records the
  review boundary; it does not classify every file as adapted expression.

The tool-activity annotation identifies a label/grouping table, not the entire
tool-activity module. Locate its source before assessing retained expression;
the presence of a protocol name or ordinary short label alone does not supply
that assessment.

For each retained implementation, record the exact source/version and target
revision, applicable license or authorization and required notices, plus the
conclusion about retained expression. Where that evidence is missing, keep the
status unverified rather than selecting a remedy automatically. No finding
about the current tree clears historical commits by itself.

## Checks and limits

Inventory checks reject missing evidence and known untracked recovery
annotations. Release checks additionally reject unresolved groups. Secret
scanning and dependency audits are separate checks; passing them does not
establish redistribution rights. After resolution, inspect the actual source
history, generated assets and final archives before changing repository
visibility or publishing a release. Historical commits are not cleared merely
because the latest tree has been replaced.

The the downstream product native icon and generated login mark were moved with their original
bytes to downstream `products/<product>/native`, outside the public core tree. This
is a product ownership transfer. Original skill artwork and enterprise service proxy Worker
likewise belong to downstream `products/<product>/public`, explicitly selected only by
product builds. These moves do not authorize remaining connector marks or artwork,
or clear historical commits. The later bounded artwork disposition excludes the
remaining connector image
files from current core. Exact historical source hashes and removed product
paths remain as disposition evidence; historical rights are still unverified.


## Pinned reference follow-up (2026-10-18)

[Source reference bindings](source-reference-bindings.json) pins nine local
reference modules by recovery build/partition path and SHA256 against the
accepted source tree `b1366cf67fa0bb02d21b7c5ecb087eb9cff7e19a`.
The previously relative r1501 Web-adapter files and the r1973 tool-label source
are now located. These identifiers locate the reference files; their mapping
to an exact distributed Desktop application version remains unverified.

The identified `CODEX_APP_TOOL_LABELS` table has 21 label values, found in the
pinned activity message/renderer modules. The activity registry also locates
its handoff, status, list and read grouping flags. This is a table-specific
source finding; it does not classify the whole tool-activity implementation.

The current Web reflow adapter adds explicit completion/cancellation and layout
settling to the earlier timeout behavior. Its legacy helper retains the 250ms
bounded duration. The public-hook callback omits the reference's private React
dispatcher probe. These differences help bound the review; neither establishes
independent creation or a distribution license. The documented browser
VisualViewport addition remains separate from the Electron baseline.

At that reference-only review, all seven groups remained **unverified**. No recovery implementation was copied
into the report, removed, replaced or relicensed. The README no longer labels
the workbench a cleared clean-room implementation: that claim was not supported
by the retained source records. Complete clients remain the selected scope and
blanket replacement remains paused.

## Connector asset source verification (2026-10-18)

[Connector brand sources](connector-brand-sources.json) records all 23 PNG/SVG
marks in the current core at review commit
`0cea4c95aced0a57f513989ffc1daf930e930fe6`. Each is byte-identical to its named
path in Octop commit `ae65fe4e26854d2eaf751cee89341ec5d71569f0`.
The MIT license text at that exact source commit matches the notice already
retained in `packages/connector-core/NOTICE.md`.

This verifies the recorded origin and retained repository license; it does not
establish each brand owner's authorization or trademark distribution scope.
The remaining review for this group concerns those individual marks and any
historical distribution, rather than the already moved the downstream product/managed site artwork.
At that reference-only review the group remained **unverified**. The finding
did not change assets, client features or disposition, or clear any renderer
group. The subsequent bounded exclusion is recorded below.

## Licensed stable callback replacement (2026-10-18)

The small local stable-callback implementation was removed in favor of the exact
MIT-licensed `react-use-event-hook@0.9.6` dependency. The published archive was
verified against its registry integrity; [the package provenance](../packages/react-runtime/PROVENANCE.md)
records immutable source, archive hashes, platform assumptions, behavior tests
and notice delivery. This is a licensed replacement, not a claim of independent
authorship for an adaptation of the former recovered implementation.

The source inventory resolves only `codex-stable-callback` for the current
replacement. At that point six other current groups, the former implementation
and public-history clearance remained unresolved; the subsequent artwork
exclusion below reduces the current unresolved groups to five. The repository
stays private; no public release,
tag or npm publication follows from this disposition.

## Connector artwork exclusion (2026-10-18)

The bounded asset review identified exactly 23 unchanged connector marks, not
the service catalog or connector runtime. Those image files and their glob loader
are removed from the current core. Licensed Lucide category icons replace their
decorative slots; all service names, recipes, search, setup and connection
operations remain. [Disposition and checks](provenance/connector-artwork.md)
retain the original attribution and link to the exact asset hashes. This
exclusion does not clear old Git commits or grant any brand rights. Five current
source groups still require review; full clients remain the selected scope.

## Native thread-tool table disposition (2026-10-18)

The identified 21-value native thread label table has been removed in favor of
protocol-derived operation titles with an explicit execution phase, with worktree
context and provider display titles separate. Failure/interruption does not
reuse a successful sentence or an earlier transfer progress state. Existing
navigation, result cards and disclosure capabilities remain; the bounded
[implementation disposition](provenance/thread-tool-presentation.md) records
method, functional requirements, historical hash and verification. No clean-room
or whole-module rights conclusion is claimed.

Expanded review found other explicit source-identical MCP fallbacks and recovered
handoff-step behavior outside that table. The new unresolved
`codex-tool-surface-fallbacks` group retains them. Therefore **five current groups
still require review** despite the native table replacement. The previous
table-specific finding was not a complete review of the tool presentation file.
Historical commits and public redistribution remain unresolved.
