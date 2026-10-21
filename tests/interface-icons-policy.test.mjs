import assert from "node:assert/strict";
import test from "node:test";
import { inspectInterfaceIcons } from "../scripts/check-interface-icons.mjs";

test("stock artwork is rejected through aliases, registries and re-exports", () => {
  for (const source of [
    'import { House as H } from "lucide-react"; const registry = { home: H };',
    'export { Bot } from "lucide-react";',
    'import * as Stock from "lucide-react";',
  ]) assert.equal(inspectInterfaceIcons(source, "plugins/example/src/view.tsx").length, 1);
});
test("inline controls are rejected while shared artwork, avatars and retained silhouettes are accepted", () => {
  assert.equal(inspectInterfaceIcons("const icon = <svg><path d='M1 1'/></svg>", "packages/chat-render-web/src/control.tsx").length, 1);
  assert.deepEqual(inspectInterfaceIcons("const icon = <svg/>", "packages/design-system-web/src/interface-icons.tsx"), []);
  assert.deepEqual(inspectInterfaceIcons("const avatar = <svg/>", "plugins/bot-chat/src/bot-avatar.tsx"), []);
  const retained = "packages/design-system-web/src/retained-layout-icons.tsx";
  assert.deepEqual(inspectInterfaceIcons('export { PanelLeft as SidebarLayoutIcon, PanelLeftClose as SidebarCollapseLayoutIcon } from "lucide-react";', retained), []);
  assert.equal(inspectInterfaceIcons('export { House } from "lucide-react";', retained).length, 1);
});
