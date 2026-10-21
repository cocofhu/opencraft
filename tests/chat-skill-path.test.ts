import assert from "node:assert/strict";
import test from "node:test";
import { skillReadPresentation } from "../packages/chat-core/src/conversation-presentation";
import type { CommandExecutionTimelineBlock } from "../packages/chat-core/src/timeline";
import { formatSkillDisplayName, parseSkillPath } from "../packages/chat-core/src/skill-path";

test("recognized roots retain identity across definition and resource paths", () => {
  for (const owner of [".agents", ".codex"]) {
    for (const system of ["", ".system/"]) {
      const root = `/home/example/${owner}/skills/${system}api-client`;
      const base = {
        skillId: "api-client", skillRootPath: root, skillName: "API Client",
        pluginId: null, pluginDisplayName: null, pluginMarketplaceName: null,
        isSystem: system !== "", isInScriptsFolder: false, isSkillDefinitionFile: false,
      };
      assert.deepEqual(parseSkillPath(root), base);
      assert.deepEqual(parseSkillPath("skill.md", root), { ...base, isSkillDefinitionFile: true });
      assert.deepEqual(parseSkillPath(`${root}/scripts`), { ...base, isInScriptsFolder: true });
      assert.deepEqual(parseSkillPath(`${root}/scripts/check.ts`), { ...base, isInScriptsFolder: true });
      assert.deepEqual(parseSkillPath(`${root}/nested/SKILL.md`), base);
      assert.deepEqual(parseSkillPath(`${root}/README.md`), base);
    }
  }
});

test("plugin cache layout supplies marketplace, plugin and skill identity", () => {
  assert.deepEqual(parseSkillPath("/home/example/.codex/plugins/cache/market/my-plugin/1.2.3/skills/live/SKILL.md"), {
    skillId: "live", skillRootPath: "/home/example/.codex/plugins/cache/market/my-plugin/1.2.3/skills/live",
    skillName: "Live", pluginId: "my-plugin", pluginDisplayName: "My Plugin", pluginMarketplaceName: "market",
    isSystem: false, isInScriptsFolder: false, isSkillDefinitionFile: true,
  });
});

test("system marker is reserved for local skills, not plugin-owned identifiers", () => {
  const skill = parseSkillPath("/home/example/.codex/plugins/cache/market/plugin/1/skills/.system/review/SKILL.md");
  assert.equal(skill?.skillId, ".system");
  assert.equal(skill?.isSystem, false);
  assert.equal(skill?.isSkillDefinitionFile, false);
});

test("lexical normalization does not need a filesystem or Node path API", () => {
  const unix = parseSkillPath("../review/./SKILL.md", "/home/example/.agents/skills/other");
  assert.equal(unix?.skillRootPath, "/home/example/.agents/skills/review");
  assert.equal(unix?.isSkillDefinitionFile, true);
  const windows = parseSkillPath("C:\\home\\.codex\\skills\\review\\SKILL.md");
  assert.equal(windows?.skillRootPath, "C:/home/.codex/skills/review");
  assert.equal(windows?.isSkillDefinitionFile, true);
  assert.equal(parseSkillPath("/home/example/.agents/skills/review/../../README.md"), null);
  for (const path of ["", "SKILL.md", "/skills/review/SKILL.md", "/home/.agents/skills", "/tmp/README.md", "bad\0path"]) {
    assert.equal(parseSkillPath(path), null, path);
  }
});

test("ordinary display labels keep existing word normalization", () => {
  for (const [input, expected] of [
    ["using-superpowers", "Using Superpowers"], ["my_plugin", "My Plugin"],
    ["API-ui_sql", "API UI SQL"], ["mcp-cli-llm-url", "MCP CLI LLM URL"],
    ["HTTP-server", "Http Server"], ["testXML", "Testxml"], ["review.code", "Review.code"],
    ["hello  world", "Hello World"], ["  ", ""],
  ]) assert.equal(formatSkillDisplayName(input), expected);
});

test("Skill reads and plugin identity retain canonical names and title grammar", () => {
  for (const [skillId, label] of [
    ["gh-fix-ci", "GH Fix CI"], ["pdf", "PDF"], ["cpu-gpu", "CPU GPU"],
    ["ia-pr-tw", "IA PR TW"], ["github", "GitHub"], ["openai", "OpenAI"],
    ["openaideveloperdocs", "OpenAI Developer Docs"], ["openapi", "OpenAPI"],
    ["pagerduty", "PagerDuty"], ["datadog", "DataDog"], ["sharepoint", "SharePoint"],
    ["sqlite", "SQLite"], ["fastapi", "FastAPI"], ["APIs-and-PDFs", "APIs and PDFs"],
    ["up-with-github-or-openai", "Up with GitHub or OpenAI"],
    ["github:pdf-to-sql", "GitHub: PDF to SQL"],
    ["openai:up-to-date", "OpenAI: Up to Date"],
    ["mcp-api", "MCP API"], ["http-server", "Http Server"],
  ]) {
    const path = `/workspace/.agents/skills/${skillId}/SKILL.md`;
    const block = { actions: [{ type: "read", path, name: "SKILL.md" }], cwd: null,
      status: "complete" } as CommandExecutionTimelineBlock;
    assert.deepEqual(skillReadPresentation(block, "STEPS_PROSE"), {
      visible: true, summary: "Read", detail: `${label} skill`,
    }, skillId);
    const plugin = parseSkillPath(`/workspace/plugins/${skillId}/skills/pdf/SKILL.md`);
    assert.equal(plugin?.pluginDisplayName, label, skillId);
    assert.equal(plugin?.pluginId, skillId, skillId);
    assert.equal(parseSkillPath(path)?.skillId, skillId, skillId);
    assert.equal(parseSkillPath(path)?.skillRootPath, path.slice(0, -9), skillId);
  }
});
