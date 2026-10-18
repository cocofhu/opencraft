# enterprise OA employee identity

The optional `enterprise.identity` plugin recognizes the employee authenticated by
the site's enterprise identity gateway. It registers an independent authentication provider
and an “员工身份” settings page. When configured, it owns the shared bottom-left
account entrance: the verified employee login name and available employee photo are shown automatically, and
clicking opens employee details and refresh. Without a verified identity the same
entrance is labelled “员工身份” and opens those details; no fixed login URL or
separate OAuth flow is configured. The current site's gateway supplies identity
headers on the same-origin session request.

Footer selection uses explicit `entrancePriority` (enterprise OA: 100; existing
product accounts: 0). Equal priorities remain exclusive. This changes only the
Shell presentation: LightVela's authentication, resources and account storage
remain independently owned, and its entrance returns when enterprise OA unloads.
There is no employee logout control because this integration has no gateway
logout contract. A 401 removes the displayed employee immediately. Local expiration
revokes authentication while keeping bounded, previously verified display metadata
during revalidation; an open identity detail view remains available for refresh.

## Enablement

Start the headless server with `--enterprise-identity-token-file /absolute/private/token`.
The file must be a regular, non-symlink file owned by the server user, inaccessible
to group/others (mode 0600). Its content is the application's raw 32-byte token;
one trailing newline is accepted. No token is included in source or sent to the
browser. Without configuration the endpoint returns 404 and the plugin contributes
no settings page/provider. Invalid configuration stops startup.

The deployment gateway must forward signed headers and `X-ENTERPRISE-IDENTITY` on the
same-origin session request. Do not expose decrypted payloads, complete headers,
tokens or ciphertext in diagnostics. The preview is not automatically enabled by
this source change.

## Optional installation access allowlist

Employee recognition and installation admission are separate decisions. Headless may
add `--enterprise-identity-allowlist-file /absolute/private/employees.json` alongside its existing
`--enterprise-identity-token-file`. This is a server-owned, regular, non-symlink 0600 file:

```json
{"schemaVersion":1,"loginNames":["employee.one","employee.two"]}
```

Names match verified enterprise identity English login names exactly, ignoring ASCII case; no wildcards,
groups, client-supplied identity or automatic administrator exception. Absence of the
option preserves existing admission; a configured empty list denies everyone. Malformed,
missing or insecure configuration fails startup instead of becoming unrestricted.
The list is read once at startup. Change it atomically and restart through the managed
Headless lifecycle to apply; existing connections end with that lifecycle. No browser
or employee-settings editor can modify installation admission.

HTTP application routes and every WebSocket upgrade independently enforce the policy.
Missing/invalid signed identity receives 401; a verified employee outside the list
receives 403. The managed website checks document navigation with the Headless admission
endpoint before serving its static shell; static JS/CSS are public code and contain no
employee data. Direct Headless access enforces the same policy. Health probes remain
available, while existing deployment-administrator credentials still own website updates.
An admitted socket expires at the verified identity deadline including existing enterprise identity
clock tolerance; reconnect must authenticate again. A confirmed 403 clears retained
client identity just as 401 does. Denied document navigation shows a small retryable
access page without loading application data; it never prints the list or private headers.
This gate does not assign per-conversation/resource permissions or change machine SSH access.

The server plugin implements the trusted `WorkbenchRequestIdentity` composition
port. It owns employee sender mapping, expiration tolerance and provider HTTP
routes; the generic gateway does not import enterprise identity. Managed static navigation now
probes the core `/__opencraft_access/admission` endpoint. A configured enterprise identity plugin
retains `/__opencraft_enterprise_identity/admission` for older managed workers, after core
admission. Closing the plugin rejects new admission and connection contexts;
removing an expected provider is not an anonymous-access fallback. Core Actor
and membership checks retain authority, and the earlier of membership and
connection-proof expiry retires an established socket.

## Ownership and invariants

- The installation owns only the private application key. Every request is
  independently verified; there is no server-global “current employee”.
- The plugin verifies uppercase SHA256 gateway signatures and a 180-second
  timestamp window, then authenticates/decrypts compact JWE (`dir` / `A256GCM`).
  The signature and GCM authentication are separate checks; neither substitutes
  for the other.
- Identity expiration is RFC3339 with the documented three-minute clock tolerance.
  Duplicate security headers, conflicting identity aliases, invalid types/dates,
  and contradictions with legacy staff headers are rejected.
- The response projects only English login name, staff ID and expiration. Actual
  gateway field casing is normalized at this boundary. `open_id` is not exposed;
  a Chinese display name is not invented when unavailable.
- Browser identity is memory-only, per client. Request generations fence late
  responses; disposal and 401 revoke identity. Network failure cannot extend an
  identity beyond its authenticated expiration plus clock tolerance.
- Recognition is not resource authorization. The optional installation gate above only restricts admission; it does not grant or isolate
  shared SSH connections, desktop access, conversations or model credentials.
  Gateway/network admission and resource permissions remain separate responsibilities.
- No undocumented nonce-replay rejection or external identity-logout flow is invented.

Protocol basis: user-provided enterprise identity signing and JWE documentation, with
read-only real gateway validation. Unit tests use synthetic credentials exclusively.

## Per-message sender provenance

Headless Web verifies enterprise identity headers on each `/appserver`, `/apphost` or `/ssh-apphost` WebSocket
handshake. The gateway binds the verified English login name and validity deadline
to a server-owned connection context. Renderer IDs, frame fields and client-supplied
`sender` values cannot establish an employee identity. The deployment gateway must
forward the signed identity headers on WebSocket upgrades as well as HTTP session
requests. Missing or invalid handshake identity yields unattributed submissions;
an established employee context past its validity deadline rejects new submissions
until the client reconnects through employee authentication.

AppHost passes this context through an optional in-process `sendWithContext` port.
Codex/SSH and the DSH `/appserver` overlay share `ThreadIdentity` and accept
provenance for `turn/start`, `turn/steer` and `thread/queue/add`.
It records only `{ kind: "employee", loginName }`, without staff number, private
headers, credentials or token expiration, keyed by `(threadId, clientUserMessageId)`
in the stable Host's metadata owner. Codex/SSH retain `codex-host-queue.sqlite`;
DSH uses the Hub-only owner described below. Codex queue and provenance share
one connection; adding a queued submission and its sender is one transaction.
An existing message identity cannot be attributed to a different employee or
upgraded from an unknown sender. Native legacy submissions without a client ID
remain unattributed; authenticated submissions require that ID.

The enqueue-time sender remains the submitter through queue editing, reordering,
reconnects and dispatch by another client. Queue edits do not relabel the original
submitter; this feature does not provide an editor audit trail. Dispatch and
unconfirmed-delivery reconciliation retain the existing queue authority. Sender
records are stored before dispatch; they do not themselves prove native delivery.
Only matching native history items or pending queue rows expose provenance.

Live notifications, paginated history, resumed threads and shared Chat projection
carry OpenCraft's `sender` field independently of visible message text. Full-history
forks inherit provenance mappings; excluded history is not displayed and blank
forks (`excludeTurns`) do not inherit them. Unknown old messages remain unattributed.
Stored historical sender snapshots do not expire with the originating connection.
Remote Codex Hosts keep their records in their stable local Host metadata directory.
No sender field is forwarded to native engines or injected into model input.
The DSH overlay strips client identity fields, records provenance before forwarding,
and advertises the same metadata capability and method-access entry. Its Hub-owned
managed v1 database is `thread-identities/opencraft-server/thread-identity.sqlite`
under the Headless data root. It does not mirror message bodies or open native
Host databases; a bounded read-only AppServer client reconciles native message IDs.
The proxy checks context expiry when forwarding, including frames queued during
upstream connection establishment. Socket receipts and logical-client epochs
prevent a late response from satisfying a later client request. Closing the Hub
closes this reader and database without restarting the independent Host.
Other transports advertise the capability only when the metadata provider is wired.

## Employee footer photo

The enterprise identity plugin resolves a stable browser-loaded photo URL,
`https://directory.example.com/photo/150/<loginName>.png`, from a validated directory login
name. The browser uses its own OA network/session; the OpenCraft server does not
need directory connectivity. No per-refresh timestamp is appended. The account
menu and footer consume the existing `avatarUrl` snapshot. A narrow trusted
`identityAvatar` contribution supplies the same lookup for message senders;
historical message identity comes from each stored sender, never the current account.
For immediate local presentation, the account contribution exposes a sender hint
only while its verified identity is available (never from retained display identity).
The conversation runtime copies that hint at submission, before its first optimistic
publication, keyed by exact client message ID. A bounded 256-entry, runtime-local
map keeps this presentation stable across acknowledgement. Account switches do not
rewrite prior submissions; explicit server attribution or null overrides the hint.
Disposal drops hints; restored or unrelated messages are never inferred from the
current account. The hint is not added to SubmitIntent, transport credentials,
server persistence or native model input.
The shared `AvatarImage` renderer keeps the caller's initials or icon visible while a photo is pending or failed. A photo replaces that fallback only after a successful load with valid image dimensions; each source owns its loading state, so switching or removing a source cannot reveal the previous photo. The caller retains geometry and accessible labels. Images send no referring page URL.
Directory image access grants no OpenCraft identity or resource authority.
Revocation/account changes replace the account URL immediately; plugin unloading
removes the sender resolver.

Foreground recovery reuses identity reads for 60 seconds, rechecks within 30 seconds
of expiration, shares an in-flight request, and backs off failures for 15 seconds.
Explicit refresh/sign-in remains forced. Renewing the same employee’s expiry does
not change the authentication epoch. Authentication still expires at its verified
deadline; a separate in-memory display identity (login name/staff ID only, at most
24 hours from the last verified response) keeps the account photo and personal
list mode stable during background verification or transient failures. It cannot
establish an authenticated session. A 401, including a non-JSON gateway response,
404, confirmed account change or disposal clears the display identity. Photos
keep stable URLs and image DOM while that account is revalidated.

The existing authenticated same-origin photo proxy remains available for explicit
API consumers. It accepts only validated directory names and 48/100/150/500 sizes,
fetches the deployment-controlled fixed `/ebus/rhrc/photo/` route, and forwards no
gateway credentials. Raster responses remain bounded to 1MiB/four seconds.
The default UI does not use this proxy.

## Conversation participants

The enterprise identity plugin forms a distinct display list from the known creator followed by
the server participants array, and displays only its last entry: the latest identified
speaker, or the creator when nobody has spoken. A creator who has spoken keeps their
message-recency position. Missing photos use the existing opaque fallback disk.
For more than one person, a separate circular number badge to the right shows the total known
person count, capped at `99+` visually with the exact total in its tooltip. Single-person
and unknown rows omit the count. The badge fits its20px photo plus an optional20px circular total with a4px gap (44px combined), both equal in size and vertically centered; no empty count lane or trailing spacer is reserved. Its right edge and the host action gap stay fixed; count changes can move the photo and release space to the title. The count uses shared metadata/disclaimer typography and theme tones,
with a themed count disk and no overlap. The entire badge opens the same participant
popover; its accessible name includes the exact total. Artwork stays inside the enterprise identity
plugin, not Shell. This replaces the three-photo stack and hidden-person overflow.
The version-1 provider orders participants by their most recently observed identified
message, ascending; the Renderer reads the last entry without mutating the snapshot.
Recency is an observed message-order approximation (described below), not a guessed
wall-clock timestamp or a new index of all administrative actions.
The creator remains separately displayed in the full Popover.
Shell lays out the intrinsic content width (one photo and an optional total)
with a fixed right edge and existing menu gap; absent content consumes no space.
Single- and two-line rows retain their height. Clicking opens the full participant
list without selecting the Thread; the Popover has photos and names, with no
numeric heading. Opening a conversation does not join it. Failed photos retain
a same-size person icon.

Successful `thread/start` and `thread/fork` record the authenticated requester as
the new Thread creator, using only server-owned submission context. Client fields
cannot supply this identity and it is never forwarded to native/model input.
Creation records are immutable (including unknown); fork records its own creator,
not the parent's. Host-state migration v3 adds `ioa_thread_creators` without
rewriting prior migrations. Older Hosts may omit `creator`; old Threads with no
creation record remain unknown and still show verified participant photos. No
first/last sender is relabelled as the creator. Photos use stable directory URLs and browser caching; no second Blob cache or
server-side fetch is required by the default UI.

The deployment enables a plugin-owned Thread metadata provider only when enterprise OA
is configured. `opencraft/ioa/thread-participants/list` batches up to 100 Thread IDs;
its `data[].participants` is a distinct array ordered by each identified employee's
most recently observed user message, ascending (the most recent person is last).
The server array describes identified speakers; the badge additionally includes
the known creator once, including before their first message. `creator` is separate creation provenance and does not change this order.
The existing presence rows approximate recency with `MAX(rowid)` per login name:
full reconciliation inserts native history in ascending order; live observations
insert new messages in arrival order. A repeated Item does not become a new message
or move its sender. This is an observed message order, not a wall-clock timestamp;
no schema or timestamp column is added. Snapshot-array comparison continues to
drive revision changes, including an order change after an employee speaks again.
Its version-1 capability is advertised by the Host, including native method-access
catalogs. Unsupported Hosts contribute no badge. The derived `ioa_message_presence`
and `ioa_participant_state` tables share the provenance connection and transaction
owner: existing `codex-host-queue.sqlite` for Codex/SSH, and the Hub-only identity
database for DSH. Verified message sender bindings remain the identity authority.
Both use the same `EnterpriseParticipants` provider, immutable bindings, fork-origin
handling, persisted completion state and native-history reconciliation. Existing
Codex v1–v5 migration SQL and checksums remain unchanged.

Forks preserve message authorship without inheriting participant membership.
Host-state migration v4 adds `message_sender_origins` alongside the immutable sender
map. The Host clones authors and inherited-message provenance atomically; nested
forks mark all copied mappings as inherited. The metadata context exposes this
provenance to the enterprise identity provider, which excludes inherited IDs in live and history
reconciliation. A new fork initially displays only its authenticated creator;
later accepted messages add their verified senders. Reconnect/restart cannot
reintroduce copied authors. Existing Threads without recorded origin metadata
are not guessed or destructively backfilled.

Only observed native user Items and native history message IDs establish presence.
Binding an identity, waiting in the queue or a rejected delivery does not count.
Confirmed input remains participation if model execution fails or is interrupted.
On first read each provider returns the current persisted snapshot immediately,
with optional `data[].pending: true`, and queues complete native-history
reconciliation in the background. The capability remains version 1; older clients
ignore the optional field. Until a successful full reconciliation, snapshot fields
are provisional: even an empty array or a known creator is not a ready result.
Failures instead use the existing per-row `errors` response. After full reconciliation
succeeds, `pending` is absent (or false) and the snapshot may authoritatively be empty.
Pending rows still count as rows in the complete `data` + `errors` response. List never waits
for a new or existing history job, so slow SSH history cannot consume the client's
15-second metadata RPC budget. Successful
start/steer and completion reconcile the affected Turn, while fork/rollback reconcile
retained full history. Concurrent Items fence late history reads. Closing the Host
revokes pending projection work before the shared DB closes.

Participant snapshot changes (membership or order), completion of the first full
reconciliation (success or failure, including an unchanged empty snapshot), and recovery send `opencraft/ioa/thread-participants/changed` to initialized
readers of this Host, including readers viewing another Thread. The plugin batches
visible-row reads, fences connection/account changes, and keeps prior metadata on
transient errors with retry. Row unmount retains up to 256 least-recently-used
inactive snapshots in plugin memory; re-entry within five minutes on the same
client/connection reuses the snapshot without an RPC. Older snapshots stay visible
while revalidating. Notifications, new connection generations and explicit retry
force reads and immediately revoke cache freshness, so cancellation followed by a
warm remount still revalidates. A batched read owns the specific row entry and its
revision: deleting and resubscribing to the same Thread cannot inherit the retired
entry's reply. The enterprise identity wire boundary accepts exactly one data/error outcome per
requested Thread and rejects duplicate, overlapping or missing outcomes before
publishing any row. Optional `creator` and `pending` remain compatible with older
Hosts. Host-client replacement and confirmed account changes fence/clear
old data. Hosts without active watchers release their subscriptions. No snapshots
survive plugin disposal. Names and photos are display metadata only: no enterprise identity RPC
is forwarded to native Codex, and metadata is never injected into model input.

Background reconciliation is deduplicated for cold list reads and limited to four
active jobs per provider. Each `readMessageIds` operation has a five-second deadline
across all pages. Its AbortSignal cancels daemon internal RPC ownership and prevents
further pages; the native protocol does not cancel an already delivered remote read.
Even a history port that ignores cancellation cannot hold a worker or apply a late
result after timeout. Closing the provider cancels reads and fences queued work.
Native history reads use 1,000-item pages with a bounded 1,000-page cursor walk.

After background reconciliation fails, subsequent list responses isolate that row
with `errors: [{ threadId }]`; other snapshots remain in `data`. A subsequent read
can start another reconciliation. The frontend retains previously known metadata
on a failed row. Pending rows map to `phase: "loading"` while preserving prior
client data (null on the first read); provisional wire fields never replace it.
Creator grouping therefore shows “Loading creators…” for a cold pending row,
while actual errors show “Creator unavailable”. Watched pending and error rows
automatically retry after 5s, then 15s, then 60s (capped). This includes missing-client,
RPC and per-row failures. Only a non-pending successful response
resets the backoff; explicit refresh, notifications and reconnect can retry sooner.
Unwatch, Host replacement, account clear and disposal clear retry timers; inactive
rows do not retry. Replacing a Host client requeues every still-watched row on
the new client with reset backoff, even if it has already initialized and sends no
metadata notification. Unwatch removes a row from any batch not yet dispatched.
Unsupported capabilities do not retry. Failure/recovery events
can retain the current participant revision because they invalidate availability,
not just the distinct participant set.

## Creator-grouped conversation list

enterprise identity contributes an optional `creator` mode through generic `threadListGrouping`.
The default is the Shell's taskflow list. The list's display-mode button and
row/header right-click menus select the mode. Each loaded Thread appears once,
under its recorded creator; participants never determine the group. The current
employee's group is first, other login names sort alphabetically, and confirmed
unknown creators follow. Loading and failed reads have distinct groups; transient
errors retain known metadata. Within each group pinned Threads precede recency.

Only collapsible group headers show employee photos in this mode; row participant
badges are hidden. Collapse does not release metadata watching, and mode changes
do not navigate or rebuild the conversation. The same participants controller
batches reads; no additional Host schema, authentication flow or history backfill
is introduced. Historical creators without creation records remain unknown.

Mode and collapse preferences belong to enterprise identity and use the generic local preference
port with `enterprise.identity.employee:<staffId>`, further isolated by product and extension.
Current Web storage is localStorage, with same-origin tab invalidation and
last-write-wins. Switching accounts immediately restores that employee's own
preferences; anonymous mode changes are transient. Data is not synced to another
employee or device. Failed persistence keeps the current UI and reports failure.


### Personal participation filter

enterprise identity exposes an optional generic filter descriptor, `filterThreads` and
`setFilterEnabled` through `threadListGrouping`. “My conversations” defaults off; saved explicit choices remain unchanged;
a Thread matches when its creator or participants contain the current `loginName`.
When enabled, only positively identified membership enters the personal result.
Rows with no snapshot data (loading, error or unsupported metadata), or ready rows
with neither a known creator nor any identified participants, are unresolved. They
are excluded directly by the existing filter, without a separate count, status
row or expansion control.
A cold `pending: true` response keeps client data null; it never becomes a ready
empty snapshot or positive membership. Anonymous mode still shows all rows.
Once data is ready, an empty creator and empty participants do not establish
personal participation: the row is hidden while the filter is enabled and counted
among other conversations. Being the creator or an identified message sender is
the only positive match;
without a current display identity all rows remain visible and the plugin omits
the filter descriptor. Shell then hides the chip and the entire filter group
in dropdown/context menus. Identity restoration brings them back with that
account's saved mineEnabled preference; identity loss never writes it as disabled. Shell receives only
Thread references and the enabled descriptor, never employee identity or enterprise identity RPCs.
The same plugin-owned account preference schema stores mode, creator collapse and
participation preference; legacy records without the new flag default off. Watching
stays active for the full catalog while either creator mode or participation
filtering is enabled, including filtered/collapsed rows. Metadata
batching covers the complete paginated Host catalog, including creator/sender
matches after the first 50 Threads and beyond the 100-ID metadata batch window.
The catalog read completes before applying the personal filter; it does not
substitute the recent-page subset for all possible matches. Participation still
comes from verified creator/sender records, never inferred from a title or the
current viewer.
Existing batching and refresh/cache policies apply: the first snapshot may precede native
history reconciliation; `changed` invalidation and watched-error retries eventually
refresh filtering without changing pins, selection or collapse state. Cold pending
rows retain null client data, so filtering cannot confuse unfinished history with
a ready empty participant result. Both are non-matches while the personal filter is enabled. “Show all” disables only this
filter, preserving title/server filtering and display mode.

## Account read receipts

The enterprise identity account contribution supplies the generic ThreadReadReceiptPort. The fixed
Headless server persists account receipts in thread-read-receipts.sqlite, opened
with managed document-store migrations and reported through storage health.
GET/POST `/__opencraft_enterprise_identity/read-receipts` derives `enterprise-identity:<staffId>` from
the verified request, checks the expected-scope header, and returns only that
account's exact Host/Thread/Turn tuples. POST accepts only `{receipts:[...]}` and
unions records atomically; it cannot replace another device's reads or select an
account from body fields. Same-origin, JSON, byte/tuple limits and identity expiry
checks remain enforced; outage/future format is unavailable, not empty success.
The existing Headless backend proxy already carries this plugin route; no fixed
bootstrap route migration is required. Browser cache/outbox migrates by union and
retries uncertain writes; current visibility remains participant-only. No new
authentication credential or display identity is stored in the receipts.


### Durable participation completion

Host-state migration v5 adds `ioa_presence_sync`. The provider records a successful
full-history reconciliation and restores that completion on reopen, alongside the
existing verified senders, creators and derived presence. A cold row without this
record remains pending; legacy rows are not guessed to be complete. A failed
background refresh preserves previously confirmed membership, including for a new
reader after reopen. Fork/rollback/delete revoke completion before reconciliation.

The optional `ThreadMetadataExtension.observeCatalog` hook receives successfully
synchronized native directory IDs. The enterprise identity provider refreshes these in its existing
four-job history queue without requiring Sidebar row watchers; it deduplicates
active jobs and revalidates on a five-minute cadence. No missing historical sender
identity is synthesized. The normal client watcher remains compatible with Hosts
without this hook and continues to fence account and connection replacements.
# Core admission and optional relay

New headless installations with `--access-control`, a legacy allowlist, or a relay
connection use core instance membership. The enterprise identity adapter supplies provider
`enterprise-identity`, immutable staff ID, display login name and credential expiry;
generic roles, administrator maintenance and revocation belong to core. Legacy
allowlists import once, then administration uses the core store. An instance
connected to a relay can consume pinned verified identities without holding an
enterprise identity application key. See [ordinary relay deployment](relay-deployment.md).
