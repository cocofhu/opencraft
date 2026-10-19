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
