import { openManagedDatabase, createSchemaValidator } from '../../packages/sqlite-node/src/index.js';
import { limits, sanitizeEvent } from '../../packages/observability-contract/index.mjs';
export const observationSchemaV1 = `
CREATE TABLE events(seq INTEGER PRIMARY KEY, event_id TEXT NOT NULL UNIQUE, at INTEGER NOT NULL, received INTEGER NOT NULL, kind TEXT NOT NULL, component TEXT NOT NULL, actor TEXT, body TEXT NOT NULL) STRICT;
CREATE INDEX events_window ON events(at,received);
CREATE INDEX events_received ON events(received);
CREATE TABLE executions(domain_key TEXT PRIMARY KEY, started INTEGER, ended INTEGER, outcome TEXT NOT NULL, updated INTEGER NOT NULL) STRICT;
CREATE TABLE producers(component TEXT NOT NULL, producer TEXT NOT NULL, received INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(component,producer)) STRICT;
CREATE TABLE metrics(name TEXT NOT NULL, dimension TEXT NOT NULL, value REAL NOT NULL, PRIMARY KEY(name,dimension)) STRICT;
`;
export const observationSchemaV2 = `
CREATE INDEX events_incident ON events(json_extract(body,'$.incidentRef'),at) WHERE json_extract(body,'$.incidentRef') IS NOT NULL;
CREATE INDEX executions_window ON executions(started,ended);
CREATE TABLE activity_hours(hour INTEGER NOT NULL, actor TEXT NOT NULL, PRIMARY KEY(hour,actor)) STRICT;
CREATE TABLE recovery_episodes(recovery_id TEXT PRIMARY KEY, first_at INTEGER NOT NULL, last_at INTEGER NOT NULL, outcome TEXT NOT NULL) STRICT;
CREATE INDEX recovery_window ON recovery_episodes(first_at,last_at);
`;
const backfill = `
INSERT OR IGNORE INTO activity_hours SELECT CAST(at/3600000 AS INTEGER),actor FROM events WHERE actor IS NOT NULL AND json_extract(body,'$.actorKind')='human' AND json_extract(body,'$.originClass')='interactive';
INSERT OR IGNORE INTO recovery_episodes SELECT json_extract(body,'$.recoveryId'),min(at),max(at),'unknown' FROM events WHERE kind='recovery' AND json_extract(body,'$.recoveryId') IS NOT NULL GROUP BY json_extract(body,'$.recoveryId');
`;
export class ObserveStore {
  db; outcome; accepted = 0; rejected = 0; dropped = 0;
  constructor(path: string, readonly now = Date.now) {
    const managed = openManagedDatabase({ path, legacyPolicy: 'reject', backup: {keep: 1},
      validateSchema: createSchemaValidator(observationSchemaV1+observationSchemaV2), migrations: [{version: 1, name: 'bounded-derived-observations', sql: observationSchemaV1},{version:2,name:'bounded-query-indexes-and-domain-rollups',sql:observationSchemaV2+backfill}] });
    this.db = managed.database; this.outcome = managed.outcome;
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=50; PRAGMA max_page_count=110000; PRAGMA journal_size_limit=33554432;');
  }
  ingest(inputs: unknown[], actor: string | null = null) {
    let accepted = 0, rejected = 0, duplicates = 0, dropped = 0;
    const now = this.now();
    this.db.exec('BEGIN');
    try {
      for (const input of inputs) {
        const event = sanitizeEvent(input, now);
        if (!event) { rejected++; continue; }
        const body = JSON.stringify(event);
        try {
          const result = this.db.prepare('INSERT OR IGNORE INTO events(event_id,at,received,kind,component,actor,body) VALUES(?,?,?,?,?,?,?)')
            .run(event.eventId, event.at, now, event.kind, event.component, actor, body);
          if (!result.changes) { duplicates++; continue; }
          accepted++;
          if(actor&&event.actorKind==='human'&&event.originClass==='interactive')this.db.prepare('INSERT OR IGNORE INTO activity_hours VALUES(?,?)').run(Math.floor(event.at/3600000),actor);
          if(event.kind==='recovery'&&event.recoveryId)this.db.prepare(`INSERT INTO recovery_episodes VALUES(?,?,?,?) ON CONFLICT(recovery_id) DO UPDATE SET first_at=MIN(recovery_episodes.first_at,excluded.first_at),last_at=MAX(recovery_episodes.last_at,excluded.last_at),outcome=CASE WHEN recovery_episodes.outcome='ok' THEN 'ok' ELSE excluded.outcome END`).run(event.recoveryId,event.at,event.at,event.outcome??'unknown');
          this.db.prepare('INSERT INTO producers VALUES(?,?,?,?) ON CONFLICT(component,producer) DO UPDATE SET received=excluded.received,body=json_patch(producers.body,excluded.body)')
            .run(event.component,event.producerId,now,body);
          const add = (name: string, dimension: string, value: number) => this.db.prepare('INSERT INTO metrics VALUES(?,?,?) ON CONFLICT(name,dimension) DO UPDATE SET value=metrics.value+excluded.value').run(name,dimension,value);
          if (event.kind === 'rpc' && event.method && event.outcome) add('rpc',JSON.stringify([event.method,event.outcome]),1);
          if (event.kind === 'operation' && event.operationType && event.outcome === 'ok' && event.durationMs !== undefined) {
            for (const le of [.05,.1,.25,.5,1,2,5,10,30,60,Infinity]) if (event.durationMs / 1000 <= le) add('operation_bucket',JSON.stringify([event.operationType,le===Infinity?'+Inf':le]),1);
            add('operation_count',event.operationType,1);add('operation_sum',event.operationType,event.durationMs/1000);
          }
          if (event.kind === 'execution' && event.executionId) {
            const key = `${event.engine ?? event.component}:${event.executionId}`;
            const terminal = ['ok','failed','aborted','timeout'].includes(event.outcome);
            this.db.prepare(`INSERT INTO executions VALUES(?,?,?,?,?) ON CONFLICT(domain_key) DO UPDATE SET
              started=COALESCE(executions.started,excluded.started), ended=COALESCE(executions.ended,excluded.ended),
              outcome=CASE WHEN executions.ended IS NULL THEN excluded.outcome ELSE executions.outcome END, updated=MAX(executions.updated,excluded.updated)`)
              .run(key,event.outcome==='started'?event.at:null,terminal?event.at:null,event.outcome??'unknown',now);
          }
        } catch { dropped++; }
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    this.accepted += accepted; this.rejected += rejected; this.dropped += dropped;
    return {accepted,rejected,duplicates,dropped};
  }
  events(from: number, to: number, through: number, count = limits.rows) {
    return this.db.prepare('SELECT body,received FROM events WHERE at>=? AND at<=? AND received<=? ORDER BY at,seq LIMIT ?')
      .all(from,to,through,count+1).map(row => ({...JSON.parse(row.body as string), receivedAt: row.received}));
  }
  producers() { return this.db.prepare('SELECT component,producer,received,body FROM producers').all().map(row=>({...row, identity:JSON.parse(row.body as string)})); }
  activity(from: number, to: number) {
    const first=Math.ceil(from/3600000),last=Math.floor(to/3600000);
    return this.db.prepare(`SELECT count(DISTINCT actor) AS humans FROM (
      SELECT actor FROM activity_hours WHERE hour>=? AND hour<?
      UNION SELECT actor FROM events WHERE at>=? AND at<=? AND (at<? OR at>=?) AND actor IS NOT NULL AND json_extract(body,'$.actorKind')='human' AND json_extract(body,'$.originClass')='interactive'
    )`).get(first,last,from,to,first*3600000,last*3600000);
  }
  recoveries(from: number, to: number) {
    return this.db.prepare('SELECT count(*) AS value FROM recovery_episodes WHERE first_at<=? AND last_at>=?').get(to,from);
  }
  executions(from: number, to: number) {
    return this.db.prepare('SELECT outcome,count(*) AS count FROM executions WHERE started<=? AND COALESCE(ended,?)>=? GROUP BY outcome').all(to,to,from);
  }
  prune() {
    const cutoff = this.now()-limits.retentionMs;
    this.db.prepare('DELETE FROM events WHERE seq IN (SELECT seq FROM events WHERE received<? ORDER BY received LIMIT 10000)').run(cutoff);
    this.db.prepare('DELETE FROM executions WHERE updated<?').run(cutoff);
    this.db.prepare('DELETE FROM producers WHERE received<?').run(cutoff);
    this.db.prepare('DELETE FROM activity_hours WHERE hour<?').run(Math.floor(cutoff/3600000));
    this.db.prepare('DELETE FROM recovery_episodes WHERE last_at<?').run(cutoff);
    this.db.exec('PRAGMA wal_checkpoint(PASSIVE)');
  }
  close() { this.db.close(); }
}
