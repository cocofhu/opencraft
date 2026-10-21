import { randomUUID } from 'node:crypto';
import { openManagedDatabase, createSchemaValidator } from '@opencraft/sqlite-node';
import { conversationRef, type ConversationRef } from '@opencraft/appserver-protocol/collaboration';

const schema = `CREATE TABLE switchboard (
 id TEXT PRIMARY KEY, bot_endpoint_id TEXT NOT NULL, source_key TEXT NOT NULL,
 conversation_ref TEXT NOT NULL, UNIQUE(bot_endpoint_id,source_key)
) STRICT;`;
export const switchboardMigrations = [{ version: 1, name: 'im-switchboard', sql: schema }];

/** The IM plugin owns only current bindings; native conversations retain their history. */
export class SwitchboardStore {
  private readonly managed;
  constructor(path: string) {
    this.managed = openManagedDatabase({path, legacyPolicy: 'reject', migrations: switchboardMigrations, validateSchema: createSchemaValidator(schema)});
  }
  get outcome() { return this.managed.outcome; }
  get(endpointId: string, sourceKey: string): ConversationRef | null {
    const row = this.managed.database.prepare('SELECT conversation_ref FROM switchboard WHERE bot_endpoint_id=? AND source_key=?').get(endpointId,sourceKey);
    return row ? conversationRef(JSON.parse(String(row.conversation_ref))) : null;
  }
  bind(endpointId: string, sourceKey: string, ref: ConversationRef): void {
    this.managed.database.prepare(`INSERT INTO switchboard VALUES(?,?,?,?) ON CONFLICT(bot_endpoint_id,source_key) DO UPDATE SET conversation_ref=excluded.conversation_ref`)
      .run(randomUUID(),endpointId,sourceKey,JSON.stringify(conversationRef(ref)));
  }
  close() { this.managed.database.close(); }
}
