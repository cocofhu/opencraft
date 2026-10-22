import assert from "node:assert/strict";
import { createServer } from "vite";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { assertBrowserRuntimeDependencies } from "./browser-smoke-preflight.mjs";

const playwright = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? "playwright");
const { chromium } = playwright.default ?? playwright;
assertBrowserRuntimeDependencies(process.env.OPENCRAFT_CHROMIUM_EXECUTABLE ?? chromium.executablePath());
const output = await mkdtemp("/tmp/opencraft-reasoning-disclosure-");
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", esbuild: { jsx: "automatic" },
  resolve: { dedupe: ["react", "react-dom"] }, cacheDir: "node_modules/.vite-reasoning-disclosure",
  server: { host: "127.0.0.1", port: 0 }, plugins: [{ name: "reasoning-disclosure", configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url !== "/" && !request.url?.startsWith("/?")) return next();
      response.setHeader("content-type", "text/html");
      response.end('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/tests/fixtures/reasoning-disclosure.tsx"></script>');
    });
  } }] });
let browser: any;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.OPENCRAFT_CHROMIUM_EXECUTABLE });
  const results = [];
  const activityScales = [];
  for (const touch of [false, true]) for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: touch ? 390 : 1024, height: 900 }, hasTouch: touch,
      deviceScaleFactor: touch ? 2 : 1,
      isMobile: touch, reducedMotion: touch ? "reduce" : "no-preference" });
    const errors: string[] = []; page.on("pageerror", (error: Error) => errors.push(error.message));
    await page.addInitScript("window.__name=value=>value");
    await page.addInitScript(() => {
      const NativeObserver = window.ResizeObserver;
      const deliveries: unknown[] = [];
      (window as any).resizeFeedback = [];
      window.ResizeObserver = class extends NativeObserver {
        constructor(callback: ResizeObserverCallback) {
          super((entries, observer) => {
            deliveries.push(entries.map(entry => ({ target: entry.target.className,
              width: entry.contentRect.width, height: entry.contentRect.height })));
            if (deliveries.length > 10) deliveries.shift();
            callback(entries, observer);
          });
        }
      };
      window.addEventListener('error', event => {
        if (event.message.startsWith('ResizeObserver')) (window as any).resizeFeedback.push({ action: (window as any).__reasoningSmokeAction, message: event.message, deliveries: deliveries.slice() });
      });
    });
    await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}/?theme=${theme}&locale=${touch ? "zh" : "en"}`);
    assert.equal(await page.evaluate(() => innerWidth), touch ? 390 : 1024,
      'mobile emulation must use the real narrow CSS viewport, not Safari default page scaling');
    const update = async (action: string, engine?: string) => {
      const before = Number(await page.locator('[data-revision]').getAttribute('data-revision'));
      await page.evaluate(([action, engine]) => {
        (window as any).__reasoningSmokeAction = action;
        (window as any).update(action, engine);
      }, [action, engine]);
      await page.locator(`[data-revision="${before + 1}"]`).waitFor();
    };
    const activate = (target: any) => touch ? target.tap() : target.click();
    if (process.argv.includes("--diff-reading-only") || !process.argv.some(value => value.endsWith("-only"))) {
      const restoreView = async () => {
        const scroll = await page.locator('.thread-scroll').elementHandle();
        await update("restore");
        await page.waitForFunction(element => !element.isConnected, scroll);
        await page.locator('.thread-scroll').waitFor();
      };
      await update("diff-reading-reset");
      const rows = page.locator('.thread-activity-item[data-status="completed"]').filter({ has: page.locator('.thread-unified-diff') });
      const first = rows.nth(0), second = rows.nth(1);
      const unfoldGroup = async () => {
        for (let index = 0; index < 8 && !await first.isVisible(); index++) {
          const group = page.locator('.thread-agent-activity__group button[aria-expanded="false"]').first();
          assert.ok(await group.count()); await activate(group);
        }
      };
      const toggleRow = async (row: any) => {
        const trigger = row.locator(':scope > .thread-activity-item__header > button');
        if (touch) await trigger.tap({ position: { x: 8, y: 8 } });
        else await trigger.click({ position: { x: 8, y: 8 } });
      };
      const context = first.locator('.thread-unified-diff__collapsed');
      const more = first.locator('.thread-unified-diff__show-all');
      await unfoldGroup(); await toggleRow(first);
      assert.equal(await context.count(), 1); assert.equal(await more.count(), 1);
      await activate(context); await activate(more);
      assert.equal(await context.count(), 0); assert.equal(await more.count(), 0);
      const original = await first.elementHandle();
      await restoreView();
      assert.equal(await original!.evaluate(element => element.isConnected), false);
      assert.equal(await first.getAttribute('data-open'), 'true');
      assert.equal(await context.count(), 0, "the retained View keeps explicitly shown unchanged lines");
      assert.equal(await more.count(), 0, "the retained View keeps the explicitly shown long diff");
      const restored = await first.elementHandle();
      await update("diff-reading-append");
      assert.equal(await restored!.evaluate(element => element.isConnected), true);
      assert.ok((await first.innerText()).includes('updated-after-450'), "current diff output stays authoritative");
      assert.equal(await context.count(), 0); assert.equal(await more.count(), 0);
      await toggleRow(second);
      assert.equal(await second.locator('.thread-unified-diff__collapsed').count(), 1, "different files keep independent context choices");
      assert.equal(await second.locator('.thread-unified-diff__show-all').count(), 1);
      await toggleRow(first); await restoreView();
      assert.notEqual(await first.getAttribute('data-open'), 'true');
      await toggleRow(first);
      assert.equal(await context.count(), 0); assert.equal(await more.count(), 0);
      await first.locator(':scope > .thread-activity-item__header > button').scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(output, `diff-reading-${touch ? 'touch' : 'mouse'}-${theme}.png`) });
      await update("diff-reading-reset"); await unfoldGroup(); await toggleRow(first);
      assert.equal(await context.count(), 1, "a new View retains the original context default");
      assert.equal(await more.count(), 1, "a new View retains the original long-diff limit");
      assert.deepEqual(errors, []);
      results.push({ touch, theme, diffReadingRestored: true, refreshedDiff: true, separateFiles: true, explicitCollapse: true, freshViewIsolated: true });
      if (process.argv.includes("--diff-reading-only")) { await page.close(); continue; }
    }
    if (process.argv.includes("--detail-view-only") || !process.argv.some(value => value.endsWith("-only"))) {
      const restoreView = async () => {
        const scroll = await page.locator('.thread-scroll').elementHandle();
        await update("restore");
        await page.waitForFunction(element => !element.isConnected, scroll);
        await page.locator('.thread-scroll').waitFor();
      };
      for (const kind of ["patch", "mcp", "dynamic"]) {
        await update(`detail-view-${kind}-reset`);
        const row = page.locator('.thread-activity-item[data-status="completed"]').filter({
          has: page.locator('.thread-activity-item__body'),
        }).last();
        const unfoldGroup = async () => {
          for (let index = 0; index < 8 && !await row.isVisible(); index++) {
            const group = page.locator('.thread-agent-activity__group button[aria-expanded="false"]').first();
            assert.ok(await group.count());
            await activate(group);
          }
        };
        const toggleRow = async () => {
          const trigger = row.locator(':scope > .thread-activity-item__header > button');
          if (touch) await trigger.tap({ position: { x: 8, y: 8 } });
          else await trigger.click({ position: { x: 8, y: 8 } });
        };
        await unfoldGroup();
        assert.notEqual(await row.getAttribute('data-open'), 'true', "a fresh settled detail starts collapsed");
        await toggleRow();
        assert.equal(await row.getAttribute('data-open'), 'true');
        const first = await row.elementHandle();
        await restoreView();
        assert.equal(await first!.evaluate(element => element.isConnected), false);
        assert.equal(await row.getAttribute('data-open'), 'true', "explicit expansion survives restoration of the same View");
        const restored = await row.elementHandle();
        await update(`detail-view-${kind}-append`);
        assert.equal(await restored!.evaluate(element => element.isConnected), true);
        assert.equal(await row.getAttribute('data-open'), 'true');
        assert.ok((await row.innerText()).includes('Updated detail result'), "restoration does not cache stale tool output");
        await page.screenshot({ path: join(output, `detail-view-${kind}-${touch ? 'touch' : 'mouse'}-${theme}.png`) });
        await toggleRow();
        await restoreView();
        assert.notEqual(await row.getAttribute('data-open'), 'true', "explicit collapse survives the same View");
        await update(`detail-view-${kind}-reset`);
        await unfoldGroup();
        assert.notEqual(await row.getAttribute('data-open'), 'true', "new Views do not inherit the old View choice");
      }
      assert.deepEqual(errors, []);
      results.push({ touch, theme, detailViewRestored: true, refreshedOutput: true, explicitCollapse: true, freshViewIsolated: true });
      if (process.argv.includes("--detail-view-only")) { await page.close(); continue; }
    }
    for (const engine of (process.argv.includes("--spacing-only") ? [] : ["codex", "hermes", "dsh"])) {
      await page.locator('.thread-reasoning').waitFor();
      await update("empty", engine);
      assert.equal(await page.locator('.thread-reasoning').count(), 0, 'empty reasoning cannot create an empty disclosure');
      assert.equal(await page.locator('.thread-thinking-placeholder').count(), 1, 'no content retains one noninteractive status');
      assert.equal(await page.locator('.thread-thinking-placeholder').evaluate(node => getComputedStyle(node).fontSize), '14px');
      await update("long-detail", engine);
      for (const phase of ["running", "settled"]) {
        const widths = await page.locator('.thread-reasoning').evaluate(element => {
          const summary = element.querySelector<HTMLElement>('.thread-activity-item__summary')!;
          const detail = element.querySelector<HTMLElement>('.thread-activity-item__detail')!;
          return { summary: [summary.clientWidth, summary.scrollWidth], detail: [detail.clientWidth, detail.scrollWidth] };
        });
        assert.ok(widths.summary[0] + 1 >= widths.summary[1], `${phase} thinking label must be fully visible`);
        assert.ok(widths.detail[0] + 1 < widths.detail[1], `${phase} long preview should truncate first`);
        if (phase === "running") await update("tools");
      }
      // Compare actual icon geometry in the shared activity rail, in every theme/viewport.
      const icons = await page.evaluate(() => {
        const thought = document.querySelector<SVGSVGElement>('.thread-reasoning .thread-activity-item__icon > svg')!;
        const slot = thought.parentElement!;
        const rect = (svg: SVGSVGElement) => {
          const box = svg.getBoundingClientRect();
          return { width: box.width, height: box.height, color: getComputedStyle(svg).color };
        };
        return { thought: rect(thought), isBrain: thought.classList.contains('lucide-brain'), slotColor: getComputedStyle(slot).color,
          renderedStroke: parseFloat(getComputedStyle(thought).strokeWidth) * thought.getBoundingClientRect().width / thought.viewBox.baseVal.width };
      });
      assert.equal(icons.isBrain, true, 'thinking retains the recognizable brain glyph');
      assert.equal(icons.thought.width, 18);
      assert.equal(icons.thought.height, 18);
      assert.equal(icons.thought.color, icons.slotColor, 'thinking inherits the shared activity slot color');
      assert.ok(Math.abs(icons.renderedStroke - 1.2) < 0.01, 'brain keeps a light stroke at its actual rendered scale');
      await page.screenshot({ path: join(output, `${engine}-${theme}-${touch ? 'touch' : 'mouse'}-long-detail.png`) });
      await update("reset", engine);
      const reason = page.locator('.thread-reasoning');
      const toggle = reason.getByRole('button');
      await reason.waitFor();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'default collapsed even while streaming');
      assert.equal(await reason.locator('.thread-activity-item__prose').count(), 0);
      assert.match(await reason.locator('.thread-activity-item__detail').innerText(), /Current returned line/);
      assert.equal(await page.locator('.thread-thinking-placeholder').count(), 0, 'reasoning owns live status');
      assert.equal(await page.locator('.thread-reasoning[data-reasoning-active="true"]').count(), 1);
      await reason.evaluate(element => { (window as any).__reasoningNode = element; });
      await activate(toggle);
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'first real touch/mouse activation works');
      await reason.locator('.thread-activity-item__prose').waitFor();
      await reason.locator('.opencraft-chat-document').waitFor();
      // Wait past the lazy raw fallback. Whitespace can be a source soft
      // break or a visual line wrap at phone width; text must be unchanged.
      assert.equal((await reason.locator('.thread-activity-item__prose').innerText()).replace(/\s+/gu, ' '),
        'First returned line Current returned line');
      assert.doesNotMatch(await reason.innerText(), /Alternate returned detail/);
      await update("grow");
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert.match(await reason.locator('.thread-activity-item__prose').innerText(), /New returned line/);
      assert.equal(await page.evaluate(() => (window as any).__reasoningNode === document.querySelector('.thread-reasoning')), true);
      await update("tools");
      assert.equal(await reason.locator('.thread-command,.thread-agent-activity').count(), 0, 'tools cannot hang under reasoning');
      assert.equal(await page.locator('.thread-agent-activity .thread-reasoning').count(), 1,
        'thinking is inner response work, not inside a tool disclosure');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      const density = await reason.evaluate(element => {
        const unit = element.closest('.thread-agent-activity__unit')!;
        const next = unit.nextElementSibling!;
        const header = element.querySelector('.thread-activity-item__header')!;
        const frame = element.closest('.thread-frame')!;
        return {
          gap: next.getBoundingClientRect().top - unit.getBoundingClientRect().bottom,
          headerSize: parseFloat(getComputedStyle(header).fontSize),
          chatSize: parseFloat(getComputedStyle(frame).fontSize),
          expandedTextSize: parseFloat(getComputedStyle(element.querySelector('.opencraft-chat-document')!).fontSize),
        };
      });
      assert.ok(Math.abs(density.gap - 4) < 0.5, 'expanded reasoning preserves the activity row boundary');
      assert.equal(density.headerSize, 14, 'process summaries use the shared body role');
      assert.ok(density.headerSize <= density.chatSize, 'restored summary scale remains readable beside default prose');
      assert.equal(density.expandedTextSize, density.chatSize, 'returned reasoning keeps the reading scale');
      assert.equal(await page.locator('.thread-reasoning[data-reasoning-active="true"]').count(), 0, 'later work owns live feedback');
      await update("complete");
      const workToggle = page.locator('.thread-agent-activity__turn-toggle button');
      assert.equal(await workToggle.count(), 1);
      assert.equal(await workToggle.getAttribute('aria-expanded'), 'false');
      assert.equal(await reason.count(), 0, 'completion folds thinking and tools under the work container');
      assert.ok(await page.getByText('Final answer', { exact: true }).isVisible());
      await activate(workToggle);
      await reason.waitFor();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'completion cannot write collapse choice');
      assert.match(await reason.locator('.thread-activity-item__detail').innerText(), /First returned line/);
      assert.equal(await page.locator('.thread-thinking-placeholder').count(), 0);
      assert.equal(await page.locator('.thread-reasoning[data-reasoning-active="true"]').count(), 0);
      await activate(workToggle);
      assert.equal(await reason.count(), 0);
      await activate(workToggle);
      await reason.waitFor();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'work folding retains the inner choice');
      await reason.evaluate(element => { (window as any).__reasoningNode = element; });
      await update("prepend");
      assert.equal(await page.evaluate(() => (window as any).__reasoningNode === document.querySelector('.thread-reasoning')), true);
      await update("restore");
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'existing View restore receipt retains explicit choice');
      await activate(toggle);
      await page.waitForFunction(() => !document.querySelector('.thread-reasoning .thread-activity-item__prose'));
      await update("restore");
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      if (!touch) {
        await toggle.focus(); await page.keyboard.press("Enter");
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'native keyboard activation');
        await page.waitForFunction(() => {
          const clip = document.querySelector('.thread-reasoning .thread-activity-item__body-clip');
          const body = document.querySelector('.thread-reasoning .thread-activity-item__body');
          return clip && body && clip.getBoundingClientRect().height >= body.scrollHeight - 1 && getComputedStyle(clip).opacity === '1';
        });
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: join(output, `${engine}-${theme}-${touch ? 'touch' : 'mouse'}.png`) });
      for (const withClock of [false, true]) {
        await update(withClock ? "long-empty-clock" : "long-empty", engine);
        assert.equal(await page.locator('.thread-reasoning').count(), 0, 'thirteen empty reasoning Items create no content disclosures');
        const responseWork = page.locator('.thread-agent-activity__turn-toggle button');
        assert.equal(await responseWork.count(), 1, 'one response owns one outer work fold despite thirteen empty reasoning boundaries');
        assert.equal(await responseWork.getAttribute('aria-expanded'), 'false');
        const workLabel = (await page.locator('.thread-agent-activity__turn-toggle').innerText()).trim();
        assert.ok(workLabel.length > 0, 'timeless work still has a meaningful disclosure label');
        if (withClock) assert.doesNotMatch(workLabel, /previous message|历史消息/u,
          'an available Turn clock labels the one work disclosure rather than thirteen fragments');
        else assert.match(workLabel, /60/u, 'missing time metadata retains one existing sixty-item disclosure');
        assert.equal(await page.locator('.thread-work-status__label').count(), withClock ? 1 : 0,
          'one Turn clock stays attached to the response work owner, including a trailing empty Item');
        assert.ok(await page.getByText('Long response final answer', { exact: true }).isVisible());
        await page.screenshot({ path: join(output, `${engine}-${theme}-${touch ? 'touch' : 'mouse'}-empty-13-${withClock ? 'clock' : 'timeless'}.png`) });
        await activate(responseWork);
        assert.equal(await responseWork.getAttribute('aria-expanded'), 'true', 'first activation reveals current-response work');
        const innerGroups = page.locator('.thread-agent-activity__group-disclosure > .thread-activity-item__header button');
        for (let index = 0; index < await innerGroups.count(); index++) {
          const group = innerGroups.nth(index);
          if (await group.getAttribute('aria-expanded') === 'false') await activate(group);
        }
        const toolRows = page.locator('.thread-agent-activity__content .thread-activity-item[data-status]');
        assert.equal(await toolRows.count(), 60, 'opening the work surface retains all sixty tools once');
        const commands = await toolRows.locator(':scope > .thread-activity-item__header .thread-activity-item__summary').allTextContents();
        assert.deepEqual(commands.map((label: string) => label.match(/cycle-\d+-tool-\d+/u)?.[0]),
          [8, 6, 4, 4, 5, 5, 1, 5, 4, 4, 2, 5, 7].flatMap((count, cycle) =>
            Array.from({ length: count }, (_, index) => `cycle-${cycle}-tool-${index}`)),
          'hidden reasoning cannot reorder, duplicate or discard current-response tools');
        await activate(responseWork);
        assert.equal(await responseWork.getAttribute('aria-expanded'), 'false');
      }
      await update("middle-empty", engine);
      assert.equal(await page.locator('.thread-reasoning').count(), 0);
      assert.equal(await page.locator('.thread-agent-activity__turn-toggle button').count(), 0,
        'empty reasoning does not manufacture earlier completed response folds while streaming');
      const existingGroup = page.locator('.thread-agent-activity__group').first();
      const existingToggle = existingGroup.getByRole('button').first();
      await activate(existingToggle);
      assert.equal(await existingToggle.getAttribute('aria-expanded'), 'true');
      const existingIdentity = await existingGroup.getAttribute('data-activity-group-id');
      await existingGroup.evaluate(element => { (window as any).__existingToolGroupNode = element; });
      await update("middle-fill");
      assert.equal(await page.locator('.thread-agent-activity__group').first().getAttribute('data-activity-group-id'), existingIdentity,
        'a newly visible reasoning Item retains the first tool-source identity');
      assert.equal(await page.evaluate(() => (window as any).__existingToolGroupNode === document.querySelector('.thread-agent-activity__group')), true,
        'first actual reasoning text retains the already-mounted first tool group');
      assert.equal(await existingToggle.getAttribute('aria-expanded'), 'true', 'first text cannot reset an existing explicit tool choice');
      assert.equal(await page.locator('.thread-reasoning').getByRole('button').getAttribute('aria-expanded'), 'false');
      assert.deepEqual(await page.locator('.thread-agent-activity__group,.thread-reasoning').evaluateAll(elements =>
        elements.map(element => element.classList.contains('thread-reasoning') ? 'reasoning'
          : element.getAttribute('data-activity-group-id')?.includes('before-bash') ? 'before' : 'after')),
        ['before', 'reasoning', 'after'], 'visible reasoning is chronological and independent of both tool groups');
      await update("complete");
      const workFolds = page.locator('.thread-agent-activity__turn-toggle button');
      assert.equal(await workFolds.count(), 1, 'one response final folds all thinking and tools under one work owner');
      assert.equal(await workFolds.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('.thread-reasoning').count(), 0);
      await activate(workFolds);
      assert.equal(await workFolds.getAttribute('aria-expanded'), 'true');
      const independentReason = page.locator('.thread-reasoning').getByRole('button');
      assert.equal(await independentReason.getAttribute('aria-expanded'), 'false');
      await activate(independentReason);
      await activate(workFolds);
      assert.equal(await page.locator('.thread-reasoning').count(), 0, 'outer collapse hides all inner work');
      await activate(workFolds);
      await page.locator('.thread-reasoning').waitFor();
      assert.equal(await independentReason.getAttribute('aria-expanded'), 'true', 'reopening restores the thinking choice');
      assert.equal(await existingToggle.getAttribute('aria-expanded'), 'true', 'reopening restores the first tool choice');
      await update("reasoning-only-complete", engine);
      const onlyWork = page.locator('.thread-agent-activity__turn-toggle button');
      assert.equal(await onlyWork.count(), 1, 'reasoning alone is real collapsible work');
      assert.equal(await onlyWork.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('.thread-reasoning').count(), 0, 'no completed thinking remains outside work');
      assert.equal(await page.locator('.thread-work-status__label').count(), 1);
      assert.ok(await page.getByText('Final answer', { exact: true }).isVisible());
      await activate(onlyWork);
      const onlyReason = page.locator('.thread-agent-activity .thread-reasoning');
      await onlyReason.waitFor();
      assert.equal(await onlyReason.getByRole('button').getAttribute('aria-expanded'), 'false');
      await activate(onlyReason.getByRole('button'));
      await onlyReason.locator('.thread-activity-item__prose').waitFor();
      await activate(onlyWork);
      await activate(onlyWork);
      await onlyReason.waitFor();
      assert.equal(await onlyReason.getByRole('button').getAttribute('aria-expanded'), 'true');
      await page.screenshot({ path: join(output, `${engine}-${theme}-${touch ? 'touch' : 'mouse'}-reasoning-only.png`) });
      await update("markdown", engine);
      const markdownReason = page.locator('.thread-reasoning');
      const markdownToggle = markdownReason.locator(':scope > .thread-activity-item > .thread-activity-item__header button');
      assert.equal(await markdownToggle.getAttribute('aria-expanded'), 'false');
      assert.equal((await markdownReason.locator('.thread-activity-item__detail').innerText()).trim(), 'Current check');
      await activate(markdownToggle);
      const markdownBody = markdownReason.locator('.opencraft-chat-document');
      await markdownBody.locator('h1 strong').waitFor();
      assert.equal(await markdownBody.locator('h1 strong').innerText(), 'Checking the result');
      assert.equal(await markdownBody.locator('em').innerText(), 'carefully');
      assert.equal(await markdownBody.locator('ul li').count(), 2);
      assert.ok(await markdownBody.locator('code').filter({ hasText: 'a_b' }).count() >= 1);
      assert.ok(await markdownBody.getByText('const a_b = 42;', { exact: true }).count() >= 1);
      assert.equal(await markdownBody.locator('script').count(), 0);
      assert.equal(await page.evaluate(() => (window as any).__unsafeReasoning), undefined);
      assert.equal(await markdownBody.locator('[href^="javascript:"]').count(), 0);
      const fileLink = markdownBody.getByRole('link', { name: 'The file', exact: true });
      await activate(fileLink);
      assert.equal(await markdownToggle.getAttribute('aria-expanded'), 'true', 'resource activation cannot collapse thinking');
      assert.deepEqual(await page.evaluate(() => (window as any).openedReasoningResources.at(-1)),
        { target: 'file:///work/a.ts', kind: 'file' }, 'thinking resources use the existing Host opener');
      await markdownReason.evaluate(element => { (window as any).__markdownReasoningNode = element; });
      await update("markdown-grow");
      assert.equal(await markdownToggle.getAttribute('aria-expanded'), 'true');
      assert.equal((await markdownReason.locator('.thread-activity-item__detail').innerText()).trim(), 'New returned line');
      await markdownBody.locator('strong').filter({ hasText: /^returned$/ }).waitFor();
      assert.equal(await page.evaluate(() => (window as any).__markdownReasoningNode === document.querySelector('.thread-reasoning')), true);
      await update("complete");
      const markdownWork = page.locator('.thread-agent-activity__turn-toggle button');
      assert.equal(await markdownWork.getAttribute('aria-expanded'), 'false');
      await activate(markdownWork);
      assert.equal(await markdownToggle.getAttribute('aria-expanded'), 'true');
      assert.equal((await markdownReason.locator('.thread-activity-item__detail').innerText()).trim(), 'Checking the result');
      await markdownBody.locator('h1 strong').waitFor();
      await page.screenshot({ path: join(output, `${engine}-${theme}-${touch ? 'touch' : 'mouse'}-markdown.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      results.push({ engine, theme, touch, defaultCollapsed: true, independentTools: true, choiceRestored: true, markdown: true,
        firstTextPreservesExistingToolChoice: true, oneResponseWorkFold: true, thirteenEmptyItemsRetainSixtyTools: true });
    }
    await update("activity-scale", "codex");
    const compactGaps = await page.locator('.thread-agent-activity__content').evaluateAll(lists => lists.flatMap(list => {
      const units = [...list.children];
      return units.slice(1).map((unit, index) => unit.getBoundingClientRect().top - units[index]!.getBoundingClientRect().bottom);
    }));
    assert.ok(compactGaps.length >= 3, 'mixed command/image/reasoning fixture crosses activity group boundaries');
    for (const gap of compactGaps) assert.ok(Math.abs(gap - 4) < 0.5, `collapsed summaries share 4px spacing, got ${gap}`);

    await page.locator('.thread-activity-item__icon > .lucide-image').waitFor();
    await page.screenshot({ path: join(output, `${theme}-${touch ? 'touch' : 'mouse'}-collapsed-spacing.png`) });
    const imageRow = page.locator('.thread-agent-activity__unit').filter({ has: page.locator('.lucide-image') });
    const imageToggle = imageRow.getByRole('button').first();
    const imageBoundaryGap = () => imageRow.evaluate(unit => unit.nextElementSibling!.getBoundingClientRect().top - unit.getBoundingClientRect().bottom);
    await activate(imageToggle);
    assert.equal(await imageToggle.getAttribute('aria-expanded'), 'true');
    const waitForImageGap = (expected: number) => page.waitForFunction(expected => {
      const icon = document.querySelector('.thread-agent-activity__unit .lucide-image');
      const unit = icon?.closest('.thread-agent-activity__unit');
      return unit && unit.nextElementSibling && Math.abs(unit.nextElementSibling.getBoundingClientRect().top - unit.getBoundingClientRect().bottom - expected) < 0.5;
    }, expected, { timeout: 3_000 });
    await waitForImageGap(4);
    const expandedImageGap = await imageBoundaryGap();
    assert.ok(Math.abs(expandedImageGap - 4) < 0.5, `expanded image details preserve the activity row boundary: ${theme}/${touch} got ${expandedImageGap}`);
    await activate(imageToggle);
    assert.equal(await imageToggle.getAttribute('aria-expanded'), 'false');
    await waitForImageGap(4);
    assert.ok(Math.abs(await imageBoundaryGap() - 4) < 0.5, 'collapsing image restores the shared compact rhythm');

    for (const group of await page.locator('.thread-agent-activity__group').all()) {
      const toggle = group.getByRole('button').first();
      if (await toggle.getAttribute('aria-expanded') === 'false') await activate(toggle);
    }
    await page.locator('.thread-activity-item__icon > [data-codex-activity-icon="read"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const measureScale = () => page.evaluate(() => Array.from(document.querySelectorAll<SVGSVGElement>(
      '.thread-activity-item__icon > svg')).map(svg => {
      const rail = svg.parentElement!;
      const header = rail.closest('.thread-activity-item__header')!;
      const summary = header.querySelector('.thread-activity-item__summary')!;
      const box = svg.getBBox(), screen = svg.getBoundingClientRect(), slot = rail.getBoundingClientRect();
      const type = getComputedStyle(summary);
      return { glyph: svg.getAttribute('data-codex-activity-icon') ?? svg.classList[1], paths: svg.innerHTML,
        fontSize: parseFloat(type.fontSize), weight: type.fontWeight,
        width: screen.width, visibleWidth: box.width * screen.width / svg.viewBox.baseVal.width,
        centerOffset: Math.abs(screen.x + screen.width / 2 - slot.x - slot.width / 2),
        renderedStroke: parseFloat(getComputedStyle(svg).strokeWidth) * screen.width / svg.viewBox.baseVal.width };
    }).filter((icon, index, all) => all.findIndex(candidate => candidate.glyph === icon.glyph) === index));
    const current = await measureScale();
    assert.equal(current.length, 4, 'real renderer covers brain, terminal, image and read');
    for (const icon of current) {
      assert.equal(icon.fontSize, 14, `${icon.glyph}: shared body scale`);
      assert.equal(icon.weight, '400');
      assert.ok(icon.visibleWidth >= 14.5 && icon.visibleWidth <= 15.5, `${icon.glyph}: balanced visible silhouette`);
      assert.ok(icon.centerOffset < 0.1, `${icon.glyph}: centered shared rail`);
      if (icon.glyph?.startsWith('lucide-')) assert.ok(Math.abs(icon.renderedStroke - 1.2) < 0.01);
    }
    await page.screenshot({ path: join(output, `${theme}-${touch ? 'touch' : 'mouse'}-activity-scale.png`) });
    // Reproduce the previous proportions on the same real consumer, then remove
    // the scoped probe. Glyph identity and interaction remain unchanged.
    const oldScale = await page.addStyleTag({ content: `
      .thread-activity-item__header { font: var(--typography-chat-font) !important; }
      .thread-activity-item__header, .thread-activity-item__header * { transition: none !important; }
      .thread-activity-item__icon { width:16px; }
      .thread-activity-item__icon > svg { width:16px; height:16px; }
      .thread-activity-item__icon > .lucide { stroke-width:2; }
      .thread-activity-item__icon > .lucide-brain { width:14px; height:14px; stroke-width:1.8; }
      .thread-activity-item__icon > [data-codex-activity-icon="read"] { width:15px; height:15px; }
    ` });
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.thread-activity-item__summary'))
      .every(node => getComputedStyle(node).fontSize === getComputedStyle(document.documentElement).getPropertyValue('--typography-chat-size').trim()));
    const previous = await measureScale();
    for (let index = 0; index < current.length; index++) {
      assert.equal(previous[index].paths, current[index].paths, 'rendering adjustment preserves glyph paths');
      assert.equal(previous[index].fontSize, current[index].fontSize, `${current[index].glyph}: restore readable copy without shrinking text`);
      assert.ok(previous[index].visibleWidth < current[index].visibleWidth, 'previous silhouette was smaller');
    }
    await page.screenshot({ path: join(output, `${theme}-${touch ? 'touch' : 'mouse'}-activity-scale-before.png`) });
    await oldScale.evaluate(node => node.remove());
    activityScales.push({ theme, touch, dpr: touch ? 2 : 1,
      previous: previous.map(({ paths, ...metrics }) => metrics), current: current.map(({ paths, ...metrics }) => metrics) });
    assert.deepEqual(errors, []);
    const resizeFeedback = await page.evaluate(() => (window as any).resizeFeedback);
    assert.deepEqual(resizeFeedback.filter((event: any) => !['long-empty', 'long-empty-clock', 'middle-empty'].includes(event.action)), [],
      'Markdown and normal thinking interactions must not introduce ResizeObserver feedback');
    // Preserve evidence of the separate, pre-existing long-tool-group reflow
    // sequence instead of suppressing browser error delivery or calling it clean.
    if (resizeFeedback.length > 0) console.log(JSON.stringify({ theme, touch,
      existingToolGroupResizeWarnings: resizeFeedback.map((event: any) => event.action) }));
    await page.close();
  }
  const localizedLabels = process.argv.includes("--detail-view-only") || process.argv.includes("--diff-reading-only") ? [] : [
    ["zh-Hant", "思考中…", "思考過程"],
    ["id-ID", "Sedang berpikir…", "Proses berpikir"],
    ["es", "Pensando…", "Razonamiento"],
    ["ja-JP", "思考中…", "思考過程"],
    ["ko-KR", "생각하는 중…", "사고 과정"],
  ] as const;
  for (const [locale, running, settled] of localizedLabels) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true, hasTouch: true });
    await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}/?theme=light&locale=${locale}`);
    await page.locator('[data-revision="0"]').waitFor();
    await page.evaluate(() => (window as any).update("long-detail", "codex"));
    await page.locator('[data-revision="1"]').waitFor();
    for (const [label, revision] of [[running, 1], [settled, 2]] as const) {
      const header = await page.locator('.thread-reasoning').evaluate(element => {
        const summary = element.querySelector<HTMLElement>('.thread-activity-item__summary')!;
        const detail = element.querySelector<HTMLElement>('.thread-activity-item__detail')!;
        return { label: summary.firstChild?.textContent, summary: [summary.clientWidth, summary.scrollWidth],
          detail: [detail.clientWidth, detail.scrollWidth] };
      });
      assert.equal(header.label, label, `${locale} reasoning label`);
      assert.ok(header.summary[0] + 1 >= header.summary[1], `${locale} reasoning label must fit`);
      assert.ok(header.detail[0] + 1 < header.detail[1], `${locale} long preview should truncate`);
      if (revision === 1) {
        await page.evaluate(() => (window as any).update("tools"));
        await page.locator('[data-revision="2"]').waitFor();
      }
    }
    await page.screenshot({ path: join(output, `codex-${locale}-touch-long-detail.png`) });
    await page.close();
  }
  await writeFile(join(output, 'activity-scales.json'), JSON.stringify(activityScales, null, 2));
  console.log(JSON.stringify({ passed: results, localizedLabels: localizedLabels.map(([locale]) => locale), output,
    scope: 'Real shared projector and Conversation/disclosure/viewport; engine text synthetic, not paid model or native iPhone acceptance.' }));
} finally { await browser?.close(); await vite.close(); }
