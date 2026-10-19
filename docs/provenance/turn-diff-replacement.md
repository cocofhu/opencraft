# Turn diff summary replacement

## Requirements fixed before implementation

Replace the complete `packages/chat-core/src/turn-diff.ts` module. At baseline
`c4d9915` its Git blob is `96c4954432fafbf0675c2ee1d66e20197f7c0291`, SHA256
`bf53cea7bc6a88d51519668276931ac76712f75cf4ca5029f362a99c555db644`.
The prior aggregate has a source-equivalent annotation; preserve that historical
source and evidence, rather than presenting a removed annotation as clearance.

Authoring inputs: exported signatures and data types, existing TurnDiff tests,
projection/review consumers and black-box OpenCraft observations. Extracting the
multiline createTurnChangeSummary signature exposed its initial null/blank guard;
no other old implementation body or recovered Desktop/BB/Paseo implementation
was read for this replacement. Other recovery-related code was inspected earlier
in the conversation. This is requirements-driven independent implementation,
not strict clean-room separation or clearance of historical rights.

1. Preserve `summarizeTurnDiff(string)` and `createTurnChangeSummary(turnId,
   status, string | null)` with their existing public output types.
2. Identify files from Git `diff --git` headers, using the destination path;
   support quoted paths containing spaces. Plain unified headers without a Git
   file header and arbitrary prose do not introduce a file. Binary-only Git
   sections retain a zero-count file. Paths are presentation data, not authority
   to read or write a filesystem.
3. Merge repeated Git sections for the same destination while preserving first
   appearance order. Count plus/minus lines belonging to the active section,
   excluding `+++`/`---` header-prefix lines. Preserve compatibility with partial
   streams that have no hunk header yet. Rename/delete metadata does not replace
   the Git header's destination identity.
4. Return per-file and aggregate addition/deletion counts, including zero-count
   files. Empty/prose input gives an empty summary; a nonblank prose string may
   still be retained as a raw Turn change summary.
5. A null or whitespace-only diff gives no Turn card. Otherwise preserve raw
   unifiedDiff, id `<turnId>:turn-diff`, empty sourceItemIds and type `turn-diff`.
   Pending/streaming map to running, complete to complete, failed/interrupted to
   their corresponding execution status.
6. Remain renderer-neutral and keep the dedicated Turn resource distinct from
   live patch Activity. Validate selected-file review and the real change-card
   component, with synthetic input clearly distinguished from a live engine.
