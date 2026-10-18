# Source provenance review

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

The report is specific to that checkout. The mono2 and GitHub candidates differ;
a report for one cannot clear the other. Commit the eventual conclusion and its
evidence, rather than treating this generated file list as a rights opinion.

| Inventory group | Existing evidence | Current disposition | Work required |
| --- | --- | --- | --- |
| `codex-renderer-import-map` | `vendor/codex/IMPORT_MAP.json` links Shell, Composer, theme, conversation and right-panel targets to renderer recovery/adaptation | Unverified; retained for internal review | Establish applicable source rights, or independently replace affected expression while preserving OpenCraft behavior |
| `codex-shell-followup` | Source annotations in panel/sidebar animation, docking and history restoration | Unverified; behavior modeling and expression need separate review | Inspect each target and its lineage; record which implementation is original, licensed, replaced or excluded |
| `codex-stable-callback` | `packages/react-runtime/PROVENANCE.md`, exact dependency pin and full MIT notice | Current replacement is third-party licensed; former Git history remains unverified | Preserve notices in distributed artifacts and verify callback freshness/lifetime semantics |
| `codex-timeline-virtualizer` | `packages/timeline-virtualizer/PROVENANCE.md` | Unverified | Establish rights or independently implement against OpenCraft's requirements; verify scrolling, history prepend, measurement and restoration |
| `codex-timeline-adapters` | `packages/timeline-react/PROVENANCE.md` and `packages/timeline-host-web/PROVENANCE.md` | Unverified; these were missing from the initial machine inventory | Review the React ownership and Web measurement/reflow adapters individually; separate behavioral references, retained expression and original browser additions |
| `codex-tool-presentation-labels` | `CODEX_APP_TOOL_LABELS` annotation in `packages/chat-core/src/tool-activity.ts` | Unverified; found by the corrected source-marker check | Inspect the identified label/grouping table separately from protocol names, ordinary short labels and the rest of the tool presentation/extension implementation |
| `product-and-brand-assets` | Connector notices plus product/skill/native assets enumerated by the report | Unverified | Move private product assets downstream, check individual third-party distribution terms, and supply original upstream branding |

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

The stable-callback replacement has a recorded licensed source; the other six
groups remain unverified. The product scope remains
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

The Vela native icon and generated login mark were moved with their original
bytes to downstream `products/vela/native`, outside the public core tree. This
is a product ownership transfer. Original skill artwork and the TAT proxy Worker
likewise belong to downstream `products/vela/public`, explicitly selected only by
product builds. These moves do not authorize remaining connector marks or artwork,
or clear historical commits. The brand group remains unverified; its active core
paths now enumerate the connector marks, with removed product paths retained as
disposition evidence.


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
historical distribution, rather than the already moved Vela/Join artwork.
The group remains **unverified**. No asset, client feature or disposition is
changed, and none of the renderer groups is cleared by this finding.

## Licensed stable callback replacement (2026-10-18)

The small local stable-callback implementation was removed in favor of the exact
MIT-licensed `react-use-event-hook@0.9.6` dependency. The published archive was
verified against its registry integrity; [the package provenance](../packages/react-runtime/PROVENANCE.md)
records immutable source, archive hashes, platform assumptions, behavior tests
and notice delivery. This is a licensed replacement, not a claim of independent
authorship for an adaptation of the former recovered implementation.

The source inventory resolves only `codex-stable-callback` for the current
replacement. The other six groups, the former implementation and public-history
clearance remain unresolved. The repository stays private; no public release,
tag or npm publication follows from this disposition.
