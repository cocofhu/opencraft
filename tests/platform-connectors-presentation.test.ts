import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { CONNECTOR_CATALOG } from "@opencraft/connector-core";

test("service catalog owns one specific guide and has a local brand asset per entry", () => {
  for (const entry of CONNECTOR_CATALOG) {
    assert.equal(entry.steps.length, 1);
    assert.ok(!entry.steps[0].includes("在此填写并保存配置"));
    const root = `../apps/workbench-web/src/assets/connector-brands/${entry.id}`;
    assert.ok(["png", "svg"].some(extension => existsSync(new URL(`${root}.${extension}`, import.meta.url))), entry.id);
  }
});
