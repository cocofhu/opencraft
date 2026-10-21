import { serverFetch } from "./server-context";

/** Geometry only. No content, route, account, input value or user agent. */
export function createViewportDiagnostics() {
  // A page may stay open through many keyboard cycles. Bound traffic without
  // making later interactions permanently invisible after the first 64 samples.
  let credits = 64;
  let creditedAt = performance.now();
  let lastAt = -Infinity;
  let lastSignature = "";
  const episode = `viewport-${Date.now().toString(36)}`;
  return () => {
    if (document.visibilityState !== "visible") return;
    const now = performance.now();
    credits = Math.min(64, credits + Math.max(0, now - creditedAt) / 125);
    creditedAt = now;
    if (now - lastAt < 80 || credits < 1) return;
    const shell = document.querySelector<HTMLElement>(".app-shell-root");
    const visual = window.visualViewport;
    if (!shell || !visual) return;
    const sourceRevision = document.querySelector<HTMLMetaElement>('meta[name="opencraft-source-revision"]')?.content;
    if (!sourceRevision || !/^[a-f0-9]{40}$/.test(sourceRevision)) return;
    const rect = shell.getBoundingClientRect();
    const rootRect = document.documentElement.getBoundingClientRect();
    const bodyRect = document.body.getBoundingClientRect();
    const fixedRect = document.querySelector("[data-timeline-fixed-reference]")?.getBoundingClientRect();
    const style = window.getComputedStyle(shell);
    const active = document.activeElement;
    const editing = active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA)$/.test(active.tagName));
    const send = document.querySelector(".opencraft-composer-submit")?.getBoundingClientRect();
    const geometry = {
      layoutHeight: innerHeight, layoutWidth: innerWidth,
      visualHeight: visual.height, visualWidth: visual.width,
      visualTop: visual.offsetTop, visualLeft: visual.offsetLeft,
      pageTop: visual.pageTop, scrollY, scale: visual.scale,
      shellTop: rect.top, shellHeight: rect.height,
      // Independent observations: never derive a positioning correction here.
      cssTop: Number.parseFloat(style.top) || 0,
      cssHeight: Number.parseFloat(style.height) || 0,
      clientHeight: document.documentElement.clientHeight,
      rootTop: rootRect.top, rootHeight: rootRect.height,
      bodyTop: bodyRect.top, bodyHeight: bodyRect.height,
      fixedTop: fixedRect?.top ?? 0, fixedLeft: fixedRect?.left ?? 0,
      editorTop: editing ? active.getBoundingClientRect().top : 0,
      sendBottom: send?.bottom ?? 0, editing: Number(editing),
    };
    const signature = JSON.stringify(geometry);
    if (signature === lastSignature) return;
    lastSignature = signature; lastAt = now; credits--;
    void serverFetch("/__opencraft_apphost_diagnostic", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "viewport", episode, sourceRevision, ...geometry }),
      keepalive: true, signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
  };
}
