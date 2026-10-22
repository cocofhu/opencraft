import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import scss from "postcss-scss";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function branches(selector) {
  const result = [];
  let start = 0, depth = 0, quote;
  for (let i = 0; i < selector.length; i++) {
    const char = selector[i];
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (char === "," && depth === 0) { result.push(selector.slice(start, i).trim()); start = i + 1; }
  }
  result.push(selector.slice(start).trim());
  return result;
}

function withoutNegations(selector) {
  let result = "";
  for (let i = 0; i < selector.length;) {
    if (!selector.startsWith(":not(", i)) { result += selector[i++]; continue; }
    i += 5;
    let depth = 1, quote;
    while (i < selector.length && depth) {
      const char = selector[i++];
      if (quote) {
        if (char === "\\") i++;
        else if (char === quote) quote = undefined;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === "(") depth++;
      else if (char === ")") depth--;
    }
  }
  return result;
}
const isHover = selector => /:hover\b/u.test(withoutNegations(selector));
const persistent = selector => /:focus|\[data-(?:state|highlighted|selected|active|open|resizing)|\[aria-(?:current|selected|pressed)|\.is-(?:selected|active|open)/u.test(withoutNegations(selector));

export function inspectHoverStyles(source, file) {
  const issues = [];
  const ast = scss.parse(source, { from: file });
  ast.walkRules(rule => {
    const selectors = branches(rule.selector);
    if (!selectors.some(isHover)) return;
    const ancestors = [];
    for (let node = rule.parent; node && node.type !== "root"; node = node.parent) ancestors.push(node);
    const gate = ancestors.find(node => node.type === "atrule" && node.name === "include" && /^(?:[\w-]+\.)?hover-capable$/u.test(node.params));
    const media = ancestors.some(node => node.type === "atrule" && node.name === "media" && /\((?:any-)?hover:\s*hover\)/u.test(node.params) && /\((?:any-)?pointer:\s*fine\)/u.test(node.params));
    const outer = ancestors.filter(node => node.type === "rule").map(node => node.selector).join(" ");
    for (const selector of selectors.filter(isHover)) {
      if (!gate && !(media && /:root:not\(\[data-touch-interaction(?:="true")?\]\)/u.test(outer + " " + selector))) {
        issues.push({ file, line: rule.source.start.line, message: "Transient hover must use controls.hover-capable (or both capability and document input guards).", selector });
      }
    }
    if (gate) {
      const coupled = gate.prev()?.type === "comment" && gate.prev().text.startsWith("hover-policy: coupled-visibility — ");
      const mixed = selectors.some(selector => !isHover(selector) && persistent(selector)) || /:is\([^)]*:hover[^)]*:focus|:is\([^)]*:focus[^)]*:hover/u.test(rule.selector);
      if (mixed && !coupled) issues.push({ file, line: rule.source.start.line, message: "Keep keyboard/open/selected branches outside the hover gate.", selector: rule.selector });
    }
  });
  return issues;
}

export function inspectHoverHandlers(source, file) {
  if (!/on(?:Mouse|Pointer)Enter/u.test(source)) return [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const issues = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && /^(?:onMouseEnter|onPointerEnter)$/u.test(node.name.getText(ast))) {
      const text = node.initializer?.getText(ast) ?? "";
      // Entering an already open portal only cancels dismissal. It does not
      // create hover state; retaining that continuity must not steal focus.
      const portal = node.parent.parent.tagName?.getText(ast)?.endsWith(".Content");
      const continuity = portal && /^\{(?:cancelDismiss|cancelClose)\}$/u.test(text);
      if (!continuity && !(node.name.getText(ast) === "onPointerEnter" && /pointerType\s*(?:!==|===)\s*["']mouse["']/u.test(text))) {
        issues.push({ file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, message: "Hover entry must distinguish a mouse pointer; keep touch activation on its explicit action." });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return issues;
}

async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["node_modules", "dist", "build", "tests", "__tests__", "fixtures", ".git"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (/\.(?:scss|css|tsx)$/u.test(entry.name) && !/\.(?:test|spec)\./u.test(entry.name)) result.push(path);
  }
  return result;
}

async function main() {
  const paths = [...new Set((await Promise.all(["apps/workbench-web/src", "packages", "plugins", ...process.argv.slice(2)].map(path => files(resolve(root, path))))).flat())];
  const issues = [];
  for (const path of paths) {
    const file = relative(root, path);
    const source = await readFile(path, "utf8");
    issues.push(...(extname(path) === ".tsx" ? inspectHoverHandlers(source, file) : inspectHoverStyles(source, file)));
  }
  // This selector is a separate HTML Document, with its own input binding.
  const selectorPath = "apps/relay-server/src/selection.ts";
  const selector = await readFile(join(root, selectorPath), "utf8");
  const inlineStyle = selector.match(/<style>([\s\S]*?)<\/style>/u)?.[1];
  if (!inlineStyle) throw new Error("Relay selector style was not found");
  issues.push(...inspectHoverStyles(inlineStyle, selectorPath));
  for (const issue of issues) console.error(`${issue.file}:${issue.line}: ${issue.message}${issue.selector ? ` ${issue.selector.replace(/\s+/gu, " ")}` : ""}`);
  console.log(`Hover policy: ${paths.length} source files, ${issues.length} violations`);
  if (issues.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
