import type { ConversationSchedulesRequestPort } from "@opencraft/appserver-protocol";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "@opencraft/i18n/react";
import { SettingsButton, SettingsGroup, SettingsListItem, SettingsNotice, SettingsPageHeader, SettingsSection } from "@opencraft/extension-react";
import { useScheduledTaskCatalog, type HostScheduleCatalog } from "../runtime/scheduled-task-catalog-context";
import { ConversationSchedulesPanel } from "./conversation-schedules-panel";
import { useAsyncNotices } from "./async-notices";
import { scheduledTasksMessages as messages } from "./scheduled-tasks-messages";
import { projectScheduledTaskRows } from "../runtime/scheduled-task-rows";
import "../styles/scheduled-tasks-page.scss";

/** Read-only application catalog. Schedule writes remain in the existing per-conversation editor. */
export function ScheduledTasksPage() {
  const catalog = useScheduledTaskCatalog();
  const intl = useIntl(), notices = useAsyncNotices();
  const [selected, select] = useState<{ hostId: string; threadId: string; scope: string; port: ConversationSchedulesRequestPort } | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const text = (key: keyof typeof messages) => intl.formatMessage(messages[key]);
  const source = selected && catalog.scheduleCatalogs.find(host => host.hostId === selected.hostId && host.scope === selected.scope);
  const rows = projectScheduledTaskRows(catalog.scheduleCatalogs, catalog.threads);
  const errors = catalog.scheduleCatalogs.filter(host => host.phase === "error").map(host => host.scope).join("|");
  useEffect(() => {
    if (errors || catalog.discovery === "error") notices.error({ key: "schedule-catalog-read", message: intl.formatMessage(messages.loadError) });
  }, [errors, catalog.discovery, notices, intl]);
  const issue = (host: HostScheduleCatalog) => host.phase === "offline" ? "offline" : "loading";
  const openConversation = async (hostId: string, threadId: string) => {
    try { if (!await catalog.openConversation(hostId, threadId)) throw new Error("Navigation not committed"); }
    catch { notices.error({ key: "schedule-catalog-navigation", message: text("openError") }); }
  };
  return <section className="scheduled-tasks-page" aria-label={text("title")}>
    <div className="scheduled-tasks-page__header">
      <SettingsPageHeader title={text("title")} description={text("description")} />
      <SettingsButton disabled={catalog.discovery === "loading"} onClick={() => void Promise.allSettled([catalog.retryDiscovery(), ...catalog.scheduleCatalogs.map(host => host.retry())])}>{text("refresh")}</SettingsButton>
    </div>
    {catalog.discovery === "loading" ? <SettingsNotice role="status">{text("loading")}</SettingsNotice> : null}
    {catalog.scheduleCatalogs.filter(host => host.phase !== "unsupported").map(host => <SettingsSection key={host.scope} title={host.hostLabel}
      action={<SettingsButton disabled={host.phase === "offline" || host.phase === "loading"} onClick={() => void host.retry()}>{text("refresh")}</SettingsButton>}>
      {host.phase === "offline" || host.phase === "loading" ? <SettingsNotice role="status">{text(issue(host))} {host.cached ? text("cached") : ""}</SettingsNotice> : null}
      <SettingsGroup>{rows.filter(row => row.hostId === host.hostId).map(row => <SettingsListItem key={row.threadId}
        label={row.title} description={row.needsReview ? text("review") : row.status === "paused" ? text("paused") : row.status === "active" ? text("active") : text("completed")}
        metadata={row.status === "active" && !row.needsReview ? intl.formatMessage(messages.next, { time: intl.formatDate(row.nextRunAt, { dateStyle: "medium", timeStyle: "short" }) }) : undefined}
        actions={<div className="scheduled-tasks-page__actions">
          <SettingsButton disabled={!host.port} onClick={() => void openConversation(row.hostId, row.threadId)}>{text("conversation")}</SettingsButton>
          <SettingsButton disabled={!host.port} onClick={event => { if (!host.port) return; returnFocus.current = event.currentTarget; select({ hostId: row.hostId, threadId: row.threadId, scope: host.scope, port: host.port }); }}>{text("manage")}</SettingsButton>
        </div>} />)}</SettingsGroup>
      {host.phase === "ready" && host.schedules.length === 0 ? <SettingsNotice>{text("empty")}</SettingsNotice> : null}
    </SettingsSection>)}
    {catalog.discovery === null && catalog.scheduleCatalogs.every(host => host.phase === "unsupported") ? <SettingsNotice>{text("unsupported")}</SettingsNotice> : null}
    {selected && source ? <ConversationSchedulesPanel key={`${selected.scope}:${selected.threadId}`} hostId={selected.hostId} threadId={selected.threadId} scope={selected.scope}
      onClose={() => select(null)} returnFocus={() => returnFocus.current} port={selected.port} /> : null}
  </section>;
}
