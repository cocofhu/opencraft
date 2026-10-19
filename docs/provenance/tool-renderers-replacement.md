# Tool, image and subagent presentation replacement

## Frozen authoring scope

Replace the entire `apps/workbench-web/src/components/conversation-renderers/tool/tool-renderers.tsx` module. All six exports stay available: `JsonPreview`, `ToolCallBlock`, `ImageViewToolBlock`, `GeneratedImageBlock`, `SubagentBlock` and `SubagentActivityGroup`. This continues the request to remove unused/legacy implementation and incorrect branding while retaining working integrations. It does not remove Codex, ChatGPT or protocol compatibility identifiers.

### Baseline and exposure

The authoring base is `19838b22bc8dd2e81ec5b39f6df8d17c084b71a9`; the target Git blob is `d6200896dc5afdd8c0c58282530415375841f0dc`, SHA-256 `a19244add61528fc1d9d11fb3786afa02add39afb09fa01252d6a36fc1c7c81e`. Declaration-only emission, import declarations and consumer import sites were read; the target implementation body was not printed for this task. The public declaration includes the historical “Source-faithful standalone ImageView” annotation, which is retained as evidence, not adopted as the new implementation's claim. Other modules and shared dependency implementations have already been visible in this long-running session. This is not strict author isolation and does not clear historical rights. Licenses, notices and original history remain.

## Requirements before implementation

1. Preserve all six component signatures and their actual Conversation/Agent Activity consumers. Timeline/core own semantic classification, normalized content, subagent state, order and grouping; this module owns presentation and mounted View choices only.
2. Tool activity uses the existing presenter registry and optional product-owned content/icon renderers. Missing optional widgets must preserve useful core content; a claimed custom result must not trigger duplicate rendering or calls. Running/completed/failed/interrupted and missing result states remain distinguishable. Rendering never executes tool input or grants approval.
3. Retain typed tool content: text, structured data, images, audio, resource links and embedded resources. Workspace/file navigation uses existing document/resource ports; URL parsing does not authorize filesystem reads or arbitrary navigation. Nested WebMCP information and engine-provided thread creation/handoff/navigation keep their current semantics.
4. Image-view contiguous groups and generated images consume the shared conversation-media decision and Host loader. Host/conversation/cwd/document identity prevents stale images or galleries across scope changes. Loading/unavailable states, click/keyboard preview, dismissal and measurement notifications must preserve working behavior. No browser-local file conversion or new network authority.
5. Subagent individual/group views consume core summaries and status. Opening a child conversation requires the current navigation port; it preserves thread IDs/display names. Expanding activity changes no domain state or execution ownership.
6. Preserve user choice and stable DOM through streamed updates, asynchronous media resolution, theme/input changes and completion. Existing disclosure/modal/shared typography/activity controls remain owners of focus, geometry, animation and lifetime. No new global state, persistent cache or duplicated execution state.
7. Preserve the current observable labels, accessibility and product resource/copy/navigation callbacks in finite baseline observations, except any specifically documented generic licensed artwork replacement. Historical provenance words are evidence, not user-visible brand endorsements.
8. Use existing checks and public behavior observations. Do not add committed tests or harness. Verify Web types/boundaries/provenance, relevant existing tool/subagent/media checks, actual desktop/mobile light/dark interaction, release Web build and browser compatibility. Record failures and limitations; simulated events do not prove paid inference, real account authentication or native hardware.
9. Change source disposition only after the entire module is replaced and verified. Unchanged helper modules and the remaining source groups stay unresolved. Normal PR acceptance, fixed downstream consumption, actual Join deployment and any patch retirement are separate facts.

## Owner ports already identified

Public consumers are `conversation.tsx` and `activity/agent-activity-renderers.tsx`. Shared contracts include `ToolActivityPresentation`, `ToolCallContentPart`, `WebMcpToolSurfaceCall`, Timeline images/tool calls/subagents and `SubagentActivityRenderUnit`. Existing ports include presenter/content/icon contexts, conversation document/media hooks, resource resolution, core subagent/thread-handoff derivation, ActivityDisclosure and ModalSurface. Their continued use does not classify their source status.

## Next evidence

Capture executable baseline presentation/interaction contracts before authoring, supplementing these requirements with observed details rather than reconstructing old source. Whole-module implementation, exact exposure accounting and finite verification results remain pending.

## Frozen executable observations before authoring

On the unchanged target, 48 public operation samples and 21 additional interaction states were recorded, with no page errors in those completed traces. Existing tests also pass: 25 tool/thread/media checks, four actual Conversation thread-tool scenes, sent-image preview/dismissal in an embedded root, and eight activity metrics scenes. These are old implementation baselines, not replacement acceptance.

- Generic tool activity initially folds in the sampled cases, derives status from the shared presenter, and shows output/error parts without repeating input JSON. The raw-output button opens a ModalSurface containing the call/invocation/duration/result envelope; it is not an inline raw/pretty toggle. Escape closes it. A custom renderer returning `null` claims an intentionally empty body, while an absent renderer uses core output. Product icons remain separate.
- JSON null renders nothing; false and zero remain visible; strings remain unquoted, structured objects use formatted JSON. Text/resource/audio/image/embedded-resource and structured result samples retain their typed forms.
- One inspected-image activity says Viewed an image, plural samples use the count; active samples say Viewing. A missing image path has an inert summary. A thumbnail sends the shared file decision to the resource port (observed `/work/a.png` → `file:///work/a.png`) rather than navigating a browser-local file.
- A generated image uses URI or the existing saved-path/media resolution. Missing sources render nothing in the sampled statuses, including a supplied failure value; that absence is not evidence of a separate generated-failure widget. Preview opens the existing modal gallery by default; product preview/edit callbacks remain distinct. Image loads notify the measurement owner.
- Individual/group subagent rows consume core-derived action, agent and aggregate status, keep navigation IDs/display names and retain reasoning/path/message detail in disclosures. An absent navigation callback supplies no new authority. Browser-surface WebMCP calls own a nested disclosure independent of the parent tool's body.

Preliminary observation failures are retained: a 1×1 fixture placed the generated Edit affordance outside its usable preview area, so the fixture now uses a 320×180 PNG and an explicit scroll container; the raw-output probe initially assumed an inline toggle and then attempted a blocked background click, corrected to observe the actual modal and dismiss it; an initial thumbnail locator timed out and the existing public preview selector completed the operation. No product code or assertions were changed to manufacture these baseline results. Finite samples, synthetic models/IDs/images, motion settling and missing external services remain limits.

The normal merge `35b4a34` brings accepted main `c80d180` into this feature; the six-export target blob remains the recorded baseline. No part of the target implementation body has been printed or used as authoring text in this task. Public DOM/class observations and unchanged helper implementations were visible. The full module remains unchanged and unresolved until the replacement and its acceptance are actually complete. No tests/harness are committed.


## Whole-module authoring and compatibility refinements

The six-export module is now wholly authored in the feature, using the frozen requirements, declaration/consumer contracts, rendered DOM and unchanged shared ports. It owns tool detail/disclosure presentation, typed content, raw-output modal, semantic thread-tool views, inspected/generated image controls and subagent individual/group presentation. Core still owns summaries, semantic classification, agent/group state and reported handoff steps; Host ports retain resource bytes and navigation authority. Product renderers returning null intentionally claim an empty body. WebMCP disclosures are independent siblings of their parent tool disclosure. Generated previews are scoped by Host/conversation/cwd/document/source, and the existing media loader owns abort and release.

Subagent avatars use a newly authored stable identity-to-hue calculation; this is a bounded decorative color assignment change, not a new identity or status authority. Existing licensed glyphs, shared activity metrics, CSS and modal/disclosure controls remain owners. No old target implementation body was printed or read as authoring text; the whole-file replacement was written without opening it. Other shared implementations and public rendered HTML were visible as previously recorded, so strict author isolation is not claimed.

Initial replacement observations found and corrected missing disclosure for custom null content, resource-link copy, unnecessary shimmer in inspected-image/subagent labels, repeated historical group prompts and parent-coupled WebMCP detail. The completed 48 + 21 + 6 public observation samples have matching operation labels/text and no page errors. This finite comparison is not a byte-identical DOM or universal behavior claim. Stable callbacks, alternate input events, native rasterization and real external integrations still require their own evidence.

After initial authoring, nine supplementary executable observations of the immutable baseline were added for created/pending thread cards, five handoff results and missing MCP App capability. The original file was supplied only to the local Vite compiler from the pinned Git object; its implementation was not printed or inspected. These late observations are compatibility refinement, not inputs falsely described as frozen before authoring. They showed that handoff headings must come from the current presenter and only reported steps belong in the body, rather than a second UI summary/error policy. Created cards preserve their Open chat accessible name and provisional identities. Supplemental acceptance is recorded separately below.

Existing checks completed on the replacement include 25 tool/thread/media tests; Web type checks; typography/platform boundaries; four actual Conversation thread-tool scenes; eight activity metrics scenes; sent-image preview/dismissal; and a release Web build with 791 runtime source files and zero browser compatibility issues. Four additional untracked narrow/wide light/dark interactions cover raw modal dismissal, inspected-image resource decisions, generated gallery close and scope invalidation, streamed subagent collapse retention and navigation. Screenshots were inspected. The first added interaction probe had an ambiguous case-insensitive Reviewer/reviewer locator; an exact accessible-name selector completed all four cases. No product code or assertion was weakened to address that probe error.

No new tests or harness are committed. Local observations, build logs and screenshots are working evidence; this document retains their finite scope. Actual employee authentication, paid model calls, native hardware and public distribution rights are unverified. Source disposition, normal PR acceptance, fixed downstream consumption and actual Join deployment remain separate events.


The supplementary nine rendered baseline/replacement samples now match text,
button labels and disabled state with no page errors. They cover three created/
provisional cards, queued/running/success/warning/error handoff results and an
MCP App URI without a Host capability. The final native thread-tool Conversation
matrix passes all four narrow/wide light/dark cases after using shared presenter
summary/icon ownership. Ten existing provenance tests pass. This bounded result
does not classify the reused tool-activity/codex-app-tools or MCP App modules.


## Current implementation disposition

Implementation commit: b64058e2cb6b5c79368f1ec706806e757a3c2c81; target blob: 14f5ed97bed38617d23bc7319c482c17d750e6d6. Requirements precede this
commit at 6e2b726 and executable contracts at 3277167. This resolves only the final
current path in codex-renderer-expression-followup, retaining all eight earlier
partial dispositions and the exact baseline. Eight other inventory groups remain
unverified; licenses, notices and historical records remain unchanged. Upstream
acceptance and Join consumption/deployment are not claimed by this disposition.
