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
const results = [];
try {
  await vite.listen();
  browser = await chromium.launch({ executablePath: process.env.OPENCRAFT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
  for (const width of [390, 1100]) for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390, isMobile: width === 390, reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript("window.__name=value=>value");
    await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}/?theme=${theme}`);
    const nativeSummary = page.locator(".thread-codex-app-tool-row .thread-activity-item__summary");
    await page.locator('[data-phase="inProgress"]').waitFor();
    const collapsed = page.locator('.thread-agent-activity__group button[aria-expanded="false"]');
    for (let index = 0; index < 20 && await collapsed.count() > 0; index++) await collapsed.first().click();
    assert.equal(await collapsed.count(), 0, "all native activity groups opened");
    await nativeSummary.filter({ hasText: "Fork thread · Worktree · Running" }).waitFor();
    await page.getByText("Get handoff status · Failed", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Open chat", exact: true }).filter({ hasText: "Read thread" }).click();
    await page.locator(".thread-created-thread-card").click();
    assert.deepEqual(await page.evaluate(() => (window as any).openedThreads), ["read-target", "created-target"]);
    if (!await page.getByText("Preparing files for transfer", { exact: true }).isVisible()) {
      await page.getByText("Handoff to Remote needs attention", { exact: true }).click();
    }
    await page.getByText("Preparing files for transfer", { exact: true }).waitFor();
    for (const [phase, label] of [["completed", "Completed"], ["failed", "Failed"], ["interrupted", "Stopped"]]) {
      await page.evaluate(phase => (window as any).changeThreadToolPhase(phase), phase);
      await nativeSummary.filter({ hasText: `Fork thread · Worktree · ${label}` }).waitFor();
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(output, `${width}-${theme}.png`) });
    assert.deepEqual(errors, []);
    results.push({ width, theme, navigationAndCreatedCard: true, transferSteps: true, failedPollVisible: true, allPhases: true });
    await page.close();
  }
  await writeFile(join(output, "report.json"), JSON.stringify({ results }, null, 2));
  console.log(JSON.stringify({ passed: results.length, output }));
} finally { await browser?.close(); await vite.close(); }
