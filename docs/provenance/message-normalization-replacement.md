# Turn user-message normalization replacement

## Requirements fixed before implementation

Replace the complete `packages/chat-core/src/turn-user-message-normalization.ts`
module at baseline `281afed3097a2a9c2295283b4e916c40d7d2457f`, Git blob
`69e7d9439ab8711cf8d2a0112f801f4edfea57f5`, SHA256
`c724a709bbea6d3061526d0759fa82849c93914ca51a541316cd45de10de3b3c`.
Preserve that historical source-equivalent boundary in the provenance inventory.

Inputs: declaration-only extraction from the earlier investigation, existing
projection/tests and outgoing-message documentation, and black-box observations
of the pinned OpenCraft module. A usage search additionally exposed several
internal helper call-site lines (comparison calls and a preserve flag branch),
not their definitions. No old helper/function body or recovered Desktop/BB/Paseo
implementation was opened as an authoring input. The author has previously
inspected other recovery-related modules: this is a requirements-driven
independent replacement, not strict clean-room separation or historical rights
clearance. Record compatibility refinements from observed outputs explicitly.

1. Preserve both exported functions and their declared result types. Keep this
   module renderer/platform independent and side-effect free. Do not mutate Turn,
   Items, payloads, inputs or attachment arrays; preserve unrelated turn/item data.
2. Comparison keys preserve exact text from strings and typed text parts, joined
   by newlines (including empty parts), plus image/localImage counts. Other data
   does not become text. The native protocol names remain compatibility values.
3. A non-nullish params.input other than an empty array owns the primary display
   message, including an empty string. Reuse the first Item only if it is a
   matching userMessage, by string client identity or exact text/image key;
   otherwise prepend `${turn.id}:composer-user-message`. Do not scan past a
   mismatching first Item. Canonical params own ordinary content, client identity
   and side metadata; preserve existing server identity/extra fields and its
   sender when present. Retain source IDs, including prior string IDs, in order.
4. An acknowledged full UTF-8 byte-span marked opencraft:staged-file:v1 owns its
   server content even if params/local steer input predates staging. The legacy
   empty-placeholder exception requires the exact Host locator for a matching
   typed file mention. Do not treat arbitrary paths/filenames as authority.
   Durable attachment metadata remains separate from content and is carried
   through without inventing a locator. Ordinary server prose never overwrites
   Composer/local steer prose merely because attachment metadata is present.
5. Earlier local steeringUserMessage Items (absent/null, pending or accepted
   status only) can own a later server echo by string client identity or equal
   text/image key. Match the earliest eligible local Item, retain its own status,
   input and client display identity, add the server ID as an anchor, and use the
   acknowledged server sender. Preserve local attachments when present, otherwise
   inherit server attachments. Apply the staged-content exception to local input.
   Repeated echoes are consumed and the latest matching server supplies metadata;
   do not merge backward into a local Item that has not yet appeared.
6. Without canonical params, leading server user messages remain primary until
   display work or an explicit steered boundary. Local steering and hookPrompt
   do not alone close this leading display segment. Later identifiable server
   messages become accepted steering; unidentifiable messages and explicit
   steered markers become ordered, deduplicated nonVisualItemIds. With canonical
   params, redundant matching client echoes are hidden; preserveServerUserMessages
   retains otherwise hidden server messages as accepted steering. It does not
   bypass normalization or make explicit steered markers visible.
7. Keep server/client aliases, nullish metadata fallback and unknown payload
   values compatible with observed contracts; validation/authorization belongs
   to their existing owners. Transport IDs remain searchable even when a server
   item is consumed into a locally owned visible row. No send, file read, engine,
   persistence or permission operation is performed by normalization itself.
8. Verify canonical/steering/duplicate boundaries, ordering, aliases, metadata,
   marked/legacy UTF-8 spans and malformed inputs with regression and black-box
   matrices. Run projection/complete chat tests, inventory checks and core/Web
   typechecks. Exercise real Web UserMessage components fed by projection through
   params-only, acknowledged, staged-file and steering phases, including visible
   identity continuity, attachment navigation and hidden locator presentation.
   Synthetic fixtures do not establish live engine or native-device validation.

Only this complete module receives a replacement disposition. Agent Activity
and all eight unresolved source groups remain open; no notice or history removal,
release, npm publication or downstream deployment follows from this replacement.

## Implementation and compatibility observations

Requirements were committed as `bf9df0f` before implementation. The replacement
separates exact comparison keys, staged-display acknowledgement, earlier local
steering associations, canonical message construction and ordered presentation.
Echo association scans eligible local steering rows only; ordinary history items
do not add comparisons. Caller-owned inputs remain unchanged.

The 31,337-case matrix covers canonical input variants, two-item combinations,
5,000 deterministic longer sequences, preserve flags, hidden IDs and metadata.
The separate 9,120-case matrix covers client aliases, malformed payloads, local
statuses, competing content/input fields, Unicode filenames, exact legacy locator
matching and UTF-8 span boundaries. Both compare complete values, including own
undefined properties, against the pinned historical OpenCraft module. The final
40,457 comparisons have zero differences.

Observed refinements: the params client ID participates in redundant-echo hiding
even without canonical input; preserveServerUserMessages makes leading server
messages accepted steering too; local steering matching uses input while server
messages use content with an input fallback. These were compatibility corrections
from outputs, without opening old helper definitions. Full marked spans may
contain any display text; the legacy unmarked exception remains an exact locator
plus matching mention. Durable attachments alone do not authorize server prose
to overwrite Composer/local input.

## Verification and limits

- `tests/chat-message-normalization.test.ts` plus `tests/chat-core.test.ts`: 115
  passed, including 11 new cases for ownership, flags, aliases, ordering, repeated
  acknowledgements, metadata, UTF-8 spans and frozen caller inputs.
- Complete `npm run test:chat`: 756 passed. Shared core/Web workspace typechecks
  and platform/typography boundaries passed.
- Eight inventory regression tests and inventory integrity passed. The explicit
  release check still exits unsuccessfully with eight unresolved groups; only
  this module moves to a new independent replacement record.
- `scripts/smoke-message-normalization.ts`: passed at 390px/1200px using the real
  Web UserMessage component with synthetic shared projection snapshots. The
  primary row and its text bubble retain actual DOM identity through params,
  ordinary acknowledgement and staged-file phases; the steering row survives
  pending, accepted and repeated echoes. The fixture verifies exact source IDs,
  searchable primary/local/latest-server anchors, no duplicate visible message,
  hidden model locator, standard file-URL navigation, no horizontal overflow and
  no page errors. The narrow screenshot was visually inspected; both message
  bubbles and attachment controls remain readable and reachable.

The fixture replaces the transport/data source, not projection or the rendered
UserMessage component. It does not cover the complete live conversation shell,
virtualizer, Host persistence, microphone, authenticated engine, packaged
Electron or native devices. Other renderer/source groups remain unverified.
No historical commits, retained notices or distribution rights are cleared.
