import { useEffect, useState } from "react";
import {
  SettingsActions,
  SettingsButton,
  SettingsGroup,
  SettingsListItem,
  SettingsNotice,
} from "@opencraft/extension-react";
import { ImClient } from "./client";
export function ImSources({
  fetcher,
  hostId,
  threadId,
  onOpenSettings,
  reportError,
}: {
  fetcher: typeof fetch;
  hostId: string;
  threadId: string;
  onOpenSettings(): void;
  reportError(message: string): void;
}) {
  const [sources, setSources] = useState<
      | {
          channelId: string;
          name: string;
          provider: string;
          source: { chatId: string; threadId?: string; senderId: string };
          revision: number;
          lastSeen: number;
        }[]
      | null
    >(null),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  const [reference, setReference] = useState("");
  useEffect(() => {
    let active = true;
    setFailed(false);
    setSources(null);
    setReference("");
    void new ImClient(fetcher)
      .request<{
        sources: NonNullable<typeof sources>;
        reference: string;
      }>({ action: "sources", hostId, threadId })
      .then(
        (value) => {
          if (active) {
            setSources(value.sources);
            setReference(value.reference);
          }
        },
        () => {
          if (active) setFailed(true);
        },
      );
    return () => {
      active = false;
    };
  }, [fetcher, hostId, threadId, retry]);
  return (
    <>
      <p>多个来源进入同一会话时共享上下文；回复回到触发消息的聊天。</p>
      {failed ? (
        <SettingsNotice>
          暂时无法读取来源，当前服务可能不支持这个会话。
          <SettingsButton onClick={() => setRetry((v) => v + 1)}>
            重试
          </SettingsButton>
        </SettingsNotice>
      ) : sources === null ? (
        <SettingsNotice>正在读取来源…</SettingsNotice>
      ) : (
        <SettingsGroup appearance="plain">
          {sources.length ? (
            sources.map((s, i) => (
              <SettingsListItem
                key={i}
                label={s.name + " · " + s.source.chatId}
                description={`${s.provider === "wecom" ? "企业微信" : "Slack"} · v${s.revision} · ${new Date(s.lastSeen).toLocaleString()}`}
                metadata={
                  s.source.threadId ? "话题 " + s.source.threadId : undefined
                }
                actions={
                  <SettingsButton onClick={onOpenSettings}>
                    查看渠道路由
                  </SettingsButton>
                }
              />
            ))
          ) : (
            <SettingsNotice>
              近期消息记录中还没有这个会话的 IM 来源。
            </SettingsNotice>
          )}
        </SettingsGroup>
      )}
      <p>
        让其他聊天进入这里：在渠道路由中选择此会话，或将引用用于自定义函数。
      </p>
      <pre
        className="ui-text--code"
        style={{
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {reference}
      </pre>
      <SettingsActions>
        <SettingsButton
          disabled={!reference}
          onClick={() =>
            void navigator.clipboard
              .writeText(reference)
              .catch(() => reportError("暂时无法复制，请手动选择会话引用。"))
          }
        >
          复制会话引用
        </SettingsButton>
        <SettingsButton variant="primary" onClick={onOpenSettings}>
          选择渠道
        </SettingsButton>
      </SettingsActions>
    </>
  );
}
