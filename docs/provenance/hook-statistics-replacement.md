# Hook statistics replacement

## Requirements fixed before implementation

Boundary: the complete `packages/chat-core/src/hook-stats.ts` module, including
its three public functions and exported interfaces. Baseline `3c83f6d` contains
Git blob `766eba951f0fd67ff118b3dba42ed836b1467821`, SHA256
`7abea1b8c14024c8bc81ba784cb39c03f5425f9cce87b01950797f1cbcbec24f`.
That historical implementation carries a source-equivalent reducer annotation
and was omitted from the initial source inventory. Its lineage remains in Git.

The authoring inputs are the exported TypeScript contracts, OpenCraft tests and
Web/Native consumers, and black-box calls against the earlier OpenCraft module.
No old reducer/helper body or recovered Desktop/BB/Paseo implementation was read
for this replacement. Other recovery-related code was reviewed earlier in this
conversation, so this is a bounded requirements-driven independent replacement,
not strict clean-room isolation or historical rights clearance.

Required behavior:

1. Accept an unknown input; non-arrays and arrays without valid runs return null.
   Runs may be direct records or `{ id, run }` observations. A valid run has string
   id/eventName/source and status running/completed/failed/blocked/stopped.
   Optional statusMessage is trimmed, with blank values represented by null.
2. Count every valid observation, including repeated IDs. Count failed and
   blocked observations separately; an error entry alone is not a failed run.
3. Retain stop/feedback/error entries in the aggregate, in observation order,
   preserving their text. Exclude context and warning entries there. In run
   details, warnings have warning tone; stop/feedback/error have error tone;
   context stays hidden. Unknown entry kinds and non-string text are ignored.
4. A blocked userPromptSubmit observation contributes its source once and each
   nonblank feedback message (trimmed) to blocked delivery data. Other feedback
   contributes a trimmed source/text pair to feedbackMessages. The source itself
   remains protocol data, not a user-visible display label.
5. Coalesce only adjacent run displays with the same event, source, trimmed
   statusMessage and displayed entries. Hidden context, raw run ID and status
   do not determine display equality. Keep the first observation's display ID,
   add counts, and never globally merge separated runs or lose aggregate entries.
6. Preserve public source-label compatibility: system→Admin, user→User,
   project→Project, plugin→Plugin, sessionFlags→Session; other sources→Unknown.
   Capitalize known protocol hook event names; unknown names pass through.
7. Do not mutate input records or arrays. Remain renderer/platform independent.
   Statistics are presentation and blocked-delivery data, not execution approval.

Validation will include existing chat/runtime consumers, malformed input and
coalescing boundaries, bounded black-box comparisons, the shared-core typecheck,
platform boundary checks and real browser presentation with synthetic hook data.
Other unresolved source groups and previously untracked files remain separate.

## Compatibility follow-up and verification

Requirements were committed first in `5a5347f`. An initial 1,134-case black-box
comparison found that requirement 4 above overstated delivery routing: only
`stop` feedback belongs in `feedbackMessages`. Nonblocked userPromptSubmit,
tool-use and unknown-event feedback remains visible in aggregate entries but
must not be delivered as stop feedback. The replacement and explicit regression
were corrected from those outputs without reading the earlier helper bodies.
All 1,134 comparisons then matched, varying statuses, event names, sources,
entry kinds and direct/wrapped/separated observations. This is bounded evidence,
not proof for every malformed or future protocol value.

The replacement validates observations, accumulates facts and delivery data,
and compresses adjacent display projections using a serialized value tuple.
It retains the exported data types and protocol event/source labels. This is a
new implementation of the specified data transformation, not cosmetic renaming
of the historical reducer. The earlier historical source is not reclassified.
