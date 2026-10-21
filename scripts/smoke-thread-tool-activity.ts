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
  for (const width of [390, 1100]) for (const theme of ["light", "dark"]) {
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
    const page = await browser.newPage({ viewport: { width, height: 1100 }, hasTouch: width === 390, isMobile: width === 390, reducedMotion: "reduce" });
    inspectedPage = page;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript("window.__name=value=>value");
    await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}/?theme=${theme}&scenario=webmcp`);
    await page.locator("[data-phase]").waitFor();
    const activate = (target: import("playwright").Locator) => width === 390 ? target.tap() : target.click();
    const groups = page.locator('.thread-agent-activity__group-disclosure > .thread-activity-item__header button[aria-expanded="false"]');
    for (let index = 0; index < 10 && await groups.count(); index++) await activate(groups.first());
    const titles = ["Listed website tools", "Look up an item", "Partial query", "Plain response", "Empty response"];
    for (const title of titles) {
      const trigger = page.getByRole("button", { name: title, exact: true });
      assert.equal(await trigger.getAttribute("aria-expanded"), "false");
      await activate(trigger);
    }
    const details = page.locator(".thread-webmcp-details");
    assert.equal(await details.count(), 5);
    assert.deepEqual(await details.locator(".chat-code-block__title").allTextContents(), [
      "Tool", "Result", "Tool", "Result", "Tool (input truncated)", "Result (truncated)", "Tool", "Result", "Tool",
    ]);
    const sources = (index: number) => details.nth(index).locator(".chat-code-block pre").allTextContents();
    const lookup = await sources(1);
    const metadata = JSON.parse(lookup[0]!);
    assert.deepEqual(metadata, { name: "lookup_item", title: "Look up an item", description: "Find an item in this website",
      website: "catalog.example.test", readOnlyHint: true, input: { query: { id: "INPUT_42", region: "上海" }, options: { limit: 40 } } });
    assert.ok(lookup[0]!.includes('"input": {\n'), "Nested input is formatted for reading");
    assert.ok(lookup[1]!.includes('"items": [\n'));
    const result = JSON.parse(lookup[1]!);
    assert.equal(result.items.length, 40);
    assert.equal(result.last, "LAST_RESULT");
    const partial = await sources(2);
    assert.equal(JSON.parse(partial[0]!).input, '{"query":"PARTIAL_INPUT');
    assert.equal(JSON.parse(partial[0]!).inputTruncated, true);
    assert.equal(JSON.parse(partial[0]!).readOnlyHint, false);
    assert.equal(partial[1], '{"result":"PARTIAL_OUTPUT');
    const plain = await sources(3);
    assert.equal(JSON.parse(plain[0]!).input, "PLAIN_INPUT");
    assert.equal(plain[1], "PLAIN_OUTPUT");
    const empty = await sources(4);
    assert.equal(empty.length, 1, "An absent result does not invent a result section");
    assert.equal(JSON.parse(empty[0]!).input, false);
    const scroller = details.nth(1).locator(".chat-code-block__scroller").nth(1);
    const scrolling = await scroller.evaluate(element => {
      element.scrollTop = element.scrollHeight;
      return { top: element.scrollTop, client: element.clientHeight, total: element.scrollHeight,
        maximum: Number.parseFloat(getComputedStyle(element).maxHeight) };
    });
    assert.ok(scrolling.top > 0 && scrolling.total > scrolling.client);
    assert.ok(Number.isFinite(scrolling.maximum) && scrolling.client <= scrolling.maximum + 1, "Shared preview owns the local reading budget");
    const trigger = page.getByRole("button", { name: "Look up an item", exact: true });
    await activate(trigger);
    await activate(trigger);
    assert.deepEqual(await sources(1), lookup);
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await details.nth(1).scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(output, `webmcp-${width}-${theme}.png`) });
    results.push({ width, theme, websiteToolSections: true, structuredJson: true, truncatedAndPlainPreserved: true, sharedPreviewScroll: true, collapseAndReopen: true });
    console.log(JSON.stringify({ width, theme, webMcpDetails: true, passed: true }));
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
