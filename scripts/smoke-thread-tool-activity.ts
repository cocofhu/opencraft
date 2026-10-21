import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright";

const output = resolve(process.env.OPENCRAFT_THREAD_TOOL_REPORT ?? ".local/thread-tool-activity");
await mkdir(output, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: "error",
  esbuild: { jsx: "automatic" }, resolve: { dedupe: ["react", "react-dom"] },
  cacheDir: "node_modules/.vite-thread-tool-activity", server: { host: "127.0.0.1", port: 0 },
  plugins: [{ name: "thread-tool-fixture", configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url !== "/" && !request.url?.startsWith("/?")) return next();
      response.setHeader("content-type", "text/html");
      response.end('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/tests/fixtures/thread-tool-activity.tsx"></script>');
    });
  } }],
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
let inspectedPage: Awaited<ReturnType<NonNullable<typeof browser>["newPage"]>> | undefined;
const results = [];
try {
  await vite.listen();
  browser = await chromium.launch({ executablePath: process.env.OPENCRAFT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
  if (!process.argv.includes("--raw-only")) for (const width of [390, 1100]) for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390, isMobile: width === 390, reducedMotion: "reduce" });
    inspectedPage = page;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript("window.__name=value=>value");
    await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}/?theme=${theme}`);
    const nativeSummary = page.locator(".thread-codex-app-tool-row .thread-activity-item__summary");
    // Group headers repeat the last activity title; inspect the actual status-bearing rows.
    const surfaceSummary = page.locator(".thread-activity-item[data-status] > .thread-activity-item__header .thread-activity-item__summary");
    await page.locator('[data-phase="inProgress"]').waitFor();
    const collapsed = page.locator('.thread-agent-activity__group button[aria-expanded="false"]');
    for (let index = 0; index < 20 && await collapsed.count() > 0; index++) await collapsed.first().click();
    assert.equal(await collapsed.count(), 0, "all native activity groups opened");
    await nativeSummary.filter({ hasText: "Fork thread · Worktree · Running" }).waitFor();
    await page.getByText("Get handoff status · Failed", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Open chat", exact: true }).filter({ hasText: "Read thread" }).click();
    await page.locator(".thread-created-thread-card").click();
    assert.deepEqual(await page.evaluate(() => (window as any).openedThreads), ["read-target", "created-target"]);
    const transferDisclosure = page.getByRole("button", { name: "Transfer · Review · Remote · Needs attention", exact: true });
    if (await transferDisclosure.getAttribute("aria-expanded") !== "true") await transferDisclosure.click();
    assert.equal(await transferDisclosure.getAttribute("aria-expanded"), "true");
    await page.getByText("Prepare host transfer", { exact: true }).waitFor();
    const steps = page.locator(".thread-handoff-step");
    assert.equal(await steps.filter({ hasText: "Create new worktree" }).getAttribute("data-status"), "pending");
    assert.equal(await steps.filter({ hasText: "Transfer host artifacts" }).getAttribute("data-status"), "failed");
    assert.equal(await steps.filter({ hasText: "Rolling back changes" }).count(), 0);
    const queuedDisclosure = page.getByRole("button", { name: "Transfer · Queued", exact: true });
    if (await queuedDisclosure.getAttribute("aria-expanded") !== "true") await queuedDisclosure.click();
    assert.equal(await queuedDisclosure.getAttribute("aria-expanded"), "true");
    assert.equal(await steps.filter({ hasText: "Custom prepare step" }).getAttribute("data-status"), "pending");
    for (const title of ["Browser click · Chrome", "Scroll · Notes · down", "Inspect workspace"]) {
      await surfaceSummary.filter({ hasText: `${title} · Running` }).waitFor();
    }
    for (const [phase, label] of [["completed", "Completed"], ["failed", "Failed"], ["interrupted", "Stopped"]]) {
      await page.evaluate(phase => (window as any).changeThreadToolPhase(phase), phase);
      await nativeSummary.filter({ hasText: `Fork thread · Worktree · ${label}` }).waitFor();
      for (const title of ["Browser click · Chrome", "Scroll · Notes · down", "Inspect workspace"]) {
        await surfaceSummary.filter({ hasText: `${title} · ${label}` }).waitFor();
      }
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(output, `${width}-${theme}.png`) });
    assert.deepEqual(errors, []);
    results.push({ width, theme, navigationAndCreatedCard: true, transferSteps: true, failedPollVisible: true, reportedStepStates: true, allSurfacePhases: true, allPhases: true });
    console.log(JSON.stringify({ width, theme, passed: true }));
    await page.close();
  }
  for (const width of [390, 1100]) for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390, isMobile: width === 390, reducedMotion: "reduce" });
    inspectedPage = page;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => {
      (window as any).__name = (value: unknown) => value;
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: async (text: string) => { (window as any).rawClipboard = text; },
      } });
    });
    await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}/?theme=${theme}&scenario=raw`);
    await page.locator("[data-phase]").waitFor();
    const activate = (target: ReturnType<typeof page.locator>) => width === 390 ? target.tap() : target.click();
    for (let index = 0; index < 30; index++) {
      const closed = page.locator('.thread-activity-item__hit-target[aria-expanded="false"]');
      if (await closed.count() === 0) break;
      await activate(closed.first());
    }
    const rawButtons = page.getByRole("button", { name: "Show raw tool call output", exact: true });
    assert.equal(await rawButtons.count(), 6);
    const values: any[] = [];
    for (let index = 0; index < 6; index++) {
      await activate(rawButtons.nth(index));
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      await page.evaluate(() => { (window as any).rawClipboard = ""; });
      await activate(dialog.getByRole("button", { name: "Copy code", exact: true }));
      await page.waitForFunction(() => (window as any).rawClipboard.length > 0);
      values.push(JSON.parse(await page.evaluate(() => (window as any).rawClipboard)));
      if (index === 0 || index === 4) await page.screenshot({ path: join(output, `raw-${index}-${width}-${theme}.png`) });
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
    }
    assert.deepEqual(values[0], {
      callId: "protocol-error", invocation: { server: "raw-probe", tool: "protocol_error", arguments: { path: "/workspace/report.txt" } }, durationMs: 120,
      result: { type: "error", kind: "protocol", error: "PROTOCOL_FAILURE: connection closed before a result", rawError: { message: "PROTOCOL_FAILURE: connection closed before a result" } },
    });
    assert.equal(values[1].result, null, "A missing MCP envelope remains absent");
    assert.deepEqual(values[2].result, { type: "success", content: [{ type: "text", text: "MCP_SUCCESS" }], structuredContent: { value: 42 }, raw: { content: [{ type: "text", text: "MCP_SUCCESS" }], structuredContent: { value: 42 } } });
    assert.equal(values[3].result.type, "success", "A tool-reported error is a received MCP result, not a protocol failure");
    assert.equal(values[3].result.raw.isError, true);
    assert.equal(values[3].result.content[0].text, "REPORTED_ERROR: item absent");
    for (const [index, success, text] of [[4, false, "DYNAMIC_FAILURE_CONTENT"], [5, true, "DYNAMIC_SUCCESS_CONTENT"]] as const) {
      assert.equal(values[index].invocation.server, "deepseek-harness");
      assert.deepEqual(values[index].result, { success, contentItems: [{ type: "inputText", text }] });
    }
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    results.push({ width, theme, rawProtocolError: true, absentEnvelope: true, receivedMcpError: true, dynamicResultFacts: true, fullJsonCopy: true });
    console.log(JSON.stringify({ width, theme, rawOutput: true, passed: true }));
    await page.close();
  }
  await writeFile(join(output, "report.json"), JSON.stringify({ results }, null, 2));
  console.log(JSON.stringify({ passed: results.length, output }));
} catch (error) {
  if (inspectedPage && !inspectedPage.isClosed()) {
    await writeFile(join(output, "failure.html"), await inspectedPage.content());
    await inspectedPage.screenshot({ path: join(output, "failure.png") });
  }
  throw error;
} finally { await browser?.close(); await vite.close(); }
