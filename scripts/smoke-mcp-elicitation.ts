import assert from "node:assert/strict";
import { createServer } from "vite";

const playwright = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? "playwright");
const { chromium } = playwright.default ?? playwright;
const vite = await createServer({ configFile: false, root: process.cwd(), logLevel: "error",
  esbuild: { jsx: "automatic" }, resolve: { dedupe: ["react", "react-dom"] },
  cacheDir: "node_modules/.vite-mcp-elicitation-smoke", server: { host: "127.0.0.1", port: 0 },
  plugins: [{ name: "mcp-elicitation-smoke", configureServer(server) {
    server.middlewares.use((request, response, next) => {
      if (request.url !== "/") return next();
      response.setHeader("content-type", "text/html");
      response.end('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="/tests/fixtures/mcp-elicitation.tsx"></script>');
    });
  } }],
});
let browser: any;
try {
  await vite.listen();
  browser = await chromium.launch({ headless: true, executablePath: process.env.OPENCRAFT_CHROMIUM_EXECUTABLE, args: ["--no-sandbox"] });
  const errors: string[] = [];
  for (const width of [390, 1200]) {
    const page = await browser.newPage({ viewport: { width, height: 1100 }, reducedMotion: "reduce" });
    page.on("pageerror", (error: Error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}`);
    const show = async (name: string) => {
      await page.evaluate(name => { (window as any).mcpActions = []; (window as any).showMcpCase(name); }, name);
      await page.locator(`main[data-scenario="${name}"]`).waitFor();
    };
    const actions = () => page.evaluate(() => (window as any).mcpActions);
    await page.locator(".thread-elicitation").waitFor();
    assert.deepEqual(await actions(), []);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    assert.match(await page.getByRole("alert").innerText(), /This field is required/);
    assert.deepEqual(await actions(), []);
    const field = (name: string) => page.locator(".thread-elicitation__field").filter({ has: page.locator("b", { hasText: new RegExp(`^${name}$`) }) });
    await field("Name").locator("input").fill("中文草稿");
    await field("Count").locator("input").fill("3");
    await field("Enabled").getByRole("button").click();
    await field("Environment").locator("select").selectOption("prod");
    await field("Tags").getByRole("checkbox", { name: "fast", exact: true }).check();
    await page.evaluate(() => (window as any).hideMcpForm());
    await page.locator('main[data-scenario="hidden"]').waitFor();
    await page.evaluate(() => (window as any).replayMcpForm());
    await page.locator(".thread-elicitation").waitFor();
    assert.equal(await field("Name").locator("input").inputValue(), "中文草稿");
    assert.equal(await field("Count").locator("input").inputValue(), "3");
    assert.equal(await field("Enabled").getByRole("button").getAttribute("aria-pressed"), "false");
    assert.equal(await field("Environment").locator("select").inputValue(), "prod");
    assert.equal(await field("Tags").getByRole("checkbox", { name: "fast", exact: true }).isChecked(), true);
    assert.deepEqual(await actions(), []);
    await page.evaluate(() => (window as any).replayMcpForm("request"));
    await page.waitForFunction(() => (document.querySelector('.thread-elicitation__field input[type="text"]') as HTMLInputElement)?.value === "");
    assert.equal(await field("Count").locator("input").inputValue(), "2");
    await field("Name").locator("input").fill("fresh request draft");
    await page.evaluate(() => (window as any).replayMcpForm("schema"));
    await page.waitForFunction(() => (document.querySelector('.thread-elicitation__field input[type="text"]') as HTMLInputElement)?.value === "");
    assert.equal(await field("Count").locator("input").inputValue(), "1");
    await show("form");
    await field("Name").locator("input").fill("  Demo  ");
    await field("Count").locator("input").fill("0");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    assert.match(await page.getByRole("alert").innerText(), /Must be at least 1/);
    await field("Count").locator("input").fill("3");
    await field("Environment").locator("select").selectOption("prod");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.waitForFunction(() => (window as any).mcpActions.length === 1);
    assert.deepEqual(await actions(), [{ type: "accept-elicitation", content: { name: "Demo", count: 3, enabled: true, environment: "prod", tags: ["safe"] } }]);
    await show("tool");
    const approval = page.locator(".thread-mcp-tool-approval");
    assert.equal(await approval.getAttribute("data-risk-level"), "high");
    await approval.getByRole("button", { name: "Expand payload", exact: true }).click();
    assert.match(await approval.locator('[data-expanded="true"]').innerText(), /x{140}/);
    await approval.getByRole("button", { name: "Show 1 more items", exact: true }).click();
    assert.equal(await approval.locator("dt").count(), 5);
    await page.screenshot({ path: `/tmp/opencraft-mcp-elicitation-${width}.png`, fullPage: true });
    await approval.locator("summary").click();
    await approval.getByRole("menuitem", { name: "Allow this conversation", exact: true }).click();
    await page.waitForFunction(() => (window as any).mcpActions.length === 1);
    assert.deepEqual(await actions(), [{ type: "accept-elicitation", persist: "session" }]);
    await show("tool");
    await approval.locator("summary").click();
    await approval.getByRole("menuitem", { name: "Always allow", exact: true }).click();
    await page.waitForFunction(() => (window as any).mcpActions.length === 1);
    assert.deepEqual(await actions(), [{ type: "accept-elicitation", persist: "always" }]);
    await show("tool");
    await approval.getByRole("button", { name: "Deny", exact: true }).click();
    await page.waitForFunction(() => (window as any).mcpActions.length === 1);
    assert.deepEqual(await actions(), [{ type: "decline" }]);
    // Native keyboard activation must preserve the focused control's intent.
    for (const [name, action] of [
      ["Deny", { type: "decline" }],
      ["Allow once", { type: "accept-elicitation" }],
      ["Allow this conversation", { type: "accept-elicitation", persist: "session" }],
      ["Always allow", { type: "accept-elicitation", persist: "always" }],
    ] as const) {
      await show("tool");
      if (name === "Allow this conversation" || name === "Always allow") await approval.locator("summary").click();
      const control = name === "Allow once" ? approval.locator("button.is-primary")
        : name === "Deny" ? approval.getByRole("button", { name, exact: true })
        : approval.getByRole("menuitem", { name, exact: true });
      await control.focus();
      assert.equal(await control.evaluate((element: HTMLElement) => document.activeElement === element), true);
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => (window as any).mcpActions.length === 1);
      assert.deepEqual(await actions(), [action]);
    }
    await show("tool");
    const summary = approval.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector(".thread-mcp-tool-approval details")?.hasAttribute("open"));
    assert.deepEqual(await actions(), []);
    const expand = approval.getByRole("button", { name: "Expand payload", exact: true });
    await expand.focus(); await page.keyboard.press("Enter");
    await approval.locator('[data-expanded="true"]').waitFor();
    assert.deepEqual(await actions(), []);
    const more = approval.getByRole("button", { name: "Show 1 more items", exact: true });
    await more.focus(); await page.keyboard.press("Enter");
    assert.equal(await approval.locator("dt").count(), 5);
    assert.deepEqual(await actions(), []);
    await show("tool");
    const cancelled = await page.evaluate(() => {
      (document.activeElement as HTMLElement)?.blur();
      document.addEventListener("keydown", (event: KeyboardEvent) => event.preventDefault(), { once: true });
      const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(cancelled, true); assert.deepEqual(await actions(), []);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => (window as any).mcpActions.length === 1);
    assert.deepEqual(await actions(), [{ type: "accept-elicitation" }]);
    await show("tool");
    await approval.getByRole("button", { name: "Deny", exact: true }).focus();
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => (window as any).mcpActions.length === 1);
    assert.deepEqual(await actions(), [{ type: "decline" }]);
    await show("suggestion");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Install/ }).click();
    assert.deepEqual(await actions(), []);
    assert.equal(await page.evaluate(() => (window as any).mcpOpened.at(-1)), "https://example.test/install");
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.waitForFunction(() => (window as any).mcpActions.length === 1);
    assert.deepEqual(await actions(), [{ type: "accept-elicitation", persist: "always" }]);
    await show("auth");
    assert.match(await page.locator("main").innerText(), /files.read/);
    await page.getByRole("button", { name: /Connect/ }).click();
    assert.deepEqual(await actions(), []);
    assert.equal(await page.evaluate(() => (window as any).mcpOpened.at(-1)), "https://example.test/auth");
    await page.getByRole("button", { name: /Continue/ }).click();
    await page.waitForFunction(() => (window as any).mcpActions.length === 1);
    assert.deepEqual(await actions(), [{ type: "accept-elicitation" }]);
    await show("url");
    assert.equal(await page.getByRole("link").getAttribute("href"), "https://example.test/continue");
    await page.getByRole("button", { name: "Decline", exact: true }).click();
    await page.waitForFunction(() => (window as any).mcpActions.length === 1);
    assert.deepEqual(await actions(), [{ type: "decline" }]);
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log("PASS: real MCP interaction panel at 390/1200px; validation, typed form submit, risk, JSON expansion, persistence, deny, setup handoffs, connector auth and generic URL actions");
} finally { await browser?.close(); await vite.close(); }
