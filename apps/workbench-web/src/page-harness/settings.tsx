import { SettingsButton, SettingsNotice, SettingsPageHeader, SettingsSection } from "@opencraft/extension-react";
import { useEffect, useState } from "react";
import { pageHarnessApi, type PageHarnessSettings } from "./client";

export function PageHarnessSettingsPage() {
  const [previewPort, setPreviewPort] = useState("17994");
  const [cliPath, setCliPath] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void pageHarnessApi<{ settings: PageHarnessSettings }>("settings").then((body) => {
      setPreviewPort(String(body.settings.previewPort));
      setCliPath(body.settings.cliPath);
    }).catch((cause: Error) => setError(cause.message));
  }, []);

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      setError("");
      setNotice("");
      void pageHarnessApi<{ settings: PageHarnessSettings }>("saveSettings", {
        previewPort: Number(previewPort),
        cliPath,
      }).then(() => setNotice("已保存。重新打开预览后生效。")).catch((cause: Error) => setError(cause.message));
    }}>
      <SettingsPageHeader title="page-harness" description="右栏预览使用这些值。CLI 路径留空时自动查找已安装的 page-harness。" />
      <SettingsSection title="预览">
        <label>
          预览端口
          <input aria-label="预览端口" inputMode="numeric" value={previewPort} onChange={(event) => setPreviewPort(event.target.value)} />
          <small>控制端口为它 + 1。默认 17994。</small>
        </label>
        <label>
          CLI 路径
          <input aria-label="CLI 路径" placeholder="留空自动查找" value={cliPath} onChange={(event) => setCliPath(event.target.value)} />
        </label>
        <div className="page-harness-settings__actions">
          <SettingsButton type="submit" variant="primary">保存</SettingsButton>
        </div>
      </SettingsSection>
      {notice ? <SettingsNotice>{notice}</SettingsNotice> : null}
      {error ? <SettingsNotice tone="error">{error}</SettingsNotice> : null}
      <SettingsNotice>工作台是 HTTPS 时不能嵌入 HTTP 预览。</SettingsNotice>
    </form>
  );
}
