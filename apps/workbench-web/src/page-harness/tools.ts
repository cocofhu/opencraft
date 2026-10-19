import type { AppServerClient } from "@opencraft/appserver-client";
import type { DynamicToolCallParams, DynamicToolCallResponse } from "@opencraft/appserver-protocol/generated/v2";
import { renderNotes, renderPreview } from "@opencraft/page-harness-host/shared";
import { openPageHarness, pageHarnessApi, pageHarnessSession, setPageHarnessStatus, type PageHarnessStatus } from "./client";

function textResponse(text: string, success = true): DynamicToolCallResponse {
  return { success, contentItems: [{ type: "inputText", text }] };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function installPageHarnessDynamicToolHandler(
  client: Pick<AppServerClient, "interceptServerRequest">,
): () => void {
  return client.interceptServerRequest(async (request, next) => {
    if (request.method !== "item/tool/call") return next();
    const params = request.params as DynamicToolCallParams;
    if (params.namespace !== "page_harness") return next();
    const args = record(params.arguments) ?? {};
    const cwd = pageHarnessSession().cwd;
    try {
      if (params.tool === "page_harness_preview") {
        const path = typeof args.path === "string" ? args.path : "";
        const url = typeof args.url === "string" ? args.url : "";
        const status = await pageHarnessApi<PageHarnessStatus & { ok?: boolean; error?: string }>("preview", {
          ...(path ? { path } : {}),
          ...(url ? { url } : {}),
          ...(!path && !url ? { path: "index.html" } : {}),
          cwd,
        });
        setPageHarnessStatus(status);
        if (status.running) openPageHarness("page");
        return textResponse(renderPreview(status), status.running !== false || !status.error);
      }
      if (params.tool === "page_harness_notes") {
        const body = await pageHarnessApi<{ text?: string }>("notes", { cwd });
        return textResponse(body.text ?? renderNotes({ project: cwd, items: [] }));
      }
      return next();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return textResponse(message, false);
    }
  });
}
