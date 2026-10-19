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
