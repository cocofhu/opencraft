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
const handoffOnly = process.argv.includes("--handoff-live-only");
try {
  await vite.listen();
  browser = await chromium.launch({ executablePath: process.env.OPENCRAFT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
  if (!handoffOnly && !process.argv.includes("--live-only")) for (const width of [390, 1100]) for (const theme of ["light", "dark"]) {
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
  if (!handoffOnly && !process.argv.includes("--raw-only") && !process.argv.includes("--host-content-only")) for (const width of [390, 1100]) for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390, isMobile: width === 390, reducedMotion: "reduce" });
    inspectedPage = page;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript("window.__name=value=>value");
    const url = `http://127.0.0.1:${(vite.httpServer!.address() as {
        port: number;
    }).port}/?theme=${theme}&scenario=live`;
    await page.goto(url);
    await page.locator('[data-phase="running"]').waitFor();
    const activate = (n: ReturnType<typeof page.locator>) => width === 390 ? n.tap() : n.click();
    const reveal = async () => { for (let i = 0; i < 20; i++) {
        const closed = page.locator('.thread-agent-activity__group > .thread-agent-activity__group-disclosure > .thread-activity-item__header > button[aria-expanded="false"]');
        if (!await closed.count())
            break;
        await activate(closed.first());
    } };
    await reveal();
    const liveRow = page.locator('.thread-activity-item[data-status]').filter({ has: page.locator('.thread-activity-item__detail', { hasText: '/workspace/live.txt' }) }).first();
    await liveRow.waitFor();
    const live = liveRow.locator(':scope > .thread-activity-item__header button[aria-expanded]');
    await live.waitFor();
    const settledRow = page.locator('.thread-activity-item[data-status]').filter({ has: page.locator('.thread-activity-item__detail', { hasText: '/workspace/settled.txt' }) }).first();
    const mcpRow = page.locator('.thread-activity-item[data-status]').filter({ has: page.locator('.thread-activity-item__summary', { hasText: 'Mcp probe' }) }).first();
    await page.waitForFunction(() => (window as any).observed['live-write']?.status === 'running');
    const features: Record<string, boolean> = { liveInitiallyOpen: await live.getAttribute('aria-expanded') === 'true', liveBodyInitiallyVisible: await page.getByText('LIVE_WRITE_BODY', { exact: false }).first().isVisible(), mcpInitiallyClosed: await mcpRow.locator(':scope > .thread-activity-item__header button[aria-expanded]').getAttribute('aria-expanded') === 'false', settledInitiallyClosed: await settledRow.locator(':scope > .thread-activity-item__header button[aria-expanded]').getAttribute('aria-expanded') === 'false', compactPayloadSuppressed: !await page.getByText('COMPACT_PAYLOAD_CONTROL', { exact: false }).count() };
    await page.screenshot({ path: join(output, `live-${width}-${theme}-initial.png`) });
    if (await live.getAttribute('aria-expanded') === 'true')
        await activate(live);
    await page.evaluate(() => (window as any).setPhase('progress'));
    await page.locator('[data-phase="progress"]').waitFor();
    await page.waitForFunction(() => (window as any).observed['live-write']?.content === 'UPDATED_WRITE_BODY');
    features.manualCollapseRetained = await live.getAttribute('aria-expanded') === 'false';
    await activate(live);
    await page.getByText('UPDATED_WRITE_BODY', { exact: false }).first().waitFor();
    await page.evaluate(() => (window as any).setPhase('completed'));
    await page.locator('[data-phase="completed"]').waitFor();
    const settledLive = liveRow.getByRole('button', { name: 'Wrote', exact: true });
    await settledLive.waitFor();
    features.settlementReturnsCollapsed = await settledLive.getAttribute('aria-expanded') === 'false';
    if (await settledLive.getAttribute('aria-expanded') === 'false')
        await activate(settledLive);
    features.settledManuallyReachable = await page.getByText('LIVE_WRITE_BODY', { exact: false }).first().isVisible();
    await page.goto(url + '&initial=completed&history=1');
    await page.locator('[data-phase="completed"]').waitFor();
    await reveal();
    features.historicalSettledCollapsed = await liveRow.getByRole('button', { name: 'Wrote', exact: true }).getAttribute('aria-expanded') === 'false';
    await page.goto(url);
    await page.locator('[data-phase="running"]').waitFor();
    await reveal();
    await page.waitForFunction(() => (window as any).observed['live-write']?.status === 'running');
    await page.evaluate(() => (window as any).setPhase('failed'));
    await page.waitForFunction(() => (window as any).observed['live-write']?.status === 'failed');
    features.failedSettlementCollapsed = await live.getAttribute('aria-expanded') === 'false';
    assert.ok(Object.values(features).every(Boolean), JSON.stringify(features));
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    results.push({ width, theme, liveTools: features });
    await page.close();
}
  if (!handoffOnly && !process.argv.includes("--live-only") && !process.argv.includes("--raw-only") && !process.argv.includes("--host-content-only")) for (const width of [390, 1100]) for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390, isMobile: width === 390, reducedMotion: "reduce" });
    inspectedPage = page;
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript("window.__name=value=>value");
    const url = `http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}/?theme=${theme}&scenario=host-live`;
    const activate = (target: ReturnType<typeof page.locator>) => width === 390 ? target.tap() : target.click();
    const reveal = async () => { for (let i = 0; i < 20; i++) {
      const closed = page.locator('.thread-agent-activity__group > .thread-agent-activity__group-disclosure > .thread-activity-item__header > button[aria-expanded="false"]');
      if (!await closed.count()) break;
      await activate(closed.first());
    } };
    await page.goto(url);
    await page.locator('[data-phase="running"]').waitFor();
    await reveal();
    const row = page.locator('.thread-activity-item[data-status]').filter({ has: page.locator('[data-live-host-icon]') }).last();
    const trigger = row.locator(':scope > .thread-activity-item__header button[aria-expanded]');
    await trigger.waitFor();
    await page.waitForFunction(() => (window as any).hostPresentation?.phase === "running");
    assert.equal(await page.evaluate(() => (window as any).hostPresentation.canExpand), false);
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    assert.equal(await page.getByRole("textbox", { name: "Host detail input" }).isVisible(), true);
    await page.screenshot({ path: join(output, `host-live-${width}-${theme}.png`) });
    await activate(trigger);
    await page.evaluate(() => (window as any).setPhase("progress"));
    await page.waitForFunction(() => (window as any).hostPresentation?.phase === "progress");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    await activate(trigger);
    await page.getByRole("textbox", { name: "Host detail input" }).waitFor();
    await page.evaluate(() => (window as any).setPhase("completed"));
    await page.waitForFunction(() => (window as any).hostPresentation?.state === "completed");
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    await activate(trigger);
    await page.getByRole("textbox", { name: "Host detail input" }).waitFor();
    await page.evaluate(() => (window as any).setPhase("failed"));
    await page.waitForFunction(() => (window as any).hostPresentation?.state === "failed");
    assert.equal(await trigger.getAttribute("aria-expanded"), "true");
    for (const mode of ["null", "false", "fallback", "absent"]) {
      await page.evaluate(mode => (window as any).setHostMode(mode), mode);
      await page.locator(`[data-host-mode="${mode}"][data-phase="running"]`).waitFor();
      await reveal();
      assert.equal(await page.locator("[data-live-host-body]").count(), 0);
      assert.equal(await page.getByText("COMPACT_PAYLOAD_CONTROL", { exact: false }).count(), 0);
    }
    await page.goto(url + "&initial=completed&history=1");
    await page.locator('[data-phase="completed"]').waitFor();
    await reveal();
    await trigger.waitFor();
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    assert.deepEqual(errors, []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    results.push({ width, theme, hostLiveDisclosure: true, settledMemory: true, explicitSuppression: true, historicalRestore: true });
    await page.close();
  }
  if (!process.argv.includes("--raw-only") && !process.argv.includes("--host-content-only"))
    for (const width of [390, 1100])
      for (const theme of ["light", "dark"]) {
        const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: width === 390, isMobile: width === 390, reducedMotion: "reduce" });
        inspectedPage = page;
        const errors: string[] = [];
        page.on("pageerror", e => errors.push(e.message));
        await page.addInitScript("window.__name=value=>value");
        const url = `http://127.0.0.1:${(vite.httpServer!.address() as {
          port: number;
        }).port}/?theme=${theme}&scenario=handoff-live`;
        await page.goto(url);
        await page.locator('[data-phase="queued"]').waitFor();
        const activate = (n: ReturnType<typeof page.locator>) => width === 390 ? n.tap() : n.click();
        const row = page.locator('.thread-activity-item[data-status]').filter({ has: page.locator('.thread-handoff-steps') }).last();
        await row.waitFor();
        const trigger = row.locator(':scope > .thread-activity-item__header button[aria-expanded]');
        await trigger.waitFor();
        await page.waitForFunction(() => (window as any).presentations['handoff-live']?.phase === 'queued');
        assert.equal(await page.evaluate(() => (window as any).presentations['handoff-live'].state), 'running');
        const features: Record<string, boolean> = { queuedInitiallyOpen: await trigger.getAttribute('aria-expanded') === 'true', queuedStepsInitiallyVisible: await row.locator(':scope > .thread-activity-item__body-clip').getAttribute('aria-hidden') === 'false' };
        await page.screenshot({ path: join(output, `handoff-live-${width}-${theme}-initial.png`) });
        if (await trigger.getAttribute('aria-expanded') === 'true')
          await activate(trigger);
        await page.evaluate(() => (window as any).setPhase('running'));
        await page.waitForFunction(() => (window as any).presentations['handoff-live']?.phase === 'running');
        features.manualCollapseSurvivesProgress = await trigger.getAttribute('aria-expanded') === 'false';
        await activate(trigger);
        features.manualReopenShowsSteps = await page.getByText('Prepare host transfer', { exact: true }).isVisible();
        await page.evaluate(() => (window as any).setPhase('success'));
        await page.waitForFunction(() => (window as any).presentations['handoff-live']?.state === 'completed');
        features.settlementStartsCollapsed = await trigger.getAttribute('aria-expanded') === 'false';
        if (await trigger.getAttribute('aria-expanded') === 'false')
          await activate(trigger);
        await page.evaluate(() => (window as any).setPhase('error'));
        await page.waitForFunction(() => (window as any).presentations['handoff-live']?.state === 'failed');
        features.settledManualChoiceSurvivesFailure = await trigger.getAttribute('aria-expanded') === 'true';
        await page.evaluate(() => (window as any).setPhase('empty'));
        await page.locator('[data-phase="empty"]').waitFor();
        features.emptyHandoffSummaryOnly = await page.locator('.thread-handoff-steps').count() === 0 && await page.locator('.thread-codex-app-tool-row button[aria-expanded]').count() === 0;
        for (const phase of ['success', 'transport-failed']) {
          await page.goto(url + '&initial=' + phase + '&history=1');
          await page.locator('[data-phase="' + phase + '"]').waitFor();
          await trigger.waitFor();
          features['historical-' + phase + '-collapsed'] = await trigger.getAttribute('aria-expanded') === 'false';
          features['historical-' + phase + '-state'] = await row.getAttribute('data-status') === (phase === 'success' ? 'completed' : 'failed');
        }
        assert.deepEqual(errors, []);
        for (const [feature, present] of Object.entries(features))
          assert.equal(present, true, feature);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        results.push({ width, theme, handoffLiveDisclosure: true, ...features });
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
