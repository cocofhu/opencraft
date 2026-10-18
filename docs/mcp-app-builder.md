# Built-in MCP App builder

Join's Headless gateway owns the built-in App definition service. The existing
Web client host renders its self-contained HTML in an opaque-origin sandbox;
the native Codex and DSH execution engines keep owning conversation history.
App definitions are not another conversation history or business database.

## User workflow

In a new Join conversation, ask the AI to create an interactive App, for example:
“创建一个 MCP App，输入单价和数量计算总价，发布后在当前会话打开。”
The built-in `opencraft_apps.manage` tool loads precise authoring guidance with
`help`, reads `list`/`get`, validates a complete serialized App spec, then publishes
and opens it. `openBuilder` opens the management UI in the conversation.

Existing DSH conversations acquire the tool through their existing capability
registration boundary. Native Codex conversations retain their original dynamic
tool declarations; an older native conversation needs a new conversation to
acquire the newly introduced tool. Remote SSH Hosts and older servers do not
advertise this service and are not given its tool declaration. This release
implements the Headless Join service, not a new desktop/native App builder.

## Ownership and protocol

`packages/mcp-apps` owns management, validation, release storage and execution.
Only admitted gateway connections receive a trusted `resourceOwner` context.
The owner is the existing verified Actor; installations without authentication
use their explicit shared anonymous workspace. RPC arguments never select an
owner. The native local Host transport and the DSH `/appserver` proxy decorate
the same typed MCP tool/resource methods. External native MCP inventory is
preserved; DSH's unsupported inventory response gains the built-in inventory.
The service is exposed through AppServer, not a separately public HTTP MCP endpoint.

`opencraft/mcp-app-builder` version 1 is advertised only by the actual service.
The client adds the authoring tool only after this capability is present. The
runtime preserves existing connection/lease/generation cancellation. A delayed
validation rechecks authority before commit; a delayed tool result rechecks the
active release. Writes have no automatic retries. Client disappearance revokes
pending replies; it does not recreate a request or roll back an admitted commit.

A successful `open` result carries an owned resource envelope in the existing
dynamic-tool result. Native namespace `opencraft_apps/manage` and the DSH
projection `deepseek-harness/opencraft_apps__manage` use the same chat projector.
Only that exact tool identity can request inline rendering; the gateway still
checks owner/server/resource for every operation. Restoring history preserves
that envelope through the existing engine history. No new history store exists.

## Persistence and versions

`mcp-apps.sqlite` is gateway-owned and opens through the managed SQLite owner
contract. Health reports its outcome. Each owner/App pair has one draft, a CAS
`version`, an active release and a monotonic next release number. `saveDraft`
does not change the active release. `publish` validates before one transaction
stores and activates an immutable release. Every mutation requires the version
just read; concurrent or ambiguously acknowledged writes require a read/reconcile.

Resources are content-addressed HTML under
`ui://opencraft/apps/<owner-hash>/<app-id>/sha256-<digest>.html`.
Each runtime server also pins the release number. Backend-only edits can retain
the same resource URI while changing the server revision. Rollback changes only
the active pointer. Unpublish revokes tool/resource access while retaining drafts
and releases. Delete removes HTML/code/releases and leaves a minimal identity,
version and next-revision fence: recreating the ID cannot rebind an old iframe
to new code. `get` exposes that fence for explicit recreation. Restart restores
published definitions without loading all Apps or executing generated code.

Limits: 64 non-deleted Apps, 256 lifetime IDs, 64 release numbers per App and
16 MiB total definition text per owner; 650 KB input spec, 512 KB HTML, 16 tools.
Lists are bounded and include compact titles/descriptions; get with revision reads the exact immutable spec. These are definition limits, not a durable business-data API.

## Generated code and UI

Handlers run synchronously in a fresh QuickJS WASM realm in a separate worker,
with no Node, files, network, host callbacks or secrets. Runtime memory is 16 MiB,
stack 256 KiB, guest execution budget 100 ms, total worker lifetime 3 seconds,
output 128 KiB, and global worker concurrency four. The runtime closure is pinned
and packaged independently; only the release/sync variant is shipped. No WASM is
loaded on gateway startup or into the renderer. Infinite loops, async return
values, memory exhaustion and oversize output fail explicitly. JSON Schema is a
bounded local subset without remote references or regex; inputs and declared
outputs are checked. Generated code cannot persist business data or call an
external integration implicitly. View state uses the existing widget state; real
business services need a separately authorized integration.

The management UI uses bounded widget state to retain small unsaved edits across
iframe disposal. Large definitions require explicit Save Draft before leaving;
the UI explains this rather than silently exceeding the existing 32 KiB state
budget. Deletion uses an in-frame confirmation dialog, compatible with the
opaque sandbox. The management UI and generated HTML have no external script/resource grants.
The current client host retains foreground/viewport lazy loading and background
frame disposal. No new polling or subscriptions run while Apps are closed.
The builder UI is an explicit management resource, not a startup page.

## Verification

`npm run test:mcp-apps` covers store versions, CAS, ownership, revocation, worker
limits, managed migration/checksum behavior and a real isolated packaged runtime.
`scripts/smoke-mcp-app-builder.ts` builds the production Conversation/host and
runs real WebSocket gateway/Actor/SQLite/QuickJS operations at 390/1280 px;
only the model/engine and proof provider are synthetic. It covers AI tool
requests, validation/publication/open, iframe tool calls, manager UI, rollback
and a separate Actor. This is not a paid model, employee account or iPhone test.
