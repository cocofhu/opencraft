import assert from "node:assert/strict";
import { createServer } from "vite";
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", esbuild: { jsx: "automatic" }, resolve: { dedupe: ["react", "react-dom"] }, server: { host: "127.0.0.1", port: 0 }, plugins: [{ name: "rail", configureServer(server) { server.middlewares.use((req, res, next) => { if (!req.url?.startsWith("/?")) return next(); res.setHeader("content-type", "text/html"); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/tests/fixtures/composer-attached-rail.tsx"></script>'); }); } }] });
const playwright = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? "playwright");
const { chromium } = playwright.default ?? playwright;
let browser: any;
try {
 await vite.listen(); browser = await chromium.launch({ headless: true, executablePath: process.env.OPENCRAFT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
 const quick = process.argv.includes("--quick");
 for (const width of [390, 1280]) for (const palette of quick ? ["codex"] : ["codex", "vela", "frost", "lavender", "mist", "zenCode"]) for (const mode of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width, height: 700 }, hasTouch: width === 390 });
  const errors: string[] = []; page.on("pageerror", (e: Error) => errors.push(e.message));
  await page.addInitScript("window.__name=value=>value");
  await page.goto(`${vite.resolvedUrls!.local[0]}?palette=${palette}&mode=${mode}`);
  await page.evaluate(width=>{document.documentElement.dataset.uiDensity=width===390?'touch':'compact'},width);
  await page.locator('.codex-composer-queue-item').waitFor(); await page.waitForTimeout(250);
  const rowHeights = () => page.evaluate(() => ({
   queue: document.querySelector('.codex-composer-queue-item')!.getBoundingClientRect().height,
   summary: document.querySelector('.thread-live-changes')!.getBoundingClientRect().height,
   font: getComputedStyle(document.querySelector('.codex-composer-queue-item')!).fontSize,
  }));
  const beforeStyle = await page.addStyleTag({content: `:root[data-ui-density] { --height-composer-rail-row: max(32px, var(--size-control-hit-min)); --height-composer-queue-row: var(--height-composer-rail-row); --padding-composer-rail-row: 2px 10px; } .codex-composer-queue-item__drag { height:30px; margin:-3px -6px; } @media(pointer: coarse) { .codex-composer-queue-item,.codex-composer-queue-item__drag { min-height:44px; height:44px; } }`});
  const beforeHeights = await rowHeights(); await beforeStyle.evaluate(node => node.remove());
  const afterHeights = await rowHeights();
  assert.equal(afterHeights.queue, width===390 ? 36 : 28);
  assert.equal(afterHeights.summary, width===390 ? 32 : 28);
  assert.equal(afterHeights.font, beforeHeights.font);
  assert(afterHeights.queue < beforeHeights.queue && afterHeights.summary < beforeHeights.summary,JSON.stringify({beforeHeights,afterHeights}));
  console.log(JSON.stringify({width,palette,mode,beforeHeights,afterHeights}));
  await page.evaluate(() => (window as any).setRailCount(8));
  const tray = page.locator('.codex-composer-queue-tray');
  await page.locator('.codex-composer-queue-item').last().scrollIntoViewIfNeeded();
  assert(await tray.evaluate((node:HTMLElement) => node.scrollTop > 0 && node.clientHeight < node.scrollHeight));
  await page.evaluate(() => (window as any).setRailCount(1));
  for (const state of ["both", "summary", "queue", "empty"]) {
   await page.evaluate((state: string) => (window as any).setRailState(state), state); await page.waitForTimeout(30);
   const geometry = await page.locator('.codex-composer-attached-rail').evaluate((rail: HTMLElement) => {
    const editor = rail.nextElementSibling as HTMLElement; const r = rail.getBoundingClientRect(), e = editor.getBoundingClientRect(), css = getComputedStyle(rail);
    return { children: [...rail.children].map(n => n.className), height: r.height, bottom: r.bottom, editorTop: e.top, left: r.left, editorLeft: e.left, right: r.right, editorRight: e.right, background: getComputedStyle(rail,"::before").backgroundColor, blur:getComputedStyle(rail,"::before").backdropFilter, editorBackground:getComputedStyle(editor,"::before").backgroundColor, editorBlur:getComputedStyle(editor,"::before").backdropFilter, radius: css.borderTopLeftRadius, border: css.borderTopWidth, display: css.display };
   });
   if (state === "empty") { assert.equal(geometry.display, "none"); assert.equal(geometry.height, 0); }
   else {
    assert.equal(geometry.bottom - geometry.editorTop, 16, JSON.stringify(geometry));
    assert.equal(geometry.left - geometry.editorLeft, 10); assert.equal(geometry.editorRight - geometry.right, 10);
    assert.equal(geometry.radius, "16px"); assert.equal(geometry.border, "1px");
    assert(geometry.background.includes('0.94'), geometry.background);
    assert(geometry.blur.includes('20px'));
    if(width===1280){assert.equal(geometry.editorBlur,'none');assert(!geometry.editorBackground.includes('0.62'));}
    else assert(geometry.editorBlur.includes('18px'));
    const rail=page.locator('.codex-composer-attached-rail');
    const before=await rail.screenshot();
    await page.locator('[aria-hidden]').first().evaluate((node:HTMLElement)=>{node.style.background='rgb(220,40,80)'});
    const after=await rail.screenshot();assert(!before.equals(after), state+' must reveal the scrolling backdrop');
    await page.locator('[aria-hidden]').first().evaluate((node:HTMLElement)=>{node.style.background=''});
    assert.equal(geometry.children.length, state === "both" ? 2 : 1);
    if (state === "both") assert.deepEqual(geometry.children, ["codex-composer-queue-tray", "thread-live-changes"]);
   }
   if (state === "both" && (width === 390 || palette === "codex")) await page.screenshot({ path: `/tmp/rail-${width}-${palette}-${mode}.png` });
  }
  assert.deepEqual(errors, []); await page.close();
 }
 console.log(`PASS: ${quick ? 4 : 24} browser combinations, 4 occupancy states; shared perimeter/order, 16px contour tuck, 10px inset, compact queue/summary heights, bounded queue scroll, 94% material; desktop opaque editor/touch glass editor, 16px top radius, empty rail zero geometry`);
} finally { await browser?.close(); await vite.close(); }
