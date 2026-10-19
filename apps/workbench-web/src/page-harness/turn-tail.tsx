import { classifyTurn, previewCardTitle } from "@opencraft/page-harness-host/shared";
import type { TimelineTurnView } from "@opencraft/chat-core";
import { useEffect, useState } from "react";
import { askAgentToPreview, openPageHarness, pageHarnessApi, pageHarnessSession, setPageHarnessStatus, type PageHarnessServer, type PageHarnessStatus } from "./client";

function fileName(file: string) {
  return file.split(/[\\/]/).pop() || file;
}

export function PageHarnessTurnTail({ turn }: { readonly turn: TimelineTurnView }) {
  const blocks = turn.frames.flatMap((frame) => frame.blocks);
  const offer = turn.status === "complete" || turn.status === "failed" ? classifyTurn(blocks) : null;
  const offerKey = offer === null ? "" : `${offer.mode}|${offer.previewed ? 1 : 0}|${offer.html.join(",")}|${offer.scripts.join(",")}|${offer.servers.map((server) => server.port).join(",")}`;
  const previewCalls = blocks.filter((block) => block.type === "tool-call" && block.name === "page_harness_preview");
  const [detected, setDetected] = useState<readonly PageHarnessServer[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!offerKey.startsWith("server|0")) return;
    const ports = offerKey.split("|").at(-1)?.split(",").map(Number).filter(Boolean) ?? [];
    let alive = true;
    void pageHarnessApi<{ servers: PageHarnessServer[] }>("detect", { ports }).then((body) => {
      if (alive) setDetected(body.servers ?? []);
    }).catch(() => { if (alive) setDetected([]); });
    return () => { alive = false; };
  }, [offerKey]);

  useEffect(() => {
    if (!offerKey.startsWith("server|0") || detected === null) return;
    const named = offerKey.split("|").at(-1)?.split(",").map(Number).filter(Boolean) ?? [];
    const candidates = named.length ? detected.filter((server) => named.includes(server.port)) : detected;
    if (candidates.length !== 1) return;
    const key = `${turn.turnKey}:${candidates[0]!.url}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* private mode still attempts one open */ }
    void pageHarnessApi<PageHarnessStatus>("preview", { url: candidates[0]!.url, cwd: pageHarnessSession().cwd })
      .then((status) => { setPageHarnessStatus(status); if (status.running) openPageHarness("page"); })
      .catch((cause: Error) => setError(cause.message));
  }, [detected, offerKey, turn.turnKey]);

  if (!offer && previewCalls.length === 0) return null;
  const openFile = (target: string) => {
    setBusy(true);
    setError("");
    void pageHarnessApi<PageHarnessStatus>("preview", looksLikePath(target)
      ? { path: target, cwd: pageHarnessSession().cwd }
      : { url: target, cwd: pageHarnessSession().cwd })
      .then((status) => { setPageHarnessStatus(status); openPageHarness("page"); })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setBusy(false));
  };

  let text = "";
  let action: { label: string; run: () => void } | null = null;
  if (offer?.mode === "html") {
    const name = offer.html.map(fileName).join("、");
    text = `写了网页 ${name}，要在右侧预览吗？`;
    const file = offer.html[0]!;
    action = { label: offer.html.length > 1 ? `在右侧预览 ${fileName(file)}` : "在右侧预览", run: () => openFile(file) };
  } else if (offer?.mode === "script") {
    text = `改了 ${offer.scripts.slice(0, 3).map(fileName).join("、")}，要开启预览吗？`;
    action = {
      label: "启动服务并预览",
      run: () => {
        setError("");
        if (!askAgentToPreview(offer.scripts.slice(0, 3).map(fileName).join(", "))) {
          setError("没能把启动请求发给 Agent。");
        }
      },
    };
  } else if (offer?.mode === "server") {
    const named = offer.servers.map((server) => server.port).filter(Boolean);
    const candidates = detected === null ? [] : named.length ? detected.filter((server) => named.includes(server.port)) : detected;
    if (offer.previewed) text = "已在右侧预览";
    else if (detected === null) text = "检测到启动了服务，正在查找端口…";
    else if (candidates.length === 1) text = `服务已启动 :${candidates[0]!.port}，要在右侧预览吗？`;
    else if (candidates.length > 1) text = "启动了服务，要预览哪一个？";
    else if (named[0]) text = `启动了服务，但 :${named[0]} 还没有响应。`;
    else text = "启动了服务，但没找到它的端口。";
    if (!offer.previewed && candidates[0]) action = { label: `预览 :${candidates[0].port}`, run: () => openFile(candidates[0]!.url) };
  }

  return (
    <div className="page-harness-turn">
      {previewCalls.map((block) => block.type === "tool-call" ? (
        <div className="page-harness-card" key={block.id}>
          <strong>{block.errorMessage ? "预览打开失败" : previewCardTitle({ running: !block.errorMessage, error: block.errorMessage })}</strong>
          {block.errorMessage ? <p>{block.errorMessage}</p> : null}
          <button type="button" onClick={() => openPageHarness("page")}>打开预览</button>
        </div>
      ) : null)}
      {text ? <span>{text}</span> : null}
      {action ? <button type="button" disabled={busy} onClick={action.run}>{busy ? "启动中…" : action.label}</button> : null}
      {error ? <p role="status">{error}</p> : null}
    </div>
  );
}

function looksLikePath(value: string) {
  return !/^\d+(?:[/?#]|$)/.test(value) && !/^https?:\/\//i.test(value) && !/^[\w.-]+:\d+/.test(value);
}
