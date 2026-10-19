# Realtime transcript replacement

## Requirements fixed before implementation

Replace the complete `packages/chat-core/src/realtime-transcript.ts` module at
baseline `593eca7ae9177b4bf1ca09bcf8adaf3f8410c015`, historical Git blob
`0b2f83bfdd78627fe75b23fdccc66802a204c55b`, SHA256
`d6b60b00adf20442cb356ea027c5eb4ea3f90bd0a10dc5ea8a9a2dbae95b53f2`.
Retain the old source-equivalent annotation's history in the inventory.

Authoring inputs are AST-extracted declarations/signatures (without old function
bodies), current consumer contracts, existing tests, and black-box OpenCraft
observations. The author has previously inspected other recovery-related modules;
this is a requirements-driven independent replacement, not strict clean-room
isolation or historical rights clearance. No recovered Desktop/BB/Paseo source
or old implementation body is an authoring input for this replacement.

1. Preserve the exported prefix, interface and three functions. These helpers
   interpret untrusted presentation data only; no audio, network, authorization
   or execution side effects belong here.
2. Extract a string unchanged, or join array strings and exact typed text parts
   with newlines, retaining empty strings and ignoring other/malformed parts.
3. Require a trimmed exact lowercase realtime_delegation envelope and a literal
   input tag pair. Preserve the observed first-tag behavior with extra inner
   content/duplicate tags; this small protocol recognizer is not XML validation.
   Decode only lt/gt/quot/apos/amp once and trim extracted values; preserve numeric
   entities and nested literal markup as text. Missing optional tags become null;
   an empty present transcript delta remains an empty string. Recognize only the
   exact trimmed transcript_tail_flush source.
4. Read newline-separated role markers at column zero, case-insensitive user or
   assistant followed directly by a colon. Trim each completed message, omit
   empty messages, and retain continuation lines (including unknown role text).
   Ignore text before a recognized role. Preserve CRLF handling and the observed
   exclusion of a role line containing bare CR/Unicode line separators. Append
   input as a user message unless it equals the final user message already read.
   Even empty input must be represented when no equal final user exists.
5. Handoff IDs strip only an exact leading realtime-delegation- prefix; retain
   empty/leading suffixes. Projection owns leading versus later transcript
   placement and activity collapse behavior; preserve that contract.
6. The shared Web/Electron voice transcript renderer currently calls every
   assistant speaker Codex. Replace that generic speaker label with Assistant;
   preserve protocol identifiers and specific engine/authentication integrations.
   This small wording edit does not reclassify the entire conversation renderer.
7. Verify parser boundaries, entities, role continuation/deduplication, and
   handoff IDs with regression tests and a black-box matrix. Run the existing
   projection/activity tests and shared/Web typechecks. Exercise the actual Web
   renderer at narrow/wide sizes with synthetic projected messages, including
   literal markup safety and handoff placement. No real audio/model/account
   integration or native-device coverage is implied by this browser fixture.

Message normalization is outside this replacement. Its attachment, identity and
steering reconciliation remain unverified, as does Agent Activity; all eight
unresolved inventory groups remain open after this bounded change.
