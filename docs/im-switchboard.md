# IM switchboard and WeCom plugins

Headless supplies two optional trusted server plugins. `@opencraft/plugin-im`
owns chat-to-conversation bindings and per-message reply context.
`@opencraft/plugin-wecom` depends on its message contract and owns the WeCom
WebSocket protocol. Core retains human identity, authorization, native
conversations, message idempotency and execution queues. These server plugins
are separate from downloadable browser Extensions. Without explicit private
configuration they open no database or connection.

## Ownership and data

A bot endpoint has a stable operator-assigned ID and one existing human owner.
External sender IDs are explicitly bound to existing human Actors after the
operator verifies their identity. A callback cannot submit an Actor ID or
inherit its bot owner's permissions. Unknown senders, disabled owners and
revoked instance members are refused. Names never establish identity.
There is no additional tenant object.

The IM plugin opens `im-switchboard.sqlite` through the managed SQLite lifecycle.
Its only application table is `switchboard`:

| Column | Meaning |
| --- | --- |
| `id` | Stable binding row ID |
| `bot_endpoint_id` | Configured bot endpoint |
| `source_key` | Tuple of chat type, chat ID, optional thread ID and policy-selected sender |
| `conversation_ref` | Core `{serverId, threadId}` identity |

`(bot_endpoint_id, source_key)` is unique. Direct chats include sender identity;
groups can share a binding per chat or use one per sender. Endpoint IDs provide
the platform namespace. Keys prevent collisions and do not confer authorization.
Keep endpoint IDs stable; changing ownership or sender mappings is an explicit
operator configuration change, not an automatic account migration.

First input creates and binds a durable native conversation. `/new` creates and
binds another conversation. `/switch opencraft://conversation/v1/.../...`
validates and binds an existing authorized conversation. Old histories remain.
Admission and binding changes serialize per source; running turns do not block
these commands. Each accepted message captures its conversation, authenticated
human generation and original adapter reply closure. Its result comes from the
original core execution receipt's exact Turn ID, never the latest Turn or binding.
Core Collaboration persists input/idempotency/handoff and delegates execution to
the existing Host queue. There is no additional runnable IM queue.

Reply context and bounded callback deduplication live in memory. No persistent
Flow or outgoing delivery ledger is introduced. Restart preserves bindings and
core input receipts but does not resume IM replies. Reconnect invalidates old
WeCom callback closures. An unknown ACK outcome is not retried. Submitted input
does not mean completed execution or delivered answer. Slash-command
deduplication is runtime-only.

## Configure Headless

Create an owner-only regular JSON file owned by the service user (`0600`).
Headless rejects symlinks, unknown fields, duplicate endpoint/Bot IDs and empty
sender mappings. Use exact human Actor IDs from the authenticated identity API;
sender IDs must match this bot's verified WeCom identifiers.

```json
{
  "schemaVersion": 1,
  "endpoints": [{
    "id": "support-wecom",
    "provider": "wecom",
    "ownerId": "human://DEPLOYMENT/OWNER",
    "senders": {"VERIFIED_EXTERNAL_USER_ID": "human://DEPLOYMENT/PERSON"},
    "groupScope": "chat",
    "botId": "BOT_ID",
    "secret": "BOT_SECRET"
  }]
}
```

Use `--im-config /absolute/private/im.json` or `OPENCRAFT_IM_CONFIG_FILE`.
Managed Headless accepts the same CLI argument. Configuration is read at startup;
replace it through the normal deployment lifecycle. This first implementation
does not add a browser configuration page. Human provisioning stays with the
existing account/identity provider. The execution adapter targets the deployment's
local Codex conversation server using its existing execution policy.

Core's existing shared-instance human access to native conversations remains
unchanged. This feature isolates IM ownership and bindings, not the underlying
filesystem or native history by human. Isolated native resources require core
authorization to implement that policy.

## WeCom behavior and operations

The adapter follows the [official long-connection contract](https://developer.work.weixin.qq.com/document/path/101463).
It uses the fixed official WSS endpoint, Bot ID/secret subscription, 30-second
heartbeats and bounded exponential reconnect. Callback Bot ID and sender are
checked; `compat_info` sources are not admitted as ordinary human messages.
Text, recognized voice text and text portions of mixed messages enter IM.
Group command recognition accepts a leading single bot mention before `/new`
or `/switch`; ordinary prose and direct-message mentions remain unchanged.
Attachments, welcome events, template cards and proactive push are out of scope.

After core admission it sends a processing stream update and, after execution,
a final response on the original request ID. Each send awaits its ACK. This is
processing/final feedback, not token-by-token generation. Long answers are
bounded in UTF-8 bytes and include a conversation link. Result observation stops
after five minutes; execution may continue. A recoverable result error sends a
generic conversation link. Revocation or connection loss prevents late replies;
uncertain sends are not replayed.

Health responses include `plugins["opencraft.im"]` connection phases and safe
error categories. Storage outcomes report managed switchboard migration status.
Credentials, identity mappings, content and raw remote errors are excluded.
Shutdown closes protocol consumers, aborts reply observation, and closes plugin
storage before core execution and identity providers.

## Validation scope

`tests/im-switchboard.test.ts` covers binding changes during execution, multiple
sources, duplicates, authorization, durable reopen and checksum rejection.
`tests/wecom-plugin.test.ts` uses loopback WebSockets for subscribe/ACK,
normalization, original callback replies and connection fencing. Synthetic peers
do not prove real WeCom credentials, reachability or delivery. A real bot must
be configured and exercised before claiming that external path is operational.
