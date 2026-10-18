import assert from "node:assert/strict";
import test from "node:test";
import { createIntl } from "react-intl";
import { embeddedLocaleCatalogs } from "../apps/workbench-web/src/i18n/catalogs";
import { shellNavigationLabels } from "../apps/workbench-web/src/components/shell-navigation/navigation-labels";
import { shellAccountEntranceLabel } from "../apps/workbench-web/src/components/shell-navigation/navigation-content";

const ids = ["shell.start", "shell.chat", "opencraft.tasks.navigation", "lightvela.collaboration.workspace", "lightvela.hermes.skills"];
const expected = {
  "zh-CN": ["开始", "会话", "任务", "协作", "技能"],
  "en-US": ["Start", "Chats", "Tasks", "Collab", "Skills"],
  "ms-MY": ["Mula", "Chat", "Tugas", "Kerja", "Mahir"],
  "th-TH": ["เริ่ม", "แชต", "งาน", "ร่วม", "ทักษะ"],
};
for (const [locale, labels] of Object.entries(expected)) test(`sidebar uses ${locale} compact copy and preserves complete names`, async () => {
  const messages = await embeddedLocaleCatalogs.find(catalog => catalog.locale === locale)!.load();
  const intl = createIntl({locale, messages, onError: error => { if (error.code !== "MISSING_TRANSLATION") throw error; }});
  const projected = ids.map(id => shellNavigationLabels({id, title: "Untranslated contribution title", onInvoke() {}}, intl));
  assert.deepEqual(projected.map(label => label.short), labels);
  assert.ok(projected.every(label => label.full !== "Untranslated contribution title"));
  if (locale === "en-US") assert.equal(projected[3]!.full, "Collaboration");
  const account = {providerId: "example.identity", snapshot: {revision: 0, phase: "anonymous" as const, name: null, avatarUrl: null, anonymousLabel: "Example account", anonymousLabelMessage: {id: "example.identity.title", defaultMessage: "Example account"}, planLabel: null, usageRemainingPercent: null, error: null}, onOpen() {}, onRefresh: async () => {}};
  if (locale !== "zh-CN") assert.notEqual(shellAccountEntranceLabel(account, intl), "员工身份");
  assert.equal(shellAccountEntranceLabel({...account, snapshot: {...account.snapshot, phase: "authenticated", name: "Synthetic employee"}}, intl), "Synthetic employee");
});

test("unknown extension names use the contribution's full and optional short copy", () => {
  const intl = createIntl({locale: "en-US", messages: {}});
  assert.deepEqual(shellNavigationLabels({id: "third-party", title: "Full extension name", shortTitle: "Tools", onInvoke() {}}, intl), {full: "Full extension name", short: "Tools"});
});
