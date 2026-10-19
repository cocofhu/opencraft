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

## Implementation and compatibility disposition

Requirements were committed as `ac746b5e17de90a45c532f01816d30ac0af8edf5`
before the replacement implementation at
`e424ac1cfd8478b582583ba6a9b9b153c95bb96d`. The complete module, including
all 15 exports, is now independently authored within the input/exposure boundary
above. Public declarations are retained as compatibility contracts. The author
also inspected existing dependency implementations for reasoning content,
conversation/tool presentation and presenter registry behavior while verifying
those contracts. Those dependencies are not reclassified by this replacement.

The implementation first collects ordered response-work slices, then projects
inner groups/reasoning and partition regions, then assigns one Turn work clock.
The Turn parent selects a Thinking owner before requesting the active reasoning
presentation, so it does not parse the active body twice. Source frame objects
remain unchanged. An explicit user choice still controls eligible disclosures;
chronological closure alone cannot make a fold eligible.

Observed compatibility refinements include:

- Deduplicate changed paths in completed summaries. Keep provider source identity,
  Chrome/browser semantics and presenter suppression separate from display text.
- Preserve the dynamic suffix bridge, including running registered dynamic calls.
  Summary-only standalone polls are absent; groupable polling can contribute a
  live group without creating a retrospective standalone row.
- MCP App persistence requires the enabled feature and actual renderer capability,
  an MCP call with an available/loading result, and a real resource or host
  resolution. Terminal calls with no output do not invent a persistent surface.
- Count work-status metadata once in the general content count and in standalone
  layout, but exclude it from the outer collapsed work count. A clock-only surface
  cannot grant an outer toggle. Persistent/pre-toggle rows keep their ownership.
- Client-owned interruption replaces a stale working interval with the established
  stopped interval; remote interruption does not synthesize it. A hidden final
  slice with unknown timing cannot transfer a Turn duration back to older work.
- Keep storage frames/anchors, one inline subagent surface, latest todo/proposal
  selection, the independent change-summary resource and stable source-based slot
  identities. Historical mounted Turns cannot claim a transient Thinking owner.

### Verification scope

Three local black-box matrices exercise the old public module and the new one
without reading the old function bodies. They contain **56,954 comparisons**:
30,872 generated ordered/status/parent/header comparisons, 14,562 clock,
partition/layout/disclosure comparisons, and 11,520 provider-registry/tool-surface
comparisons. The deterministic generated sequence seed is `752359`; sequences
contain up to six Items. Status matrices include pending, streaming, complete,
failed and interrupted where applicable. Clock/choice/capability matrices include
unknown and known intervals, client interruption, explicit persistence choices,
custom groupable/standalone/suppressed presenters and dynamic bridge hints.
All compared outputs match. The exploratory harnesses and run outputs remain
ignored local artifacts, not CI gates; the committed focused tests and browser
scripts are the reproducible acceptance checks. These finite observations are
compatibility evidence, not a proof of every possible input or source rights.

The three focused contract tests cover repeated changes to one file, standalone
clock visibility without collapse eligibility, and cancellation with frozen input
observations. Existing Chat tests include chronological steering/async boundaries,
reasoning compile/cache counts, work clocks, resource-only Turns and disclosure
state coverage. The complete Chat suite passes all 759 tests. Core/Web typechecks and
package/typography/activity ownership checks pass on the fixed source. The 19
release/provenance/dependency-policy tests pass; inventory has no coverage errors
and release mode continues to reject the nine unresolved groups.

Browser verification uses the actual shared projector and Conversation/Activity
components through `scripts/smoke-activity-disclosure.ts` and
`scripts/smoke-reasoning-disclosure.ts`. It covers mouse/touch, light/dark, narrow
and wide containers, retained prose DOM, steering, explicit expansion across
streaming/prepend/reload, reasoning Markdown/selection, one response-work fold,
60 tools interleaved with 13 empty reasoning Items, one clock and localized labels.
Engine-flavor text is synthetic; this is not live model, native iPhone or packaged
Electron acceptance. Several full-script runs timed out at long-list interaction or localized-page
initialization, including a fixed-source run. An earlier complete rerun and the
unchanged baseline both passed. Five isolated localized-page cases passed. With
source fixed, a final full rerun added only local network/page-error listeners and
failure diagnostics; all original assertions, twelve engine/theme/input cases and
five locales passed without skipping conditions, suppressing errors, forcing
clicks or changing timeouts. Activity disclosure's four theme/input cases passed.
The intermittent full-script timeouts are not proven fixed or fully attributed;
retain that validation limit. Existing tool-group resize warnings are recorded by
the script and also occur on the baseline; they are not cleared by this disposition.
Narrow dark Markdown and wide light one-clock screenshots were visually checked.

The inventory retains the original Agent Activity blob/hash and all six previous
partial chat-semantics dispositions. This resolves the final current path of that
group after verification. The nine other unresolved groups, including the newly
inventoried browser and renderer-expression groups, remain open. Original source
history and dependency rights remain unverified; no strict clean-room isolation,
blanket legal clearance, release, npm publication or downstream deployment follows.
