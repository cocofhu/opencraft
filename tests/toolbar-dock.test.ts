import assert from "node:assert/strict";
import { test } from "node:test";
import { moveToolbarAction, projectToolbarDock, toolbarDockCapacity, toolbarDockKey, conversationToolbarActionIds } from "../apps/workbench-web/src/components/toolbar-dock-model";
import { uiPreferenceDefinitions, UiPreferencesRuntime, type UiPreferenceStore, type StoredUiPreference } from "../packages/ui-preferences/src/index";

test("capacity projection has one action owner and does not mutate personal intent", () => {
  const actions = [{ id: "link-tasks" }, { id: "rename" }, { id: "archive" }];
  const preferred = ["temporarily-unavailable", "rename", "link-tasks"];
  for (const capacity of [0, 1, 2, 4]) {
    const result = projectToolbarDock(actions, preferred, capacity);
    assert.equal(new Set([...result.docked, ...result.overflow].map(a => a.id)).size, actions.length);
    assert.equal(result.docked.length + result.overflow.length, actions.length);
    assert.deepEqual(result.docked.map(a => a.id), ["rename", "link-tasks"].slice(0, capacity));
  }
  assert.deepEqual(preferred, ["temporarily-unavailable", "rename", "link-tasks"]);
  assert.deepEqual(projectToolbarDock(actions, [], 4).docked, []);
  assert.equal(toolbarDockCapacity(200, 220, 32, 2, 4), 0);
  assert.equal(toolbarDockCapacity(412, 220, 32, 2, 4), 4);
  assert.equal(toolbarDockCapacity(412, 220, 48, 2, 4), 2);
});

test("move between zones preserves unrelated unavailable intent", () => {
  assert.deepEqual(moveToolbarAction(["missing", "link-tasks"], "rename", "link-tasks", true), ["missing", "rename", "link-tasks"]);
  assert.deepEqual(moveToolbarAction(["missing", "rename", "link-tasks"], "rename", null, false), ["missing", "link-tasks"]);
  assert.deepEqual(conversationToolbarActionIds({ port: {}, onRename() {}, im: {}, workspaceDirectory: "x" }), ["link-tasks", "rename", "im-sources", "information"]);
});

test("preference boundary rejects malformed and duplicated data, keeps deliberate empty docks", () => {
  const parse = uiPreferenceDefinitions["shell.toolbarDocks"].parse;
  assert.equal(parse([]), null);
  assert.equal(parse({ scope: ["rename", "rename"] }), null);
  assert.equal(parse({ scope: ["<script>"] }), null);
  assert.equal(parse({ scope: "rename" }), null);
  assert.deepEqual(parse({ scope: [] }), { scope: [] });
  assert.notEqual(toolbarDockKey("a", "b:c"), toolbarDockKey("a:b", "c"));
});

test("personal choices survive reopening and isolate scope; persistence failure is not success", async () => {
  const records = new Map<string, StoredUiPreference>();
  let fail = false;
  const store: UiPreferenceStore = {
    load: async key => records.get(key) ?? null,
    compareAndSet: async (key, revision, valueJson) => {
      if (fail) throw new Error("unavailable");
      const current = records.get(key)?.revision ?? 0;
      if (current !== revision) return { outcome: "conflict", revision: current };
      const record = { key, revision: current + 1, valueJson, updatedAt: Date.now() };
      records.set(key, record);
      return { outcome: "updated", record };
    },
  };
  const runtime = await UiPreferencesRuntime.open({ installation: store });
  const a = toolbarDockKey("account-a", "header"); const b = toolbarDockKey("account-b", "header");
  await runtime.set("shell.toolbarDocks", { [a]: ["rename", "missing", "link-tasks"], [b]: [] });
  const reopened = await UiPreferencesRuntime.open({ installation: store });
  assert.deepEqual(reopened.getSnapshot().values["shell.toolbarDocks"][a], ["rename", "missing", "link-tasks"]);
  assert.deepEqual(reopened.getSnapshot().values["shell.toolbarDocks"][b], []);
  fail = true;
  await assert.rejects(reopened.set("shell.toolbarDocks", {}, { optimistic: false }), /unavailable/);
  assert.deepEqual(reopened.getSnapshot().values["shell.toolbarDocks"][a], ["rename", "missing", "link-tasks"]);
});
