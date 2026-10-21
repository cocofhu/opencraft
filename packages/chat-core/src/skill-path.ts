
export interface SkillPathInfo {
  readonly skillId: string;
  readonly skillRootPath: string;
  readonly skillName: string;
  readonly pluginId: string | null;
  readonly pluginDisplayName: string | null;
  readonly pluginMarketplaceName: string | null;
  readonly isSystem: boolean;
  readonly isInScriptsFolder: boolean;
  readonly isSkillDefinitionFile: boolean;
}

const skillInitialisms = new Set("GH IA MCP API CI CLI LLM PDF PR UI URL SQL TW GPU CPU".split(" "));
const skillNameSpellings = new Map([
  ["openai", "OpenAI"], ["openaideveloperdocs", "OpenAI Developer Docs"],
  ["openapi", "OpenAPI"], ["github", "GitHub"], ["pagerduty", "PagerDuty"],
  ["datadog", "DataDog"], ["sharepoint", "SharePoint"], ["sqlite", "SQLite"],
  ["fastapi", "FastAPI"],
]);
const skillTitleConnectors = new Set(["and", "or", "to", "up", "with"]);

export function formatSkillDisplayName(value: string): string {
  return value.split(":").map(namespace => namespace.trim().split(/[\s_-]+/u)
    .filter(Boolean).map((word, index) => {
      const lower = word.toLowerCase();
      const upper = word.toUpperCase();
      if (skillInitialisms.has(upper)) return upper;
      if (lower.endsWith("s") && skillInitialisms.has(upper.slice(0, -1))) {
        return `${upper.slice(0, -1)}s`;
      }
      return skillNameSpellings.get(lower)
        ?? (index > 0 && skillTitleConnectors.has(lower) ? lower
          : lower.slice(0, 1).toUpperCase() + lower.slice(1));
    }).join(" ")).join(": ");
}

function components(path: string, cwd: string | null): string[] {
  const portable = path.replaceAll("\\", "/");
  const absolute = portable.startsWith("/") || /^[a-z]:\//iu.test(portable);
  const combined = absolute || !cwd ? portable : `${cwd.replaceAll("\\", "/")}/${portable}`;
  const parts: string[] = [];
  for (const part of combined.split("/")) {
    if (part === "." || (part === "" && parts.length > 0)) continue;
    if (part === "..") {
      if (parts.length > 0 && parts.at(-1) !== ".." && parts.at(-1) !== "" && !/^[a-z]:$/iu.test(parts.at(-1) ?? "")) parts.pop();
      else if (parts[0] !== "" && !/^[a-z]:$/iu.test(parts[0] ?? "")) parts.push(part);
    } else {
      parts.push(part);
    }
  }
  return parts;
}

export function parseSkillPath(path: string, cwd: string | null = null): SkillPathInfo | null {
  if (!path.trim() || path.includes("\0")) return null;
  const parts = components(path, cwd);
  for (let owner = 0; owner < parts.length; owner++) {
    if (parts[owner] !== ".codex" && parts[owner] !== ".agents") continue;
    let root: number;
    let pluginId: string | null = null;
    let pluginMarketplaceName: string | null = null;
    if (parts[owner + 1] === "skills") {
      root = owner + 2;
    } else if (parts[owner] === ".codex"
      && parts[owner + 1] === "plugins" && parts[owner + 2] === "cache"
      && parts[owner + 6] === "skills") {
      pluginMarketplaceName = parts[owner + 3];
      pluginId = parts[owner + 4];
      root = owner + 7;
    } else {
      continue;
    }
    const isSystem = pluginId === null && parts[root] === ".system";
    if (isSystem) root++;
    const skillId = parts[root];
    if (!skillId || skillId === "..") return null;
    const resource = parts.slice(root + 1);
    return {
      skillId,
      skillRootPath: parts.slice(0, root + 1).join("/"),
      skillName: formatSkillDisplayName(skillId),
      pluginId,
      pluginDisplayName: pluginId === null ? null : formatSkillDisplayName(pluginId),
      pluginMarketplaceName,
      isSystem,
      isInScriptsFolder: resource[0] === "scripts",
      isSkillDefinitionFile: resource.length === 1 && resource[0].toLowerCase() === "skill.md",
    };
  }
  return null;
}
