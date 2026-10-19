# Agent Activity replacement

## Requirements fixed before implementation

Replace the complete `packages/chat-core/src/agent-activity.ts` module at baseline
`f979bb477180a2346d2e96dba21314eb7ff50f8c`, historical Git blob
`28b420f360a72989763db126b1491f2593e940de`, SHA256
`b6664198e2096a3c1d168accc41d8a39f1b6c20b412593215233d6f63ed8a18f`.
All 15 exported functions and public types are in scope, not just annotated
regions. Retain old recovery/source-equivalent evidence in the inventory.

Authoring inputs: AST-extracted imports, public types/signatures/defaults and
associated declaration comments (no function bodies), current consumer/data
contracts, existing tests/documentation, and black-box OpenCraft observations.
Existing public tool-presentation, reasoning, work-status and projection helpers
remain dependencies; this replacement does not reclassify them. No recovered
Desktop/BB/Paseo implementation or old module function body was opened to author
this replacement. The author previously inspected other recovery-related code;
this is requirements-driven independent implementation, not strict clean-room
separation, historical rights clearance or a distribution authorization.

1. Preserve renderer-neutral exports, data shapes and source/slot identities.
   Do not mutate input frames, blocks, turn chronology, persisted choices or
   execution state. Presentation never performs I/O, dispatch or authorization.
2. Classify work observations separately from visible rows. Commentary, returned
   reasoning, tool execution, subagents, realtime transcripts, compaction and
   review observations retain their respective semantics. Suppressed/status-only
   tools and empty/opaque reasoning must not manufacture visible rows.
3. Consecutive groupable tools share a first-source group key. Semantic rows and
   nonempty reasoning separate inner groups; empty reasoning is transparent.
   Completed single tools may use standalone presentation with that same key.
   Only the latest visible unit of an open slice can carry a live lifecycle;
   actual running tools or exploration own active text, otherwise a live group
   can own Thinking. Preserve registry, skill/detail and dynamic-suffix contracts.
4. Header summaries use the existing tool presenter contract for active tool
   state and an ordered, deduplicated set of completed facts: sources, changed
   files, exploration, commands, web search, images, dynamic operations and other
   tools. Keep accessible natural-language joining, source identities and stable
   summary keys distinct from changing display text. Status closure must prevent
   an old running observation from claiming current feedback.
5. Preserve four partition regions: pre-toggle leading realtime transcript,
   persistent later handoffs and qualified MCP App surfaces, collapsible work,
   and ordered expanded content. Extract worked-for metadata once. MCP App
   persistence requires both the feature choice and a real renderer capability;
   a host lookup may resolve its surface. Never duplicate a persistent row.
6. Disclosure eligibility requires meaningful work, a qualifying adjacent final
   answer and a non-cancelled Turn. Execution terminal state, user input, async
   delivery, questions, images or unphased text do not grant collapse. Explicit
   choice overrides automatic defaults; force/prevent/disable constraints are
   temporary and never write a choice. No-toggle layouts show full ordered work.
7. Build the outer plan in source order. User/interaction/content boundaries end
   a work segment without ending execution. Final eligibility cannot cross such
   a boundary. Actual reasoning stays inside one contiguous response work owner,
   with independent Item-keyed disclosures. Preserve before/after-final phase,
   stable boundary-based keys, one inline subagent surface and latest plan/todo
   selection. A Turn change-summary resource stays outside ordered work slots.
8. Assign Turn work-status metadata/duration to one meaningful segment, without
   inventing times or allowing hidden trailing reasoning to steal ownership.
   Working metadata precedes content; completed metadata follows it. Cancellation
   retains visible work and does not inherit an automatic historical fold.
9. A complete Turn retains only its contiguous initial user frames as the intro;
   later user/interaction blocks remain ordered in a synthesized assistant
   surface. Retain provenance frames/anchors and auxiliary-frame contracts.
   Latest live todo selection is independent of Markdown/presentation building.
10. Arbitrate at most one current-response Thinking owner: live returned reasoning,
    a live activity group, or a Turn fallback. Older/closed work cannot keep a
    second owner. Pending Composer interactions, active tools/compaction/todo and
    final content constrain fallback; incomplete proposals use Planning. Only
    the most recent live Turn can mount transient feedback. Count actual top-level
    display slots independently from storage frames and invisible metadata.
11. Verify all exports with black-box matrices across statuses, boundaries,
    registries, content arrival, lifecycle/partition flags and persistence choices.
    Use existing activity/disclosure/reasoning/work-status/projection tests plus
    focused regressions. Typecheck core and Web, check package boundaries and
    inventory integrity. Exercise actual Conversation/Activity components in
    narrow/wide, touch/mouse and light/dark fixtures, including expansion choices,
    streaming/prepend continuity, ordering, one Thinking owner and work clocks.
    Synthetic transport fixtures do not establish live-engine/native acceptance.

This bounded replacement may retire the current chat-semantics group only after
its final path is actually replaced and verified. Preserve all prior partial
records, notices and source bindings; the other unresolved groups and historical
rights remain unresolved. No release, npm publication or downstream deployment
is authorized by this disposition.
