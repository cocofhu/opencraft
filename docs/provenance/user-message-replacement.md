# User message semantics and Web layout replacement

## Requirements frozen before implementation

Baseline: `359c52e3faf4535f493b3ea3072a04301e6fe140`.
Replace both complete modules:

| Module | Historical Git blob | SHA256 |
| --- | --- | --- |
| `packages/chat-core/src/user-message.ts` | `a8753035c98fe552820900ab974a397422104aac` | `2ad954f903c9c696946bdb4f594978aa9423329c85823c95fd68d98a478804f7` |
| `apps/workbench-web/src/components/conversation/user-message-layout.ts` | `4b0b054ca039ce0b549e60e095190ec43f7cc28e` | `d57c0ac1151c519ba068cd231d9f210922d0397b76625d9598ce591b7dd86b89` |

The prior modules carried source-equivalent annotations. Preserve this lineage
in Git and the inventory disposition. Authoring inputs are their exported
signatures/types/constants, the shared timeline contract, projection consumers,
existing tests and black-box OpenCraft results. No implementation body of either
old module or recovered Desktop/BB/Paseo source was read for this replacement.
The author has inspected other recovery-related code in prior work. This is a
requirements-driven independent replacement, not strict clean-room separation or
a determination of historical redistribution rights.

1. Preserve public exports, types and marker/header constants. Recognize the
   case-sensitive literal `## My request:` and `## My request for Codex:` anywhere
   in input. The last marker's suffix is the visible request, trimmed on both
   ends. With no marker return the input unchanged, including whitespace.
2. Review/fix/auto-merge/prior-context flags use only context before the first
   request marker, or the full raw input if no marker exists. Exact headers may
   occur within a line. Review and PR-fix suppress the prior-conversation flag;
   auto-merge alone does not. Text after a request marker cannot inject a flag.
3. `/goal` is a display directive, not persistence or permission. After leading
   whitespace it must be exactly `/goal` or followed by a literal space. Remove
   the directive and following leading whitespace, retaining trailing whitespace.
   A tab/newline immediately after `/goal` does not qualify. Return null for a
   non-directive and an empty string for a directive with no remaining text.
4. Derive semantic message text from the visible request and optional directive.
   Keep the remaining flags from the context boundary in item 2. Parsing never
   performs I/O, authorizes operations or changes Goal persistence.
5. Web layout partitions typed content into image/audio/context arrays and typed
   attachments into file/comment/MCP arrays, retaining relative order and object
   identity. A file attachment suppresses a mention with the same path/target,
   leaving unrelated context intact. Text parts are not reparsed as metadata.
6. Nonblank message text always has a bubble. Semantic-only/media-only messages
   do not manufacture an empty bubble. A truly empty message retains the
   localized no-content bubble. Prior context, typed attachments, external
   attachment metadata, review/fix/auto-merge and positive comment count may
   stand alone; Goal, hook feedback and delivery state do not by themselves
   suppress the no-content bubble.
7. Status visibility includes Goal, hook feedback, review/fix/auto-merge, positive
   comments and not-sent/failed/unknown delivery. Sending and sent are transport
   states, not visible error labels. The body is visible when bubble or status
   is visible. Preserve exact observed attachment/status combinations through
   an exhaustive black-box matrix before acceptance.
8. Validate actual UserMessageBlock rendering with synthetic raw wrapped input,
   statuses, empty/media/file/context-only messages and sender labels, at desktop
   and narrow widths. Keep sender ownership and attachment interactions intact.
   This does not claim live authenticated engine or full native-client testing.

## Implementation and compatibility evidence

Requirements were committed as `61d0a02` before authoring either replacement.
The semantic parser uses literal first/last boundary searches and a separate
leading directive recognizer; it does not depend on mutable RegExp lastIndex.
The Web layout builds typed output buckets in one pass over each input family,
then derives message/status visibility without reinterpreting payload text.

A local black-box comparison against the pinned previous OpenCraft modules
matched 1,248 semantic input strings (all three exports checked for each) and
38,400 layout combinations, with zero differences. The inputs combine all header
flags, separators, request forms, directive boundaries, multiline/blank text,
all seven semantic layout booleans, six delivery states, typed content and
attachment variants. This comparison observes behavior, not old helper bodies.
It is broad compatibility evidence, not proof for every possible input.

Validation:

- `node --import tsx --test tests/chat-user-message-semantics.test.ts tests/chat-core.test.ts tests/workbench-user-message-layout.test.ts tests/chat-user-message-collapse.test.ts tests/source-provenance.test.mjs`: 134 passed. New cases cover context boundaries, all header flag combinations, exact Goal syntax, shared marker state, frozen objects and status-only messages.
- `npm run typecheck --workspace @opencraft/chat-core`, `npm run typecheck --workspace @opencraft/workbench-web` and `npm run check:boundaries`: passed.
- `node scripts/check-source-provenance.mjs`: inventory has no structural errors; eight unresolved groups remain. Only these two paths move to the replacement entry, preserving their historical partial dispositions. The four remaining chat-semantics paths stay unverified.

No historical rights, complete renderer, native app or authenticated service
clearance follows from this bounded replacement. Do not remove historical source
records or licensed integrations on the basis of these tests.

- `scripts/smoke-user-message-semantics.ts`: passed at 390px and 1200px in
  light/dark scenarios, with no page errors. It exercises the real
  `UserMessageBlock`: wrapped Goal/review visibility, hidden context omission,
  clipboard handoff, empty/status/attachment-only rows, duplicate mention
  suppression, file and skill resource navigation, image viewer open/Escape and
  sender-above-bubble geometry. The narrow dark screenshot was visually reviewed.
  Fixture media/clipboard/Host resource handoffs are synthetic; no audio playback,
  authenticated engine, full native client or product-wide theme conformance is
  claimed. The probe waits for asynchronous Markdown compilation and asserts
  canonical `file:` handoff targets rather than guessing raw path callbacks.
