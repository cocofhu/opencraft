import { serverFetch } from "./server-context";

/** Geometry only. No content, route, account, input value or user agent. */
export function createViewportDiagnostics() {
  let reports = 0;
  let lastAt = -Infinity;
  let lastSignature = "";
  const episode = `viewport-${Date.now().toString(36)}`;
  return () => {
    if (reports >= 64 || document.visibilityState !== "visible") return;
    const now = performance.now();
    if (now - lastAt < 80) return;
    const shell = document.querySelector<HTMLElement>(".app-shell-root");
    const visual = window.visualViewport;
    if (!shell || !visual) return;
    const rect = shell.getBoundingClientRect();
    const active = document.activeElement;
    const editing = active instanceof HTMLElement && (active.isContentEditable || /^(INPUT|TEXTAREA)$/.test(active.tagName));
    const send = document.querySelector(".opencraft-composer-submit")?.getBoundingClientRect();
    const geometry = {
      layoutHeight: innerHeight, layoutWidth: innerWidth,
      visualHeight: visual.height, visualWidth: visual.width,
      visualTop: visual.offsetTop, visualLeft: visual.offsetLeft,
      pageTop: visual.pageTop, scrollY, scale: visual.scale,
      shellTop: rect.top, shellHeight: rect.height,
      editorTop: editing ? active.getBoundingClientRect().top : 0,
      sendBottom: send?.bottom ?? 0, editing: Number(editing),
    };
    const signature = JSON.stringify(geometry);
    if (signature === lastSignature) return;
    lastSignature = signature; lastAt = now; reports++;
    const sourceRevision = document.querySelector<HTMLMetaElement>('meta[name="opencraft-source-revision"]')?.content;
    if (!sourceRevision || !/^[a-f0-9]{40}$/.test(sourceRevision)) return;
    void serverFetch("/__opencraft_apphost_diagnostic", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "viewport", episode, sourceRevision, ...geometry }),
      keepalive: true, signal: AbortSignal.timeout(5_000),
    }).catch(() => {});
  };
}
