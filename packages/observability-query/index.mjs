import { fault } from '../observability-contract/index.mjs';
export const queryDefinitionRevision = 'observe-v1.1.0';
const latency = 'histogram_quantile(0.95, sum by (le, operation) (rate(opencraft_operation_duration_seconds_bucket[5m])))';
/** This is the only expression registry, shared by Observe and generated provisioning. */
export const definitions = Object.freeze({
  'platform.status': { title: 'Platform and collection status', kind: 'resource_sample', promql: 'opencraft_producer_age_seconds', unit: 'seconds' },
  'operations.latency': { title: 'Operation latency (histogram estimate)', kind: 'histogram_approximation', promql: latency, unit: 'seconds' },
  'recovery.episodes': { title: 'Recovery episodes (exact domain aggregation)', kind: 'exact_domain_aggregation', promql: 'opencraft_recovery_episodes', unit: 'episodes', windowSemantics:'rolling_24h_at_evaluation' },
  'execution.progress': { title: 'Observed execution lifecycle (exact domain aggregation)', kind: 'exact_domain_aggregation', promql: 'opencraft_executions', unit: 'executions', windowSemantics:'rolling_24h_at_evaluation' },
  'dependencies.summary': { title: 'Dependency attempts (counter estimate)', kind: 'histogram_approximation', promql: 'sum by (method, outcome) (increase(opencraft_rpc_total[5m]))', unit: 'attempts' },
  'resources.summary': { title: 'Process resident memory', kind: 'resource_sample', promql: 'opencraft_process_rss_bytes', unit: 'bytes' },
  'usage.activity': { title: 'Observed verified humans (7d union)', kind: 'exact_domain_aggregation', promql: 'opencraft_active_humans_7d', unit: 'humans', windowSemantics:'rolling_7d_at_evaluation' },
  'components.versions': { title: 'Component identity coverage', kind: 'resource_sample', promql: 'opencraft_component_identity_known', unit: 'boolean' },
  'data.coverage': { title: 'Collection losses', kind: 'resource_sample', promql: 'opencraft_telemetry_losses_total', unit: 'events' },
  'incident.read': { title: 'Captured incident evidence', kind: 'event_sample', unit: 'events' },
  'baseline.compare': { title: 'Comparable operation samples', kind: 'event_sample', unit: 'milliseconds' },
});
export const percentile = (values, p) => values.length ? [...values].sort((a,b) => a-b)[Math.max(0, Math.ceil(p * values.length)-1)] : null;
export function issues(snapshot) {
  const result = [];
  if (snapshot.coverage !== 'complete') result.push({ id: 'collection-incomplete', severity: 'warning', evidenceKind: 'observed', hypothesis: 'Inspect missing/stale producers before interpreting absence of failures.' });
  const failures = snapshot.events?.filter(e => ['failed','timeout'].includes(e.outcome)) ?? [];
  if (failures.length) result.push({ id: 'observed-failures', severity: 'warning', evidenceKind: 'observed', count: failures.length, hypothesis: 'Inspect the recorded operation and dependency stages; association does not establish cause.' });
  return result;
}
export function compare(before, after) {
  const reasons = [];
  for (const key of ['deploymentId','queryDefinitionRevision','metricSchemaVersion']) if (before[key] !== after[key]) reasons.push(`different_${key}`);
  if (before.coverage !== 'complete' || after.coverage !== 'complete' || before.loss?.dropped || after.loss?.dropped) reasons.push('incomplete_capture');
  const select = s => (s.events ?? []).filter(e => e.kind === 'operation' && e.outcome === 'ok' && Number.isFinite(e.durationMs));
  const left = select(before), right = select(after);
  const group = e => JSON.stringify([e.operationType,e.measurementScope,e.cache,e.engine,e.originClass,e.workloadDigest]);
  const groups = rows => [...new Set(rows.map(group))].sort();
  if (JSON.stringify(groups(left)) !== JSON.stringify(groups(right))) reasons.push('incompatible_workload');
  if (groups(left).length !== 1 || groups(right).length !== 1) reasons.push('mixed_or_missing_workload');
  const real = [...left,...right].every(e => e.originClass === 'interactive');
  if (real) { if (left.length < 100 || right.length < 100) reasons.push('insufficient_real_samples'); }
  else {
    const paired = left.filter(e => e.pairId && right.some(r => r.pairId === e.pairId));
    if (paired.length < 20 || new Set(paired.map(e => e.pairId)).size < 20) reasons.push('insufficient_paired_samples');
  }
  const summary = rows => ({ count: rows.length, medianMs: percentile(rows.map(e => e.durationMs),.5), sampleP95Ms: percentile(rows.map(e => e.durationMs),.95), failures: rows.filter(e => e.outcome === 'failed').length });
  const a = summary(left), b = summary(right);
  const direction = a.medianMs && b.medianMs < a.medianMs && b.sampleP95Ms < a.sampleP95Ms ? 'improved' : b.medianMs > a.medianMs && b.sampleP95Ms > a.sampleP95Ms ? 'regressed' : 'inconclusive';
  return { schemaVersion: 1, status: reasons.length ? 'inconclusive' : direction, reasons, before: a, after: b,
    evidenceKind: 'observed_association', causal: false, sideEffects: { beforeLoss: before.loss, afterLoss: after.loss,
      beforeFailures: (before.events??[]).filter(e=>['failed','timeout'].includes(e.outcome)).length,
      afterFailures: (after.events??[]).filter(e=>['failed','timeout'].includes(e.outcome)).length } };
}
export function requireQuery(name) { if (!Object.hasOwn(definitions,name)) throw fault('unknown_query'); return definitions[name]; }
