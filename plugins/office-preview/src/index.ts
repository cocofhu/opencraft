import type { Context } from "@deepseek-ai/cordis";
export const OfficePreviewPlugin = Object.assign(function OfficePreviewPlugin(ctx: Context) {
  const remove = ctx.filePreviews.register({
    id: "office.readonly", extensions: ["docx", "pptx", "xlsx"],
    async open(input) {
      const { openOfficeDocument } = await import("./office-document");
      input.signal.throwIfAborted();
      return openOfficeDocument(input);
    },
  });
  ctx.effect(() => remove);
}, { inject: ["filePreviews"] });
