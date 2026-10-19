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
