import assert from "node:assert/strict";
import { createServer } from "vite";

// Run with an installed Playwright module and Chrome/Chromium binary; use
// OPENCRAFT_PLAYWRIGHT_MODULE and OPENCRAFT_CHROMIUM_EXECUTABLE when external.
const { chromium } = await import(process.env.OPENCRAFT_PLAYWRIGHT_MODULE ?? "playwright");
const vite = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "error",
  esbuild: { jsx: "automatic" },
  resolve: { dedupe: ["react", "react-dom"] },
  cacheDir: "node_modules/.vite-sent-image-preview-smoke",
  server: { host: "127.0.0.1", port: 0 },
  plugins: [{
    name: "sent-image-preview-smoke",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== "/") return next();
        response.setHeader("content-type", "text/html");
        response.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="host"></div><script type="module" src="/tests/fixtures/sent-image-preview.tsx"></script></body></html>');
      });
    },
  }],
});

let browser;
try {
  await vite.listen();
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.OPENCRAFT_CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${(vite.httpServer!.address() as { port: number }).port}`);
  const thumbnail = page.locator("#host").getByRole("button", { name: "Open attached image" });
  await thumbnail.click();
  const dialog = page.locator("#host").getByRole("dialog", { name: "Attached image 1 of 1" });
  await dialog.waitFor({ timeout: 5_000 });
  assert.equal(await dialog.locator("img").count(), 1);
  const thumbnailBox = await thumbnail.boundingBox();
  const previewBox = await dialog.locator("img").boundingBox();
  assert.ok(thumbnailBox !== null && previewBox !== null && previewBox.width > thumbnailBox.width);
  assert.equal(await page.evaluate(() => document.body.querySelectorAll('[role="dialog"]').length), 0);
  await page.screenshot({ path: "/tmp/cn-opencraft-sent-image-preview.png" });
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  // Real touch input through the shared image viewport inside its ShadowRoot.
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const phone = await mobile.newPage();
  const mobileErrors: string[] = [];phone.on("pageerror", error => mobileErrors.push(error.message));
  await phone.addInitScript("window.__name=value=>value");
  await phone.goto(page.url());
  const trigger = phone.getByRole("button", { name: "Open attached image" });await trigger.click();
  const stage = phone.locator(".opencraft-zoomable-image");await stage.waitFor();await phone.waitForTimeout(250);
  const cdp = await mobile.newCDPSession(phone);
  const touch = async (type: string, points: number[][]) => {await cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map(([x,y],i)=>({x,y,id:i+1})) });await phone.waitForTimeout(35);};
  const matrix = () => stage.locator("img").evaluate(e => {const m=new DOMMatrixReadOnly(getComputedStyle(e).transform);return {scale:Math.hypot(m.a,m.b),angle:Math.atan2(m.b,m.a),x:m.e,y:m.f};});
  await touch("touchStart", [[145,422],[245,422]]);await touch("touchMove", [[185,422],[205,422]]);await touch("touchEnd", []);
  assert(Math.abs((await matrix()).scale-.2)<.01, "pinch can shrink below fitted size to 0.2×");
  await touch("touchStart", [[185,422],[205,422]]);await touch("touchMove", [[45,422],[345,422]]);await touch("touchEnd", []);
  assert(Math.abs((await matrix()).scale-3)<.05, "shrunk image can zoom back in");
  await touch("touchStart", [[115,422],[275,422]]);
  for(let i=1;i<=12;i++){const a=Math.PI/2*i/12;await touch("touchMove", [[195-80*Math.cos(a),422-80*Math.sin(a)],[195+80*Math.cos(a),422+80*Math.sin(a)]]);}
  await touch("touchEnd", []);const rotated=await matrix();
  assert(Math.abs(rotated.angle-Math.PI/2)<.02&&Math.abs(rotated.scale-3)<.05,"two fingers rotate 90 degrees without changing scale");
  await touch("touchStart", [[195,422]]);await touch("touchMove", [[230,470]]);await touch("touchEnd", []);
  const panned=await matrix();assert(panned.x>20&&panned.y>20,"rotated image remains draggable with rotated bounds");
  await phone.screenshot({path:process.env.OPENCRAFT_IMAGE_GESTURE_SCREENSHOT??"/tmp/opencraft-image-rotate-shrink.png"});
  await phone.keyboard.press("Escape");await trigger.click();await phone.waitForTimeout(150);
  const reset=await matrix();assert(Math.abs(reset.scale-1)<.001&&Math.abs(reset.angle)<.001&&Math.abs(reset.x)<.001&&Math.abs(reset.y)<.001,"reopening resets rotation, scale and pan");
  assert.deepEqual(mobileErrors,[]);await mobile.close();
  assert.deepEqual(errors, []);
  console.log("PASS: sent image opens and closes inside the embedded presentation root");
} finally {
  await browser?.close();
  await vite.close();
}
