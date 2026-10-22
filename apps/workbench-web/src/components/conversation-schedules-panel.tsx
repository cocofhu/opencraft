import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CONVERSATION_SCHEDULES as METHODS, type ConversationSchedule, type ConversationSchedulesRequestPort, type ConversationScheduleRun } from "@opencraft/appserver-protocol";
import { useIntl } from "@opencraft/i18n/react";
import { SettingsButton, SettingsPanel, SettingsNotice, SettingsListItem, SettingsTextInput, SettingsSelect } from "@opencraft/extension-react";
import { useAsyncNotices } from "./async-notices";
import { ModalSurface } from "./modal";
import "../styles/conversation-schedules.scss";

const messages = {
  title: { id: "schedules.title", defaultMessage: "Scheduled task" },
  create: { id: "schedules.create", defaultMessage: "Create a schedule" },
  edit: { id: "schedules.edit", defaultMessage: "Edit" },
  empty: { id: "schedules.empty", defaultMessage: "Schedule a prompt to run in this conversation." },
  hint: { id: "schedules.hint", defaultMessage: "Runs on the server, even after you close this page. Waits while the conversation is busy." },
  permissions: { id: "schedules.permissions", defaultMessage: "Permissions" },
  defaultPermissions: { id: "schedules.permissions.default", defaultMessage: "Use conversation defaults" },
  fullAccessHint: { id: "schedules.permissions.fullHint", defaultMessage: "Full access allows this task to run commands and access files outside the workspace without approval." },
  prompt: { id: "schedules.prompt", defaultMessage: "What should it do?" },
  when: { id: "schedules.when", defaultMessage: "First run" },
  repeat: { id: "schedules.repeat", defaultMessage: "Repeat" },
  once: { id: "schedules.once", defaultMessage: "Once" },
  interval: { id: "schedules.interval", defaultMessage: "Every N minutes" },
  minutes: { id: "schedules.minutes", defaultMessage: "Interval in minutes" },
  zone: { id: "schedules.zone", defaultMessage: "Time zone" },
  save: { id: "schedules.save", defaultMessage: "Save" },
  cancel: { id: "schedules.cancel", defaultMessage: "Cancel" },
  close: { id: "schedules.close", defaultMessage: "Done" },
  pause: { id: "schedules.pause", defaultMessage: "Pause" },
  resume: { id: "schedules.resume", defaultMessage: "Resume" },
  remove: { id: "schedules.remove", defaultMessage: "Delete" },
  now: { id: "schedules.now", defaultMessage: "Run now" },
  history: { id: "schedules.history", defaultMessage: "Recent runs" },
  error: { id: "schedules.error", defaultMessage: "Could not confirm the change. Reload the schedule before trying again." },
  loadError: { id: "schedules.loadError", defaultMessage: "Could not load the schedule." },
  retry: { id: "schedules.retry", defaultMessage: "Retry" },
  loading: { id: "schedules.loading", defaultMessage: "Loading…" },
  pendingHint: { id: "schedules.pendingHint", defaultMessage: "Pausing or deleting stops future runs. A task already submitted can continue; stop it in the conversation if needed." },
  unknownHint: { id: "schedules.unknownHint", defaultMessage: "Could not confirm whether the task ran. Automatic retries are stopped. Review the conversation before scheduling another task." },
  active: { id: "schedules.active", defaultMessage: "Scheduled" },
  paused: { id: "schedules.paused", defaultMessage: "Paused" },
  completed: { id: "schedules.completed", defaultMessage: "Completed" },
  deleted: { id: "schedules.deleted", defaultMessage: "Deleted" },
  waiting: { id: "schedules.waiting", defaultMessage: "Waiting for the conversation" },
  submitting: { id: "schedules.submitting", defaultMessage: "Confirming submission" },
  running: { id: "schedules.running", defaultMessage: "Running" },
  failed: { id: "schedules.failed", defaultMessage: "Stopped or failed" },
  review: { id: "schedules.review", defaultMessage: "Reviewed — stop tracking this run" },
  reviewed: { id: "schedules.reviewed", defaultMessage: "Reviewed; outcome not confirmed" },
  every: { id: "schedules.every", defaultMessage: "Every {minutes} minutes" },
  unknown: { id: "schedules.unknown", defaultMessage: "Needs review" },
} as const;
function localDate(value: number) {
  const date = new Date(value);
  return new Date(value - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
interface Draft { permissions: string; prompt: string; when: string; minutes: string; repeating: boolean; revision: number; }
function draftFor(plan: ConversationSchedule | null): Draft {
  return { permissions: plan?.permissions ?? "", prompt: plan?.prompt ?? "", when: localDate(plan?.nextRunAt ?? Date.now() + 300000),
    minutes: String(plan?.intervalMinutes ?? 60), repeating: plan?.intervalMinutes != null, revision: plan?.revision ?? 0 };
}
export function ConversationSchedulesPanel(props: {
  port: ConversationSchedulesRequestPort; scope: string; hostId: string; threadId: string;
  onClose(): void; returnFocus(): HTMLElement | null;
}) {
  const intl = useIntl(), notices = useAsyncNotices(), cache = useQueryClient();
  const text = (key: keyof typeof messages) => intl.formatMessage(messages[key]);
  const key = ["conversation-schedules", props.scope, props.hostId, props.threadId];
  const query = useQuery({ queryKey: key, queryFn: () => props.port.request(METHODS.read, { threadId: props.threadId }), retry: false, refetchInterval: 5000 });
  const [draft, setDraft] = useState<Draft | null>(null);
  const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zone = detectedZone && detectedZone !== "Etc/Unknown" ? detectedZone : "UTC";
  const mutation = useMutation({
    mutationFn: async (command: { type: "save"; value: Draft } | { type: "action"; action: "pause" | "resume" | "delete" | "run-now" | "review"; revision: number }) => {
      if (command.type === "save") return props.port.request(METHODS.save, { threadId: props.threadId,
        permissions: command.value.permissions || null, expectedRevision: command.value.revision, prompt: command.value.prompt,
        nextRunAt: new Date(command.value.when).getTime(), intervalMinutes: command.value.repeating ? Number(command.value.minutes) : null, timeZone: zone });
      return props.port.request(METHODS.action, { threadId: props.threadId, expectedRevision: command.revision, action: command.action });
    },
    retry: false,
    onSuccess: data => { cache.setQueryData(key, data); setDraft(null); },
    onError: () => notices.error({ key: `schedules:${props.scope}:${props.hostId}:${props.threadId}`, message: text("error") }),
    onSettled: () => { void cache.invalidateQueries({ queryKey: key }).catch(() => undefined); },
  });
  const plan = query.data?.schedule ?? null, exists = plan && plan.status !== "deleted";
  const profiles = query.data?.permissionProfiles;
  const permissionLabel = (id: string | null | undefined) => profiles?.find(profile => profile.id === id)?.openCraftLabel ?? profiles?.find(profile => profile.id === id)?.id ?? id ?? text("defaultPermissions");
  const inFlight = query.data?.runs.some(run => ["waiting", "submitting", "running", "unknown"].includes(run.state));
  const action = (value: "pause" | "resume" | "delete" | "run-now" | "review") => { if (plan) mutation.mutate({ type: "action", action: value, revision: plan.revision }); };
  const update = (value: Partial<Draft>) => setDraft(prior => prior ? { ...prior, ...value } : prior);
  const stateLabel = (state: ConversationScheduleRun["state"] | ConversationSchedule["status"]) => text(state);
  return <ModalSurface label={text("title")} size="compact" appearance="utility" onDismiss={props.onClose} returnFocus={props.returnFocus}>
    <SettingsPanel title={text("title")} footer={<SettingsButton onClick={props.onClose}>{text("close")}</SettingsButton>}>
      <div className="conversation-schedules">
        <SettingsNotice>{text("hint")}</SettingsNotice>
        {query.isPending ? <SettingsNotice role="status">{text("loading")}</SettingsNotice> : null}
        {query.isError && !query.data ? <SettingsNotice>{text("loadError")} <SettingsButton onClick={() => void query.refetch()}>{text("retry")}</SettingsButton></SettingsNotice> : null}
        {mutation.isPending && !draft ? <SettingsNotice role="status">{intl.formatMessage({ id: "common.operation.pending", defaultMessage: "Applying change…" })}</SettingsNotice> : null}
        {query.data && !draft ? <>
          {exists ? <SettingsListItem label={stateLabel(plan.status)} description={plan.prompt}
            metadata={plan.status === "active" ? `${permissionLabel(plan.permissions)} · ${plan.intervalMinutes ? intl.formatMessage(messages.every, { minutes: plan.intervalMinutes }) : text("once")} · ${new Date(plan.nextRunAt).toLocaleString(intl.locale, { timeZone: plan.timeZone })} · ${plan.timeZone}` : undefined} />
            : <SettingsNotice>{text("empty")}</SettingsNotice>}
          <div className="conversation-schedules__actions">
            <SettingsButton disabled={mutation.isPending || inFlight} onClick={() => setDraft(draftFor(plan))}>{text(exists ? "edit" : "create")}</SettingsButton>
            {exists ? <>
              {plan.status === "active" ? <SettingsButton disabled={mutation.isPending} onClick={() => action("pause")}>{text("pause")}</SettingsButton> : <SettingsButton disabled={mutation.isPending || inFlight} onClick={() => action("resume")}>{text("resume")}</SettingsButton>}
              <SettingsButton disabled={mutation.isPending || inFlight || plan.status !== "active"} onClick={() => action("run-now")}>{text("now")}</SettingsButton>
              <SettingsButton disabled={mutation.isPending} onClick={() => action("delete")}>{text("remove")}</SettingsButton>
            </> : null}
          </div>
        </> : null}
        {draft ? <form className="conversation-schedules__form" onSubmit={event => { event.preventDefault(); if (!mutation.isPending) mutation.mutate({ type: "save", value: draft }); }}>
          <label>{text("prompt")}<textarea aria-label={text("prompt")} className="settings-control-input" required maxLength={32000} rows={4} value={draft.prompt} disabled={mutation.isPending} onChange={event => update({ prompt: event.target.value })} /></label>
          {profiles ? <label>{text("permissions")}<SettingsSelect aria-label={text("permissions")} value={draft.permissions} disabled={mutation.isPending} onChange={event => update({ permissions: event.target.value })}>
            <option value="">{text("defaultPermissions")}</option>
            {draft.permissions && !profiles.some(profile => profile.id === draft.permissions) ? <option value={draft.permissions} disabled>{draft.permissions}</option> : null}
            {profiles.map(profile => <option key={profile.id} value={profile.id} disabled={!profile.allowed}>{profile.openCraftLabel ?? profile.id}</option>)}
          </SettingsSelect></label> : null}
          {profiles?.find(profile => profile.id === draft.permissions)?.openCraftMode === "full" ? <SettingsNotice>{text("fullAccessHint")}</SettingsNotice> : null}
          <label>{text("when")}<SettingsTextInput aria-label={text("when")} type="datetime-local" required value={draft.when} disabled={mutation.isPending} onChange={event => update({ when: event.target.value })} /></label>
          <SettingsNotice>{text("zone")}: {zone}</SettingsNotice>
          <label>{text("repeat")}<SettingsSelect aria-label={text("repeat")} value={draft.repeating ? "repeat" : "once"} disabled={mutation.isPending} onChange={event => update({ repeating: event.target.value === "repeat" })}>
            <option value="once">{text("once")}</option><option value="repeat">{text("interval")}</option>
          </SettingsSelect></label>
          {draft.repeating ? <label>{text("minutes")}<SettingsTextInput aria-label={text("minutes")} type="number" min={1} max={525600} required value={draft.minutes} disabled={mutation.isPending} onChange={event => update({ minutes: event.target.value })} /></label> : null}
          <div className="conversation-schedules__actions"><SettingsButton type="button" disabled={mutation.isPending} onClick={() => setDraft(null)}>{text("cancel")}</SettingsButton><SettingsButton type="submit" variant="primary" loading={mutation.isPending}>{mutation.isPending ? intl.formatMessage({ id: "sidebar.thread.saving", defaultMessage: "Saving…" }) : text("save")}</SettingsButton></div>
        </form> : null}
        {inFlight ? <SettingsNotice>{text("pendingHint")}</SettingsNotice> : null}
        {query.data?.runs.some(run => run.state === "unknown") ? <SettingsNotice>{text("unknownHint")} <SettingsButton disabled={mutation.isPending} onClick={() => action("review")}>{text("review")}</SettingsButton></SettingsNotice> : null}
        {query.data?.runs.length ? <section aria-label={text("history")}><h3>{text("history")}</h3>{query.data.runs.map(run => <SettingsListItem key={run.id} label={stateLabel(run.state)} description={new Date(run.scheduledAt).toLocaleString(intl.locale)} />)}</section> : null}
      </div>
    </SettingsPanel>
  </ModalSurface>;
}
