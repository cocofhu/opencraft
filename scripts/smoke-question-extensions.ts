import assert from "node:assert/strict";
import { createServer } from "vite";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
const { chromium } = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? "playwright");
const output = resolve(process.env.OPENCRAFT_SMOKE_OUTPUT_DIR ?? ".local/question-extensions"); await mkdir(output, { recursive: true });
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", esbuild: { jsx: "automatic" }, resolve: { dedupe: ["react", "react-dom"] }, cacheDir: "node_modules/.vite-question-extensions", server: { host: "127.0.0.1", port: 0 }, plugins: [{ name: "question-extensions", configureServer(server) { server.middlewares.use((req, res, next) => { if (req.url !== "/") return next(); res.setHeader("content-type", "text/html"); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/tests/fixtures/question-extensions.tsx"></script>'); }); } }] });
let browser: any;
try {
  await vite.listen(); browser = await chromium.launch({ headless: true, executablePath: process.env.OPENCRAFT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
  for (const width of [390, 1100]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, reducedMotion: "reduce" }); const errors: string[] = [];
    page.on("pageerror", (error: Error) => errors.push(error.message)); await page.addInitScript("window.__name=value=>value");
    await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as any).port}`);
    await page.getByRole("heading", { name: "Full fixture plan" }).waitFor();
    const first = page.getByRole("button", { name: /1 Verify/ }), second = page.getByRole("button", { name: /2 Deliver/ });
    await first.click(); await second.click(); assert.equal(await first.getAttribute("aria-pressed"), "true"); assert.equal(await second.getAttribute("aria-pressed"), "true");
    assert.deepEqual(await page.evaluate(() => (window as any).answers), []);
    await page.getByRole("textbox").fill("Custom step"); await page.screenshot({ path: join(output, `${width}-multiselect.png`) });
    await page.getByRole("button", { name: /Submit/ }).click();
    await page.waitForFunction(() => (window as any).answers.length === 1);
    assert.deepEqual(await page.evaluate(() => (window as any).answers[0]), { type: "answer-questions", answers: { q: ["Verify", "Deliver", "Custom step"] } });
    assert.deepEqual(errors, []); await page.close();
  }
  console.log(JSON.stringify({ result: "passed", mobileWeb: true, desktopWeb: true, explicitMultiSubmit: true, fullPlanMarkdown: true, output }));
} finally { await browser?.close(); await vite.close(); }
