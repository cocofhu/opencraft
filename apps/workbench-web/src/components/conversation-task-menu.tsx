import { LoadingRingIcon as LoaderCircle, MoreIcon as MoreHorizontal, EditIcon as Pencil } from "@opencraft/design-system-web/action-icons";
import { ConversationSchedulesPanel } from "./conversation-schedules-panel";
import type { ConversationSchedulesRequestPort } from "@opencraft/appserver-protocol";
import { useAsyncNotices } from "./async-notices";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArchiveIcon as Archive, ClockIcon as Clock, ForkIcon as GitFork, InfoIcon as Info, TasksIcon as ListTodo, PinIcon as Pin, PinOffIcon as PinOff } from "@opencraft/design-system-web/action-icons";
import { lazy, Suspense, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TASKS, type TaskDetail, type TasksRequestPort } from "@opencraft/appserver-protocol";
import { useIntl } from "@opencraft/i18n/react";
import {
  SettingsButton, SettingsGroup, SettingsListItem, SettingsNotice,
  SettingsPanel, SettingsSwitch, SettingsTextInput,
} from "@opencraft/extension-react";
import { ModalSurface } from "./modal";
import { ConversationRenameDialog } from "./conversation-rename-dialog";
import { useWorkbenchPresentationRoot } from "./workbench-presentation-root";
import "../styles/context-menu.scss";

const ConversationInformationDialog = lazy(() => import("./conversation-information-dialog"));

interface Props {
  readonly port?: TasksRequestPort;
  readonly schedules?: ConversationSchedulesRequestPort;
  readonly scope: string;
  readonly serverId: string;
  readonly threadId: string;
  readonly verifyConversation: () => Promise<void>;
  readonly onOpenTasks: () => void;
  readonly title?: string;
  readonly pinned?: boolean;
  readonly onRename?: (title: string) => Promise<void>;
  readonly onSetPinned?: (pinned: boolean) => Promise<void>;
  readonly onArchive?: () => Promise<void>;
  readonly onFork?: () => Promise<void>;
  readonly project?: string;
  readonly workspaceDirectory?: string;
}

function belongsTo(task: TaskDetail, target: Pick<Props, "serverId" | "threadId">) {
  return task.conversations.some(link => link.serverId === target.serverId && link.threadId === target.threadId);
}

type TaskProps = Props & { readonly port: TasksRequestPort };

function TaskRelationRow({ task, queryKey, ...target }: TaskProps & {
  task: TaskDetail;
  queryKey: readonly string[];
}) {
  const intl = useIntl();
  const queryClient = useQueryClient();
  const linked = belongsTo(task, target);
  const notices = useAsyncNotices();
  const mutation = useMutation({
    mutationFn: async (attach: boolean) => {
      if (attach) await target.verifyConversation();
      return target.port.request(attach ? TASKS.attach : TASKS.detach, {
        id: task.id, expectedRevision: task.revision, serverId: target.serverId, threadId: target.threadId,
      });
    },
    onError: () => notices.error({ key: `task-relation:${target.scope}:${target.serverId}:${task.id}:${target.threadId}`, detail: task.title,
      message: intl.formatMessage({ id: "tasks.relation.saveError", defaultMessage: "Could not confirm the change. Review the current selection and retry." }) }),
    // The backend owns the result, including commits whose acknowledgement was lost.
    // Never replay a mutation or optimistically replace another task's revision.
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  return <SettingsListItem
    label={task.title}
    aria-busy={mutation.isPending || undefined}
    actions={<SettingsSwitch
      label={task.title}
      checked={linked}
      disabled={mutation.isPending}
      onCheckedChange={checked => mutation.mutate(checked)}
    />}
  />;
}

function TaskPicker(props: TaskProps & { onClose(): void; returnFocus(): HTMLElement | null }) {
  const intl = useIntl();
  const [search, setSearch] = useState("");
  const queryKey = ["opencraft", "tasks", props.scope];
  const query = useQuery({
    queryKey,
    queryFn: () => props.port.request(TASKS.list, {}),
    refetchInterval: 5000,
    retry: false,
  });
  const needle = search.trim().toLocaleLowerCase();
  const tasks = (query.data?.tasks ?? []).filter(task =>
    !needle || `${task.title}\n${task.description}`.toLocaleLowerCase().includes(needle),
  ).sort((a, b) => Number(belongsTo(b, props)) - Number(belongsTo(a, props)));
  const title = intl.formatMessage({ id: "tasks.relation.title", defaultMessage: "Task membership" });
  return <ModalSurface label={title} size="compact" appearance="utility"
    onDismiss={props.onClose} returnFocus={props.returnFocus}>
    <SettingsPanel title={title} footer={<>
      <SettingsButton variant="quiet" onClick={() => { props.onClose(); props.onOpenTasks(); }}>
        {intl.formatMessage({ id: "tasks.relation.openTasks", defaultMessage: "Open tasks" })}
      </SettingsButton>
      <SettingsButton onClick={props.onClose}>{intl.formatMessage({ id: "tasks.relation.close", defaultMessage: "Done" })}</SettingsButton>
    </>}>
      <SettingsNotice>{intl.formatMessage({ id: "tasks.relation.hint", defaultMessage: "Link this conversation to one or more tasks. Changes are saved immediately." })}</SettingsNotice>
      <SettingsTextInput autoFocus value={search} onChange={event => setSearch(event.target.value)}
        aria-label={intl.formatMessage({ id: "tasks.relation.search", defaultMessage: "Search tasks" })}
        placeholder={intl.formatMessage({ id: "tasks.relation.search", defaultMessage: "Search tasks" })} />
      {query.isPending ? <SettingsNotice role="status">{intl.formatMessage({ id: "tasks.relation.loading", defaultMessage: "Loading tasks…" })}</SettingsNotice> : null}
      {query.isError ? <SettingsNotice tone="error" role="alert">
        {intl.formatMessage({ id: "tasks.relation.readError", defaultMessage: "Could not load tasks. Check the connection and retry." })}{" "}
        <SettingsButton disabled={query.isFetching} onClick={() => void query.refetch()}>
          {intl.formatMessage({ id: "tasks.relation.retry", defaultMessage: "Retry" })}
        </SettingsButton>
      </SettingsNotice> : null}
      {query.data && !tasks.length ? <SettingsNotice>
        {needle ? intl.formatMessage({ id: "tasks.relation.noMatches", defaultMessage: "No matching tasks." })
          : intl.formatMessage({ id: "tasks.relation.empty", defaultMessage: "No tasks yet. Create a task to link this conversation." })}
      </SettingsNotice> : null}
      <SettingsGroup aria-label={title}>
        {tasks.map(task => <TaskRelationRow key={task.id} {...props} task={task} queryKey={queryKey} />)}
      </SettingsGroup>
    </SettingsPanel>
  </ModalSurface>;
}

/** The application supplies the confirmed conversation identity and fixed Tasks authority. */
export function ConversationTaskMenu(props: Props) {
  const intl = useIntl();
  const portalContainer = useWorkbenchPresentationRoot();
  const notices = useAsyncNotices();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const modalHandoff = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  const [name, setName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const rename = useMutation({
    onError: () => notices.error({ key: `rename:${props.scope}:${props.serverId}:${props.threadId}`, detail: props.title, message: intl.formatMessage({ id: "chat.rename.failed", defaultMessage: "Could not rename the conversation. Try again." }) }),
    mutationFn: (title: string) => props.onRename!(title),
    onSuccess: () => setRenameOpen(false),
  });
  const pin = useMutation({
    onError: () => notices.error({ key: `pin:${props.scope}:${props.serverId}:${props.threadId}`, detail: props.title, message: intl.formatMessage({ id: "chat.pin.failed", defaultMessage: "Could not update pin. Try again." }) }),
    mutationFn: (value: boolean) => props.onSetPinned!(value),
    onSuccess: () => setMenuOpen(false),
  });
  const archive = useMutation({
    onMutate: target => notices.loading({ key: target.key, detail: target.title,
      message: intl.formatMessage({ id: "chat.archive.pending", defaultMessage: "Archiving conversation…" }) }),
    onError: (_error, target) => notices.error({ key: target.key, detail: target.title,
      message: intl.formatMessage({ id: "tasks.relation.saveError", defaultMessage: "Could not confirm the change. Review the current selection and retry." }) }),
    mutationFn: (target: { key: string; title: string; execute: () => Promise<void> }) => target.execute(),
    retry: false,
    onSuccess: (_result, target) => notices.success({ key: target.key, detail: target.title,
      message: intl.formatMessage({ id: "chat.archive.done", defaultMessage: "Conversation archived" }) }),
  });
  const fork = useMutation({
    onError: () => notices.error({ key: `fork:${props.scope}:${props.serverId}:${props.threadId}`, detail: props.title, message: intl.formatMessage({ id: "chat.fork.unconfirmed", defaultMessage: "Could not confirm the new branch. Check the conversation list before trying again." }) }),
    mutationFn: () => props.onFork!(),
    retry: false,
    onSuccess: () => setMenuOpen(false),
  });
  const busy = pin.isPending || archive.isPending || fork.isPending;
  const label = intl.formatMessage({ id: "tasks.relation.actions", defaultMessage: "Conversation actions" });
  return <>
    <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenu.Trigger asChild>
        <button ref={trigger} type="button" className="chrome-button" aria-label={label} title={label}>
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={portalContainer}>
        <DropdownMenu.Content className="workbench-context-menu" align="end" sideOffset={4}
          onCloseAutoFocus={event => {
            if (modalHandoff.current) { event.preventDefault(); modalHandoff.current = false; }
          }}>
          {props.onRename ? <DropdownMenu.Item disabled={busy} onSelect={() => {
            modalHandoff.current = true; rename.reset(); setName(props.title ?? ""); setRenameOpen(true);
          }}><Pencil size={16} aria-hidden="true" />{intl.formatMessage({ id: "common.rename", defaultMessage: "Rename" })}</DropdownMenu.Item> : null}
          {props.onSetPinned ? <DropdownMenu.Item disabled={busy} onSelect={event => {
            event.preventDefault(); pin.mutate(props.pinned !== true);
          }}>{props.pinned ? <PinOff size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}
            {props.pinned ? intl.formatMessage({ id: "chat.unpin", defaultMessage: "Unpin" }) : intl.formatMessage({ id: "chat.pin", defaultMessage: "Pin" })}
          </DropdownMenu.Item> : null}
          {props.onFork ? <DropdownMenu.Item disabled={busy} aria-busy={fork.isPending || undefined} onSelect={event => {
            event.preventDefault(); fork.mutate();
          }}>
            {fork.isPending ? <LoaderCircle size={16} aria-hidden="true" /> : <GitFork size={16} aria-hidden="true" />}
            {intl.formatMessage({ id: "sidebar.thread.fork", defaultMessage: "Create branch" })}
          </DropdownMenu.Item> : null}
          {props.onArchive ? <DropdownMenu.Item disabled={busy} onSelect={() => {
            setMenuOpen(false);
            archive.mutate({ key: `archive:${props.scope}:${props.serverId}:${props.threadId}`, title: props.title ?? "", execute: props.onArchive! });
          }}><Archive size={16} aria-hidden="true" />{intl.formatMessage({ id: "sidebar.thread.archive", defaultMessage: "Archive" })}</DropdownMenu.Item> : null}
          {props.port && (props.onRename || props.onSetPinned || props.onArchive || props.onFork) ? <DropdownMenu.Separator /> : null}
          {props.port ? <DropdownMenu.Item disabled={busy} onSelect={() => { modalHandoff.current = true; setPickerOpen(true); }}>
            <ListTodo size={16} aria-hidden="true" />{intl.formatMessage({ id: "tasks.relation.title", defaultMessage: "Task membership" })}
          </DropdownMenu.Item> : null}
          {props.schedules ? <DropdownMenu.Item disabled={busy} onSelect={() => { modalHandoff.current = true; setSchedulesOpen(true); }}>
            <Clock size={16} aria-hidden="true" />{intl.formatMessage({ id: "schedules.title", defaultMessage: "Scheduled task" })}
          </DropdownMenu.Item> : null}
          {props.project || props.workspaceDirectory ? <DropdownMenu.Item disabled={busy} onSelect={() => {
            modalHandoff.current = true; setDetailsOpen(true);
          }}><Info size={16} aria-hidden="true" />{intl.formatMessage({ id: "chat.details.title", defaultMessage: "Conversation info" })}</DropdownMenu.Item> : null}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    {renameOpen ? <ConversationRenameDialog value={name} pending={rename.isPending}
      onChange={setName} onSubmit={title => rename.mutate(title)} onDismiss={() => setRenameOpen(false)}
      returnFocus={() => trigger.current} /> : null}
    {detailsOpen ? <Suspense fallback={null}><ConversationInformationDialog project={props.project} workspaceDirectory={props.workspaceDirectory}
      onDismiss={() => setDetailsOpen(false)} returnFocus={() => trigger.current} /></Suspense> : null}
    {schedulesOpen && props.schedules ? <ConversationSchedulesPanel port={props.schedules} scope={props.scope} hostId={props.serverId} threadId={props.threadId} onClose={() => setSchedulesOpen(false)} returnFocus={() => trigger.current} /> : null}
    {pickerOpen && props.port ? <TaskPicker {...props} port={props.port} onClose={() => setPickerOpen(false)} returnFocus={() => trigger.current} /> : null}
  </>;
}
