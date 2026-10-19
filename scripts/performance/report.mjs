import assert from 'node:assert/strict';

export const scenarios = Object.freeze({
  'catalog-desktop': ['firstPaintMs', 'completePaintMs'],
  'catalog-narrow': ['firstPaintMs', 'completePaintMs'],
  'session-desktop': ['firstPaintMs', 'readyMs'],
  'session-warm-desktop': ['firstPaintMs', 'readyMs'],
  'session-narrow': ['firstPaintMs', 'readyMs'],
  'session-warm-narrow': ['firstPaintMs', 'readyMs'],
  'sidebar-update-30': ['ms'], 'sidebar-update-200': ['ms'],
  'sidebar-menu-30': ['ms'], 'sidebar-menu-200': ['ms'],
});
const exactKeys = (object, keys, label) => assert.deepEqual(Object.keys(object).sort(), [...keys].sort(), label);
const duration = value => assert.ok(typeof value === 'number' && Number.isFinite(value) && value >= 0, 'Durations must be finite nonnegative milliseconds');
export function summarize(evidence) {
  assert.ok(Array.isArray(evidence));
  const result = {};
  for (const row of evidence) {
    assert.ok(Object.hasOwn(scenarios, row.id) && !Object.hasOwn(result, row.id), `Unknown or duplicate scenario: ${row.id}`);
    assert.ok(Array.isArray(row.samples) && row.samples.length >= 10, `${row.id}: at least ten samples required`);
    const metrics = {};
    for (const key of scenarios[row.id]) {
      const values = row.samples.map(sample => { assert.ok(Object.hasOwn(sample, key), `${row.id}: missing ${key}`); duration(sample[key]); return sample[key]; }).sort((a, b) => a - b);
      const middle = Math.floor(values.length / 2);
      metrics[key] = { p50: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2, p95: values[Math.ceil(values.length * .95) - 1] };
    }
    result[row.id] = { count: row.samples.length, metrics };
  }
  exactKeys(result, Object.keys(scenarios), 'Missing required performance scenario');
  return result;
}
export function candidate(summary, workload, environment) {
  return { schemaVersion: 1, workload, unit: 'ms', calibration: environment, scenarios: Object.fromEntries(Object.entries(summary).map(([id, row]) => [id,
    Object.fromEntries(Object.entries(row.metrics).map(([metric, quantiles]) => [metric, { ...quantiles, relativeTolerance: .30, absoluteToleranceMs: id.startsWith('sidebar-') ? 50 : id.startsWith('catalog-') && metric === 'completePaintMs' ? 150 : 100 }]))])) };
}
export function compare(summary, baseline, workload) {
  assert.equal(baseline.schemaVersion, 1, 'Unknown baseline schema');
  assert.equal(baseline.unit, 'ms', 'Baseline unit mismatch');
  assert.deepEqual(baseline.workload, workload, 'Workload changed: calibrate an explicit baseline candidate');
  exactKeys(baseline.scenarios, Object.keys(scenarios), 'Baseline scenario mismatch');
  const comparisons = [];
  for (const [id, metrics] of Object.entries(scenarios)) {
    exactKeys(baseline.scenarios[id], metrics, `${id}: baseline metric mismatch`);
    for (const metric of metrics) {
      const budget = baseline.scenarios[id][metric];
      duration(budget.relativeTolerance); duration(budget.absoluteToleranceMs);
      assert.ok(budget.relativeTolerance <= 1, 'Tolerance cannot exceed 100%');
      for (const quantile of ['p50', 'p95']) {
        duration(budget[quantile]); duration(summary[id].metrics[metric][quantile]);
        const limit = budget[quantile] * (1 + budget.relativeTolerance) + budget.absoluteToleranceMs;
        const actual = summary[id].metrics[metric][quantile];
        comparisons.push({ scenario: id, metric, quantile, baseline: budget[quantile], actual, limit, passed: actual <= limit });
      }
    }
  }
  return { passed: comparisons.every(row => row.passed), comparisons };
}
export function markdown(report) {
  const lines = ['# Performance regression report', '', `Result: **${report.passed ? 'PASS' : 'FAIL'}**`, '',
    `Source: ${report.environment?.sourceRevision ?? 'unknown'}; workload: ${report.workload?.sha256 ?? 'unknown'}`, '',
    'Sample p95 is a nearest-rank statistic from this synthetic workload, not a user-population percentile.', '',
    '| Scenario | Metric | Quantile | Baseline (ms) | Actual (ms) | Limit (ms) | Result |',
    '| --- | --- | --- | ---: | ---: | ---: | --- |'];
  for (const r of report.comparisons ?? []) lines.push(`| ${r.scenario} | ${r.metric} | ${r.quantile} | ${r.baseline.toFixed(1)} | ${r.actual.toFixed(1)} | ${r.limit.toFixed(1)} | ${r.passed ? 'PASS' : 'FAIL'} |`);
  if (report.error) lines.push('', '```text', report.error, '```');
  return lines.join('\n') + '\n';
}
