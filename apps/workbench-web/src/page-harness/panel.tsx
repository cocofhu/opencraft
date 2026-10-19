import { useEffect, useState, useSyncExternalStore } from "react";
import { MIXED_CONTENT_MESSAGE, previewSurface } from "@opencraft/page-harness-host/shared";
import "./panel.scss";
import {
  frameFor,
  getPageHarnessSnapshot,
  pageHarnessApi,
  pageHarnessSession,
  quotePickedElement,
  setPageHarnessNotice,
  setPageHarnessPick,
  setPageHarnessStatus,
  setPageHarnessView,
  subscribePageHarness,
  type PageHarnessPick,
  type PageHarnessServer,
  type PageHarnessStatus,
} from "./client";

function looksLikeUrl(value: string) {
  return /^\d+(?:[/?#]|$)/.test(value) || /^https?:\/\//i.test(value) || /^[\w.-]+:\d+/.test(value);
}

async function openTarget(value: string) {
  const trimmed = value.trim();
  const payload = looksLikeUrl(trimmed) ? { url: trimmed } : { path: trimmed || "index.html" };
  const status = await pageHarnessApi<PageHarnessStatus & { ok: boolean }>("preview", payload);
  setPageHarnessStatus(status);
  setPageHarnessView("page");
  return status;
}

export function PageHarnessPanel() {
  const { status, view, notice, pick } = useSyncExternalStore(subscribePageHarness, getPageHarnessSnapshot, getPageHarnessSnapshot);
  const [servers, setServers] = useState<readonly PageHarnessServer[] | null>(null);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickArmed, setPickArmed] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const frame = frameFor(status);
  const surface = previewSurface({ view, running: status?.running === true, mixed: frame.mixed }) as "list" | "preview" | "mixed";

  useEffect(() => {
    void pageHarnessApi<PageHarnessStatus & { ok: boolean }>("previewStatus").then(setPageHarnessStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (surface !== "list") return;
    let alive = true;
    setServers(null);
    void pageHarnessApi<{ servers: PageHarnessServer[] }>("detect").then((body) => {
      if (alive) setServers(body.servers ?? []);
    }).catch(() => { if (alive) setServers([]); });
    return () => { alive = false; };
  }, [surface]);

  useEffect(() => {
    if (!frame.src) return;
    const onMessage = (event: MessageEvent) => {
      const pane = document.querySelector<HTMLIFrameElement>("iframe.page-harness-panel__frame");
      if (!pane || event.source !== pane.contentWindow) return;
      const data = event.data as { source?: string; type?: string; pick?: PageHarnessPick } | null;
      if (!data || data.source !== "page-harness" || data.type !== "ph:quote" || !data.pick) return;
      setPageHarnessPick(data.pick);
      setPickArmed(false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame.src]);

  const fail = (error: unknown) => setPageHarnessNotice(error instanceof Error ? error.message : "预览没有打开");

  const quote = () => {
    if (!pick) { setPageHarnessNotice("先取点，再引用到对话。"); return; }
    quotePickedElement(pick);
  };

  const saveNote = async () => {
    if (!pick) { setPageHarnessNotice("先取点，再留意见。"); return; }
    try {
      await pageHarnessApi("note", {
        note: noteText,
        selector: pick.selector ?? "",
        label: pick.text || pick.label || pick.tagName || "",
        path: status?.page || "/",
        cwd: pageHarnessSession().cwd,
      });
      setNoteOpen(false);
      setNoteText("");
      setPageHarnessNotice("");
    } catch (error) { fail(error); }
  };

  return (
    <section className="page-harness-panel" aria-label="开发预览">
      {surface === "list" ? (
        <div className="page-harness-panel__list">
          <strong>本机服务</strong>
          <p className="page-harness-panel__hint">只列出正在返回网页的端口。工作台和预览端口不会出现在这里。</p>
          {servers === null ? <p className="page-harness-panel__hint">正在查找本机的 dev server…</p> : null}
          {servers?.length === 0 ? <p className="page-harness-panel__hint">没有发现运行中的 dev server。</p> : null}
          {servers?.map((server) => (
            <div className="page-harness-panel__server" key={server.port}>
              <div>
                <b>{server.port}{server.title ? ` · ${server.title}` : ""}</b>
                <small>{server.url}</small>
              </div>
              <button type="button" disabled={busy} onClick={() => { setBusy(true); void openTarget(server.url).catch(fail).finally(() => setBusy(false)); }}>预览</button>
            </div>
          ))}
          <form className="page-harness-panel__manual" onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            void openTarget(manual).catch(fail).finally(() => setBusy(false));
          }}>
            <input aria-label="预览目标" placeholder="端口、URL 或 index.html" value={manual} onChange={(event) => setManual(event.target.value)} />
            <button type="submit" disabled={busy}>打开</button>
          </form>
          {notice ? <p className="page-harness-panel__notice" role="status">{notice}</p> : null}
        </div>
      ) : (
        <>
          <div className="page-harness-panel__bar">
            <span className="page-harness-panel__name" title={status?.label || ""}>{status?.label || "预览"}</span>
            <button type="button" className="page-harness-panel__action" aria-pressed={pickArmed} onClick={() => {
              const next = !pickArmed;
              setPickArmed(next);
              const pane = document.querySelector<HTMLIFrameElement>("iframe.page-harness-panel__frame");
              const origin = (() => { try { return new URL(frame.src).origin; } catch { return ""; } })();
              if (pane?.contentWindow && origin) pane.contentWindow.postMessage({ source: "page-harness-host", type: "ph:pick", on: next }, origin);
            }}>取点</button>
            <button type="button" className={`page-harness-panel__action${pick ? " is-ready" : ""}`} disabled={!pick} onClick={quote}>引用</button>
            <button type="button" className={`page-harness-panel__action${pick ? " is-ready" : ""}`} disabled={!pick} onClick={() => { if (!pick) { setPageHarnessNotice("先取点，再留意见。"); return; } setNoteOpen(true); }}>意见</button>
          </div>
          {notice ? <p className="page-harness-panel__notice" role="status">{notice}</p> : null}
          {surface === "mixed" ? <p className="page-harness-panel__notice" role="status">{MIXED_CONTENT_MESSAGE}</p> : (
            <iframe
              key={`${status?.rev ?? 0}:${status?.label ?? ""}`}
              className="page-harness-panel__frame"
              title={status?.label || "预览"}
              src={frame.src}
              allow="clipboard-read; clipboard-write"
              onLoad={(event) => {
                const origin = (() => { try { return new URL(frame.src).origin; } catch { return ""; } })();
                if (origin) event.currentTarget.contentWindow?.postMessage({ source: "page-harness-host", type: "ph:hello" }, origin);
              }}
            />
          )}
          {noteOpen ? (
            <form className="page-harness-note" onSubmit={(event) => { event.preventDefault(); void saveNote(); }}>
              <b>意见 · {pick?.text || pick?.label || pick?.selector || "元素"}</b>
              <textarea aria-label="意见" value={noteText} onChange={(event) => setNoteText(event.target.value)} />
              <div className="page-harness-note__row">
                <button type="button" onClick={() => setNoteOpen(false)}>取消</button>
                <button type="submit">保存</button>
              </div>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
