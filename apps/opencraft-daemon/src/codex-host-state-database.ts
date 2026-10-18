import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openManagedDatabase, createSchemaValidator, createMissingLegacyObjects, type DatabaseOutcome } from "@opencraft/sqlite-node";

export const CODEX_HOST_STATE_BASELINE = `
CREATE TABLE codex_host_queue (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        input_json TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('queued','dispatching','steering','unknown','delivered','discarded')),
        target_turn_id TEXT,
        paused_reason TEXT,
        UNIQUE(thread_id, client_id)
      ) STRICT;
      CREATE INDEX codex_host_queue_order ON codex_host_queue(thread_id, position, created_at_ms);
      CREATE INDEX codex_host_queue_state ON codex_host_queue(state, thread_id);
CREATE TABLE message_senders (
        thread_id TEXT NOT NULL, client_message_id TEXT NOT NULL,
        sender_json TEXT NOT NULL, accepted_at_ms INTEGER NOT NULL,
        PRIMARY KEY(thread_id,client_message_id)
      ) STRICT;
CREATE TABLE ioa_message_presence (
      thread_id TEXT NOT NULL, client_message_id TEXT NOT NULL, login_name TEXT NOT NULL,
      PRIMARY KEY(thread_id,client_message_id)) STRICT;
      CREATE INDEX ioa_presence_names ON ioa_message_presence(thread_id,login_name);
      CREATE TABLE ioa_participant_state (
      thread_id TEXT PRIMARY KEY, revision INTEGER NOT NULL) STRICT;
`;

/** v2 is additive; the published v1 SQL above is intentionally unchanged. */
export const CODEX_HOST_BOT_STATE = `
CREATE TABLE codex_bot_rooms (
  thread_id TEXT PRIMARY KEY, created_ms INTEGER NOT NULL,
  cwd TEXT, draft INTEGER NOT NULL DEFAULT 0, native_thread_id TEXT
);
CREATE TABLE codex_bot_commands (command_key TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result_json TEXT);
CREATE TABLE codex_bot_message_slots (
  room_id TEXT NOT NULL, turn_id TEXT NOT NULL, kind TEXT NOT NULL, ordinal INTEGER NOT NULL,
  native_id TEXT, PRIMARY KEY(room_id, turn_id, kind, ordinal), UNIQUE(room_id, turn_id, kind, native_id)
);
`;
export const CODEX_HOST_IOA_CREATORS = `
CREATE TABLE ioa_thread_creators (
  thread_id TEXT PRIMARY KEY, login_name TEXT
) STRICT;
`;
/** Provenance is independent of the preserved author of a copied message. */
export const CODEX_HOST_SENDER_ORIGINS = `
CREATE TABLE message_sender_origins (
  thread_id TEXT NOT NULL, client_message_id TEXT NOT NULL, source_thread_id TEXT NOT NULL,
  PRIMARY KEY(thread_id,client_message_id)
) STRICT;
`;
const LEGACY_SCHEMA = CODEX_HOST_STATE_BASELINE + CODEX_HOST_BOT_STATE;
export const CODEX_HOST_CATALOG = `
CREATE TABLE codex_thread_catalog (
  thread_id TEXT PRIMARY KEY, metadata_json TEXT NOT NULL,
  updated_at REAL NOT NULL, archived INTEGER NOT NULL CHECK(archived IN (0,1)),
  observed_at_ms INTEGER NOT NULL, revision INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0 CHECK(deleted IN (0,1))
) STRICT;
CREATE INDEX codex_thread_catalog_recency ON codex_thread_catalog(archived,deleted,updated_at DESC,thread_id);
CREATE TABLE codex_catalog_sync (
  archived INTEGER PRIMARY KEY CHECK(archived IN (0,1)),
  last_success_ms INTEGER, watermark REAL, last_full_ms INTEGER,
  state TEXT NOT NULL CHECK(state IN ('syncing','ready','error'))
) STRICT;
CREATE TABLE ioa_presence_sync (
  thread_id TEXT PRIMARY KEY, reconciled_at_ms INTEGER NOT NULL
) STRICT;
`;
const FULL_SCHEMA = LEGACY_SCHEMA + CODEX_HOST_IOA_CREATORS + CODEX_HOST_SENDER_ORIGINS + CODEX_HOST_CATALOG;
// The early surviving source and deployed CREATE/ALTER sequence prove these
// room layouts. Only known objects/constraints are accepted; records are retained.
const LEGACY_ROOM_COLUMNS = [
  "thread_id TEXT PRIMARY KEY, created_ms INTEGER NOT NULL",
  "thread_id TEXT PRIMARY KEY, created_ms INTEGER NOT NULL, native_thread_id TEXT",
  "thread_id TEXT PRIMARY KEY, created_ms INTEGER NOT NULL, native_thread_id TEXT, cwd TEXT, draft INTEGER NOT NULL DEFAULT 0",
  "thread_id TEXT PRIMARY KEY, created_ms INTEGER NOT NULL, cwd TEXT, draft INTEGER NOT NULL DEFAULT 0, native_thread_id TEXT",
];
const legacyCandidates = LEGACY_ROOM_COLUMNS.map(columns => createMissingLegacyObjects(
  LEGACY_SCHEMA.replace(/CREATE TABLE codex_bot_rooms \([\s\S]*?\);/, `CREATE TABLE codex_bot_rooms (${columns});`),
));
const legacyMigration = {
  accepts: (fingerprint: string, objects: Parameters<(typeof legacyCandidates)[number]["accepts"]>[1]) =>
    legacyCandidates.some(candidate => candidate.accepts(fingerprint, objects)),
  migrate: (database: DatabaseSync) => {
    const columns = database.prepare("PRAGMA table_info(codex_bot_rooms)").all().map(row => String(row.name));
    if (columns.length && columns.join(",") !== "thread_id,created_ms,cwd,draft,native_thread_id") {
      database.exec("ALTER TABLE codex_bot_rooms RENAME TO codex_bot_rooms_legacy");
      database.exec(CODEX_HOST_BOT_STATE.slice(0, CODEX_HOST_BOT_STATE.indexOf("CREATE TABLE codex_bot_commands")));
      const existing = (name: string, fallback: string) => columns.includes(name) ? name : fallback;
      database.exec(`INSERT INTO codex_bot_rooms(thread_id,created_ms,cwd,draft,native_thread_id)
        SELECT thread_id,created_ms,${existing("cwd", "NULL")},${existing("draft", "0")},${existing("native_thread_id", "NULL")}
        FROM codex_bot_rooms_legacy; DROP TABLE codex_bot_rooms_legacy;`);
    }
    database.exec(FULL_SCHEMA.replace(/CREATE (TABLE|INDEX) /g, "CREATE $1 IF NOT EXISTS "));
  },
};

/** Queue and message provenance share the existing per-Host file and transaction owner. */
export class CodexHostStateDatabase {
  readonly database: DatabaseSync;
  readonly outcome: DatabaseOutcome;
  constructor(directory: string) {
    const path = join(directory, "codex-host-queue.sqlite");
    const managed = openManagedDatabase({ path, legacyPolicy: "reject-unknown", validateSchema: createSchemaValidator(FULL_SCHEMA), migrations: [
      { version: 1, name: "codex-host-state", sql: CODEX_HOST_STATE_BASELINE },
      { version: 2, name: "codex-bot-state", sql: CODEX_HOST_BOT_STATE },
      { version: 3, name: "ioa-thread-creators", sql: CODEX_HOST_IOA_CREATORS },
      { version: 4, name: "message-sender-origins", sql: CODEX_HOST_SENDER_ORIGINS },
      { version: 5, name: "durable-thread-catalog", sql: CODEX_HOST_CATALOG },
    ], legacyMigration });
    this.database = managed.database;
    this.outcome = managed.outcome;
  }
  transaction<T>(write: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try { const result = write(); this.database.exec("COMMIT"); return result; }
    catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
  close(): void { this.database.close(); }
}
