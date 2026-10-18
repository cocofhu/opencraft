import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { requireReferenceDirectory } from "../scripts/lib/reference-input";
import { loadCodexActivityFunctions } from "../scripts/lib/codex-activity-reference";

const root = resolve(import.meta.dirname, "..");

test("optional reference tools fail with an actionable input requirement before starting a browser", () => {
  const env = { ...process.env };
  delete env.CODEX_REFERENCE_ROOT;
  delete env.CODEX_SCROLL_REFERENCE_ROOT;
  for (const script of ["compare-codex-scroll.ts", "compare-codex-work-status.ts", "compare-codex-activity-rendering.ts", "diagnose-work-status-completion.ts"]) {
    const result = spawnSync(process.execPath, ["--import", "tsx", join(root, "scripts", script)], { cwd: root, env, encoding: "utf8", timeout: 15_000 });
    assert.equal(result.error, undefined, script);
    assert.equal(result.status, 1, script);
    assert.match(result.stderr, /Set CODEX_(?:SCROLL_)?REFERENCE_ROOT.*existing local reference directory/, script);
    assert.doesNotMatch(result.stderr, /ENOENT|browserType\.launch/, script);
  }
  for (const [script, required] of [["check-dsh-source.mjs", "reference-services-directory"], ["export-hermes-connector-catalog.mjs", "marketplace-directory"]]) {
    const result = spawnSync(process.execPath, [join(root, "scripts", script)], { cwd: tmpdir(), env, encoding: "utf8", timeout: 15_000 });
    assert.equal(result.error, undefined, script);
    assert.equal(result.status, 1, script);
    assert.ok(result.stderr.includes(`Usage: node scripts/${script} <${required}>`), script);
    assert.doesNotMatch(result.stderr, /ENOENT/, script);
  }
});

test("activity reference extraction reads only the explicitly selected snapshot", async t => {
  const directory = await mkdtemp(join(tmpdir(), "opencraft reference input "));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [file, names] of [
    ["lazy/app-initial/subagent-activity-chip-group-CC185tmV.js", ["DA", "TA", "fA", "pA", "mA", "OA", "_A", "gA", "ak", "ok", "Jw"]],
    ["lazy/app-initial/content-reference-markers-odMp_wjH.js", ["je"]],
    ["editor/shared/has-displayable-content.js", ["hasDisplayableContent", "isFinalAnswerPhase"]],
  ] as const) {
    await mkdir(resolve(directory, file, ".."), { recursive: true });
    await writeFile(join(directory, file), names.map(name => `export function ${name}() { return 'selected snapshot'; }`).join("\n"));
  }
  const source = loadCodexActivityFunctions(directory);
  assert.match(source.activity, /selected snapshot/);
  assert.match(source.demotion, /function je/);
  assert.equal(Object.keys(source.fingerprints).length, 14);
  assert.equal(requireReferenceDirectory(`  ${directory}  `, "REFERENCE"), directory);
  assert.throws(() => requireReferenceDirectory(" ", "REFERENCE"), /Set REFERENCE/);
  assert.throws(() => loadCodexActivityFunctions(join(directory, "absent")), /CODEX_REFERENCE_ROOT must name/);
  assert.throws(() => requireReferenceDirectory(join(directory, "editor/shared/has-displayable-content.js"), "REFERENCE"), /existing local reference directory/);
});

test("catalog export accepts an external snapshot without a machine-specific checkout", async t => {
  const directory = await mkdtemp(join(tmpdir(), "opencraft marketplace input "));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, ".codebuddy-connector"));
  await mkdir(join(directory, "icons"));
  await writeFile(join(directory, ".codebuddy-connector/connectors.json"), JSON.stringify({ connectors: [{ id: "example", name: "Example", type: "mcp" }] }));
  await writeFile(join(directory, "icons/example.svg"), "<svg/>");
  const before = await readFile(join(directory, ".codebuddy-connector/connectors.json"), "utf8");
  const result = spawnSync(process.execPath, [join(root, "scripts/export-hermes-connector-catalog.mjs"), directory], { cwd: tmpdir(), encoding: "utf8", timeout: 15_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"id":"example"/);
  assert.match(result.stdout, /\.\/icons\/example\.svg\?no-inline/);
  assert.equal(await readFile(join(directory, ".codebuddy-connector/connectors.json"), "utf8"), before);
});
