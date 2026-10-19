import { shortcutLabel, shortcutAria } from "../workbench-shortcuts";
import { createPortal } from "react-dom";
import * as ContextMenu from "@radix-ui/react-context-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ThreadListModeItems } from "./thread-list-mode-menu";
import { AvatarImage, type ThreadBadgeContribution, type ThreadListGroupingContribution, type ThreadListGroupingSnapshot, type ThreadListLabel } from "@opencraft/extension-react";
import { useWorkbenchPresentationRoot } from "./workbench-presentation-root";
// Semantically restored from the r1442 AppShell left-panel ownership model.
import { useIntl } from "@opencraft/i18n/react";
import {
  ChevronDown,
  ListFilter,
  SquarePen,
  UserRound,
  Settings,
  Search,
  Check,
} from "lucide-react";
import type { ServerRouteLocality, ThreadServerOrigin, WorkbenchThread } from "@opencraft/workbench-runtime";
import type {
  SidebarEntity,
  SidebarEntityCreationCommand,
  SidebarLayoutStore,
} from "@opencraft/sidebar-layout";
import type { ReactNode } from "react";
import { SidebarBots, SidebarEntityDndCoordinator } from "./sidebar-bots";
import { ThreadActionModals, threadActionKey, useThreadActionOwner, type ThreadActionCallbacks, type ThreadActionCapabilities } from "./thread-management";
import { SidebarThreadMenuStore, type OpenSidebarThreadMenu, type SidebarThreadMenuKind } from "./sidebar-thread-menu-state";
import { SidebarThreadRowMenu, SidebarThreadBadge } from "./sidebar-thread-menu";
import { sidebarActivityDateHeadings, groupThreadsByTaskFlow, sidebarActivityMetadata } from "../sidebar-activity";
import { NavigationIcon as SidebarContributionIcon, type NavigationAction as SidebarActionItem } from "./shell-navigation/navigation-action";
import { SidebarActivityItem } from "./sidebar-activity-item";
import { SidebarNavigationItem } from "./sidebar-navigation-item";
import { useShellPresentation, useDismissSidebarAfterSelection } from "./shell-presentation";
import type { HostThreadCatalogState } from "../runtime/thread-catalog-query";
import { useUiPreferencesRuntime } from "../runtime/ui-preferences-runtime";
export type { NavigationAction as SidebarActionItem } from "./shell-navigation/navigation-action";

export interface SidebarThread extends WorkbenchThread {
  readonly schedule?: import("@opencraft/appserver-protocol").ConversationScheduleSummary;
  readonly goalActive?: boolean;
  readonly interactionAvailable?: boolean;
  readonly connectionHostId: string;
  readonly connectionHostLabel: string;
  readonly serverOrigin: ThreadServerOrigin;
  readonly serverRouteLocality: ServerRouteLocality;
}

export interface SidebarCatalogItem {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  readonly initiallyCollapsed?: boolean;
  readonly content: ReactNode;
}
import { memo, useEffect, useId, useMemo, useSyncExternalStore, useLayoutEffect, useRef, useState } from "react";

interface SidebarProps {
  threads: readonly SidebarThread[];
  activeHostId: string;
  activeThreadId: string;
  pendingHostId?: string | null;
  pendingThreadId?: string | null;
  primaryActions?: readonly SidebarActionItem[];
  footerActions?: readonly SidebarActionItem[];
  managementNavigation?: ReactNode;
  catalogs?: readonly SidebarCatalogItem[];
  bots?: readonly SidebarEntity[];
  sidebarLayout: SidebarLayoutStore;
  botCreation?: SidebarEntityCreationCommand | null;
  onSelectThread(hostId: string, id: string): void;
  onNewTask(): void;
  onOpenSettings(): void;
  showFooter?: boolean;
  showStart?: boolean;
  searchInDialog?: boolean;
  showNewChat?: boolean;
  threadActions?: ThreadActionCallbacks;
  threadBadge?: ThreadBadgeContribution | null;
  threadListGrouping?: ThreadListGroupingContribution | null;
  threadCapabilities?(hostId: string): ThreadActionCapabilities;
  pendingTitle?(hostId: string, threadId: string): string | null;
  threadCatalogs?: readonly HostThreadCatalogState[];
  onRetryThreadCatalog?(hostId: string): void;
  threadCatalogDiscovery?: "loading" | "error" | null;
  onRetryThreadCatalogDiscovery?(): void;
}


function ExtensionCatalog({ catalog }: { readonly catalog: SidebarCatalogItem }) {
  const [collapsed, setCollapsed] = useState(catalog.initiallyCollapsed ?? false);
  return (
    <section className="sidebar-extension-catalog" aria-label={catalog.title}>
      <button
        className="sidebar-section-heading sidebar-extension-catalog__heading"
        type="button"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        <ChevronDown size={12} className={collapsed ? "is-collapsed" : undefined} />
        <SidebarContributionIcon name={catalog.icon} size={13} />
        <span>{catalog.title}</span>
      </button>
      {collapsed ? null : (
        <div className="sidebar-extension-catalog__content">{catalog.content}</div>
      )}
    </section>
  );
}

const defaultGrouping: ThreadListGroupingSnapshot = { revision: 0, mode: null, modes: [], hideRowBadge: false, notice: null };
const noThreadActions: ThreadActionCallbacks = { onRename: async () => {}, onFork: async () => {}, onArchive: async () => {}, onDelete: async () => {} };
const noSubscribe = () => () => {};
const getDefaultGrouping = () => defaultGrouping;

const PINNED_PAGE_SIZE = 6;
const RECENT_PAGE_SIZE = 10;

function SidebarPagination({ total, visibleCount, pageSize, onChange }: {
  total: number; visibleCount: number; pageSize: number; onChange: (count: number) => void;
}) {
  const intl = useIntl();
  if (total <= pageSize) return null;
  return <div className="sidebar-activity-pagination">
    {visibleCount < total ? <button type="button" className="sidebar-activity-more" onClick={() => onChange(visibleCount + pageSize)}>
      {intl.formatMessage({ id: "sidebar.catalog.showMore", defaultMessage: "Show more" })}
    </button> : null}
    {visibleCount > pageSize ? <button type="button" className="sidebar-activity-more" onClick={() => onChange(pageSize)}>
      {intl.formatMessage({ id: "sidebar.catalog.less", defaultMessage: "Show less" })}
    </button> : null}
  </div>;
}

export const Sidebar = memo(function Sidebar({
  threads,
  activeHostId,
  activeThreadId,
  pendingHostId = null,
  pendingThreadId = null,
  primaryActions = [],
  footerActions = [],
  managementNavigation = null,
  catalogs = [],
  bots = [],
  sidebarLayout,
  botCreation = null,
  onSelectThread,
  onNewTask,
  onOpenSettings,
  showFooter = true,
  showStart = true,
  searchInDialog = false,
  showNewChat = false,
  threadActions,
  threadBadge = null,
  threadListGrouping = null,
  threadCapabilities,
  pendingTitle,
  threadCatalogs = [],
  onRetryThreadCatalog,
  threadCatalogDiscovery = null,
  onRetryThreadCatalogDiscovery,
}: SidebarProps) {
  const intl = useIntl();
  const dismissSidebarAfterSelection = useDismissSidebarAfterSelection();
  const preferences = useUiPreferencesRuntime();
  const serverFilter = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot).values["sidebar.serverFilter"];
  const formatLabel = (label: ThreadListLabel) => typeof label === "string" ? label : intl.formatMessage(label);
  const grouping = useSyncExternalStore(threadListGrouping?.subscribe ?? noSubscribe, threadListGrouping?.getSnapshot ?? getDefaultGrouping);
  const grouped = threadListGrouping !== null && grouping.mode !== null;
  const references = useMemo(() => threads.map(thread => ({ hostId: thread.connectionHostId, threadId: thread.id, updatedAt: thread.updatedAt, pinned: thread.pinned })), [threads]);
  useEffect(() => threadListGrouping?.watch(references), [threadListGrouping, references, grouping.mode, grouping.filter?.enabled]);
  const [displayMenu, setDisplayMenu] = useState<"context" | "dropdown" | null>(null);
  const groupPrefix = useId();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const servers = [...new Map(threads.map(thread => [thread.serverOrigin.serverId, thread.serverOrigin.label])).entries()];
  const server = serverFilter.serverId;
  // A missing catalog is not a request to show other Servers. The saved label
  // is presentation only; the stable Server ID always owns filtering.
  const selectedServer = server ? servers.find(([id]) => id === server) ?? [server, serverFilter.label || server] : null;
  if (selectedServer && !servers.some(([id]) => id === server)) servers.push([server, selectedServer[1]!]);
  const setServer = (serverId: string) => { void preferences.set("sidebar.serverFilter", {
    serverId, label: servers.find(([id]) => id === serverId)?.[1] ?? "",
  }); };
  const scopedThreads = threads.filter(thread => (!server || thread.serverOrigin.serverId === server)
    && thread.title.toLocaleLowerCase(intl.locale).includes(search.trim().toLocaleLowerCase(intl.locale)));
  const scopedKeys = new Set(scopedThreads.map(thread => JSON.stringify([thread.connectionHostId, thread.id])));
  const scopedReferences = references.filter(ref => scopedKeys.has(JSON.stringify([ref.hostId, ref.threadId])));
  const filteredReferences = threadListGrouping?.filterThreads?.(scopedReferences) ?? scopedReferences;
  const filteredKeys = new Set(filteredReferences.map(ref => JSON.stringify([ref.hostId, ref.threadId])));
  const filteredThreads = scopedThreads.filter(thread => filteredKeys.has(JSON.stringify([thread.connectionHostId, thread.id])));
  const toggleSection = (key: string) => setCollapsed(current => {
    const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next;
  });
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const portalContainer = useWorkbenchPresentationRoot();
  const [recentVisibleCount, setRecentVisibleCount] = useState(RECENT_PAGE_SIZE);
  const [pinnedVisibleCount, setPinnedVisibleCount] = useState(PINNED_PAGE_SIZE);
  const [threadMenuStore] = useState(() => new SidebarThreadMenuStore());
  const displayMenuRef = useRef(displayMenu);
  displayMenuRef.current = displayMenu;
  const closeDisplayMenu = () => {
    if (displayMenuRef.current === null) return;
    displayMenuRef.current = null;
    setDisplayMenu(null);
  };
  // Rename/delete dialogs and action feedback outlive row remounts caused by task-flow regrouping.
  const threadActionOwner = useThreadActionOwner(threadActions ?? noThreadActions);
  const modalTargetKey = threadActionOwner.modal ? threadActionKey(threadActionOwner.modal.target) : null;
  useEffect(() => {
    if (modalTargetKey !== null && !threads.some(thread => `${thread.connectionHostId}:${thread.id}` === modalTargetKey)) threadActionOwner.dismiss();
  }, [threads, modalTargetKey]);
  const selectedThreadKey =
    pendingThreadId === null
      ? `${activeHostId}:${activeThreadId}`
      : `${pendingHostId ?? activeHostId}:${pendingThreadId}`;
  useLayoutEffect(() => { threadMenuStore.close(); closeDisplayMenu(); }, [selectedThreadKey, threadBadge, threadListGrouping, grouping.mode]);
  const updateDisplayMenu = (kind: "context" | "dropdown", open: boolean) => {
    if (open) threadMenuStore.close();
    const next = open ? kind : displayMenuRef.current === kind ? null : displayMenuRef.current;
    if (next === displayMenuRef.current) return;
    displayMenuRef.current = next;
    setDisplayMenu(next);
  };
  const updateThreadMenu = (target: OpenSidebarThreadMenu, open: boolean) => {
    if (open && displayMenuRef.current !== null) closeDisplayMenu();
    threadMenuStore.update(target, open);
  };
  const flow = groupThreadsByTaskFlow(filteredThreads);
  const visibleRecent = flow.recent.slice(0, recentVisibleCount);
  const standardGroups = [
    { key: "attention", label: intl.formatMessage({ id: "sidebar.flow.attention", defaultMessage: "Needs your attention" }), threads: flow.attention },
    { key: "pinned", label: intl.formatMessage({ id: "sidebar.flow.pinned", defaultMessage: "Pinned" }), threads: flow.pinned.slice(0, pinnedVisibleCount) },
    { key: "recent", label: intl.formatMessage({ id: "sidebar.flow.recent", defaultMessage: "Recent" }), threads: visibleRecent },
  ].filter(group => group.threads.length > 0);
  const recentDateHeadings = sidebarActivityDateHeadings(visibleRecent, Date.now(), intl.locale);
  const lookup = new Map(threads.map(thread => [JSON.stringify([thread.connectionHostId, thread.id]), thread]));
  const activityGroups: readonly { key: string; label: string; threads: readonly SidebarThread[]; avatarUrl: string | null; collapsed: boolean; collapsible: boolean }[] = grouped
    ? threadListGrouping!.project(filteredReferences).map(group => ({ key: group.id, label: formatLabel(group.label), avatarUrl: group.avatarUrl,
      collapsed: group.collapsed, collapsible: true,
      threads: group.threads.map(ref => lookup.get(JSON.stringify([ref.hostId, ref.threadId]))).filter((thread): thread is SidebarThread => !!thread),
    })) : standardGroups.map(group => ({ ...group, avatarUrl: null, collapsed: collapsed.has(group.key), collapsible: true }));
  const contextModeItems = <ThreadListModeItems contribution={threadListGrouping} snapshot={grouping} kind="context" onSelect={() => { closeDisplayMenu(); threadMenuStore.close(); }} />;
  const catalogLoading = threadCatalogDiscovery === "loading"
    || threadCatalogs.some(catalog => catalog.phase === "loading");
  const feedback = [
    ...(threadCatalogDiscovery === "error" ? [{ key: "discovery", label: null, cachedAt: undefined, retry: onRetryThreadCatalogDiscovery }] : []),
    ...threadCatalogs.filter(catalog => catalog.phase === "error" || catalog.cachedAt !== undefined).map(catalog => ({
      key: `host:${catalog.hostId}`, label: catalog.label,
      cachedAt: catalog.cachedAt,
      retry: onRetryThreadCatalog ? () => onRetryThreadCatalog(catalog.hostId) : undefined,
    })),
  ];
  const visibleKeys = new Set(activityGroups.filter(group => !group.collapsed).flatMap(group => group.threads).map(thread => `${thread.connectionHostId}:${thread.id}`));
  useLayoutEffect(() => {
    const openThreadMenu = threadMenuStore.getSnapshot();
    if (openThreadMenu && (!visibleKeys.has(`${openThreadMenu.hostId}:${openThreadMenu.threadId}`)
      || threads.some(thread => thread.connectionHostId === openThreadMenu.hostId
        && thread.id === openThreadMenu.threadId && thread.interactionAvailable === false))) threadMenuStore.close();
  }, [threads, recentVisibleCount, pinnedVisibleCount, threadMenuStore, grouping.revision, search, server, collapsed]);
  // Task-flow and grouping move the selected row between sections without changing the
  // selection or the thread count; re-check its viewport position whenever its section
  // changes or it reappears (filter, search, collapse). Unrelated rows appearing or
  // collapsing elsewhere must not pull the viewport back to the selection.
  const selectedGroupKey = activityGroups.find(group => group.threads.some(thread => `${thread.connectionHostId}:${thread.id}` === selectedThreadKey))?.key ?? null;
  const selectedVisible = visibleKeys.has(selectedThreadKey);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    const activeThread = container?.querySelector<HTMLElement>(
      ".sidebar-activity-item.is-selected",
    );
    if (container == null || activeThread == null) return;
    const shellColumn = container.closest(".shell-sidebar__column");
    const viewport = shellColumn?.getAttribute("data-navigation-layout") === "mobile"
      ? shellColumn.querySelector<HTMLElement>(".shell-sidebar__scroll") ?? container
      : container.querySelector<HTMLElement>(".sidebar-activity-list") ?? container;
    // Background updates while the shared content is detached/hidden must not
    // overwrite the user's last visible position through automatic selection scroll.
    if (!viewport.isConnected || viewport.clientHeight === 0 || viewport.clientWidth === 0
      || viewport.closest('[inert], [aria-hidden="true"]')) return;
    const containerRect = viewport.getBoundingClientRect();
    const activeRect = activeThread.getBoundingClientRect();
    const stickyStart = shellColumn?.getAttribute("data-navigation-layout") === "mobile"
      ? shellColumn.querySelector<HTMLElement>('[data-action-id="shell.home"]') : null;
    const visibleTop = Math.max(containerRect.top, stickyStart?.getBoundingClientRect().bottom ?? containerRect.top);
    if (
      activeRect.top < visibleTop ||
      activeRect.bottom > containerRect.bottom
    ) {
      activeThread.scrollIntoView({ block: "nearest" });
    }
  }, [selectedThreadKey, selectedGroupKey, selectedVisible]);

  return (
    <SidebarEntityDndCoordinator items={bots} layout={sidebarLayout}>
      <div className="sidebar-panel" data-app-shell-focus-area="left-panel">
      <nav className="sidebar-navigation" aria-label="Primary">
        {showStart ? <SidebarNavigationItem icon={<SidebarContributionIcon name="start" />} title={intl.formatMessage({ id: "sidebar.start", defaultMessage: "Start" })} onInvoke={onNewTask} /> : null}
        {primaryActions.map((action) => (
          <SidebarNavigationItem
            key={action.id}
            active={action.active}
            icon={<SidebarContributionIcon name={action.icon} />}
            title={action.title}
            onInvoke={action.onInvoke}
          />
        ))}
      </nav>

      {managementNavigation}

      <div className="sidebar-content-scroll" ref={scrollContainerRef}>
        <SidebarBots
          items={bots}
          creation={botCreation}
        />

        {catalogs.map((catalog) => (
          <ExtensionCatalog key={catalog.id} catalog={catalog} />
        ))}

        <ContextMenu.Root open={displayMenu === "context"} onOpenChange={open => updateDisplayMenu("context", open)}>
        <ContextMenu.Trigger asChild><section className="sidebar-tasks" aria-label="Tasks" aria-busy={catalogLoading}>
          <div className="sidebar-list-toolbar"><span>{intl.formatMessage({ id: "sidebar.conversations", defaultMessage: "Conversations" })}</span>
            <DropdownMenu.Root open={displayMenu === "dropdown"} onOpenChange={open => updateDisplayMenu("dropdown", open)}><DropdownMenu.Trigger asChild><button type="button" className="sidebar-list-mode-trigger" data-filter-active={Boolean(server || grouping.filter?.enabled)} aria-label={intl.formatMessage({ id: "sidebar.filters", defaultMessage: "Filters" })} title={[intl.formatMessage({ id: "sidebar.filters", defaultMessage: "Filters" }), ...(grouping.filter?.enabled ? [formatLabel(grouping.filter.label)] : []), selectedServer?.[1] ?? intl.formatMessage({ id: "sidebar.allServers", defaultMessage: "All servers" })].join(" · ")} ><ListFilter size={14} aria-hidden="true" /></button></DropdownMenu.Trigger>
              <DropdownMenu.Portal container={portalContainer}><DropdownMenu.Content className="workbench-context-menu" sideOffset={5} align="end"><ThreadListModeItems contribution={threadListGrouping} snapshot={grouping} kind="dropdown" />
                <DropdownMenu.Separator />
                <DropdownMenu.Label className="sidebar-display-mode-label">{intl.formatMessage({ id: "sidebar.serverFilter", defaultMessage: "Filter by server" })}</DropdownMenu.Label>
                <DropdownMenu.RadioGroup value={server} onValueChange={setServer}>
                  {[["", intl.formatMessage({ id: "sidebar.allServers", defaultMessage: "All servers" })], ...servers].map(([id, label]) => <DropdownMenu.RadioItem className="sidebar-list-mode-item" key={id} value={id!}>
                    <DropdownMenu.ItemIndicator className="sidebar-list-mode-indicator"><Check size={13} aria-hidden="true" /></DropdownMenu.ItemIndicator><span className="sidebar-list-mode-text">{label}</span>
                  </DropdownMenu.RadioItem>)}
                </DropdownMenu.RadioGroup>
              </DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
          {showNewChat ? <SidebarNewChatButton onNewTask={onNewTask} /> : null}
          {searchInDialog ? null : <label className="sidebar-list-search"><Search size={14} aria-hidden="true" /><input type="search"
            aria-label={intl.formatMessage({ id: "sidebar.search", defaultMessage: "Search conversations" })}
            placeholder={intl.formatMessage({ id: "sidebar.search", defaultMessage: "Search conversations" })}
            value={search} onChange={event => setSearch(event.target.value)} /></label>}
          {grouping.notice ? <div className="sidebar-catalog-feedback" role="status">{formatLabel(grouping.notice)}</div> : null}
          {threadCatalogs.some(catalog => catalog.partial && catalog.phase === "loading") ? <div className="sidebar-catalog-feedback" role="status">{intl.formatMessage({ id: "sidebar.search.loading", defaultMessage: "Loading conversations…" })}</div> : null}
          {feedback.map(catalog => (
            <div className="sidebar-catalog-feedback" key={catalog.key} role="status">
                <span className="sidebar-catalog-feedback__message" title={catalog.label ?? undefined}>{catalog.label === null
                  ? intl.formatMessage({ id: "sidebar.catalog.discoveryError", defaultMessage: "Couldn't load remote connections" })
                  : catalog.cachedAt !== undefined
                    ? intl.formatMessage({ id: "sidebar.catalog.cached", defaultMessage: "Showing saved {server} conversations; refresh failed" }, { server: catalog.label })
                    : intl.formatMessage({ id: "sidebar.catalog.error", defaultMessage: "Couldn't load {server} conversations" }, { server: catalog.label })}</span>
                <button type="button" className="sidebar-catalog-feedback__retry" onClick={catalog.retry} disabled={!catalog.retry}>
                  {intl.formatMessage({ id: "sidebar.catalog.retry", defaultMessage: "Retry" })}
                </button>
            </div>
          ))}
          {activityGroups.length === 0 && feedback.length === 0 && !catalogLoading ? <div className="sidebar-activity-empty">{intl.formatMessage({ id: "sidebar.empty", defaultMessage: "No tasks yet" })}</div> : null}
          <div className="sidebar-activity-list">
            {activityGroups.map(group => (
              <section className="sidebar-activity-group" key={group.key} aria-label={group.label} data-collapsed={group.collapsed}>
                {group.collapsible ? <h2 className="sidebar-activity-group__heading sidebar-thread-group-heading"><button type="button" className="sidebar-thread-group-toggle" aria-expanded={!group.collapsed} aria-controls={`${groupPrefix}-${encodeURIComponent(group.key)}`} onClick={() => grouped ? threadListGrouping!.toggleGroup(group.key) : toggleSection(group.key)}>
                  {grouped ? <span className="sidebar-thread-group-avatar" aria-hidden="true"><AvatarImage src={group.avatarUrl} fallback={<UserRound size={12} />} /></span> : null}<span className="sidebar-thread-group-label">{group.label}</span><ChevronDown size={12} className={group.collapsed ? "is-collapsed" : undefined} aria-hidden="true" />
                </button></h2> : <h2 className="sidebar-activity-group__heading">{group.label}</h2>}
                <div className="sidebar-activity-group__items" id={group.collapsible ? `${groupPrefix}-${encodeURIComponent(group.key)}` : undefined} hidden={group.collapsed}>
                  {!group.collapsed && group.threads.map((thread) => {
                    const threadKey = `${thread.connectionHostId}:${thread.id}`;
                    const active =
                      thread.connectionHostId === activeHostId && thread.id === activeThreadId;
                    const pending =
                      thread.connectionHostId === pendingHostId && thread.id === pendingThreadId;
                    const selected = threadKey === selectedThreadKey;
                    const title = pendingTitle?.(thread.connectionHostId, thread.id) ?? thread.title;
                    const metadata = sidebarActivityMetadata(thread);
                    const dateHeading = !grouped && group.key === "recent" ? recentDateHeadings.get(thread) : undefined;
                    const activityId = `${groupPrefix}-${encodeURIComponent(threadKey)}-activity`;
                    const button = <SidebarActivityItem
                      activityId={activityId}
                      key={threadKey}
                      twoLine={!grouped && group.key === "attention"}
                      active={active}
                      disabled={thread.interactionAvailable === false}
                      onInvoke={() => {
                        threadMenuStore.close();
                        onSelectThread(thread.connectionHostId, thread.id);
                        dismissSidebarAfterSelection?.();
                      }}
                      pending={pending}
                      project={metadata.project}
                      selected={selected}
                      status={thread.status}
                      goalActive={thread.goalActive}
                      schedule={thread.schedule}
                      title={title}
                      tooltip={`${title} · ${metadata.project} · ${thread.serverOrigin.label} · ${thread.id}`}
                      unread={thread.unread === true && (threadListGrouping?.isParticipant?.({
                        hostId: thread.connectionHostId, threadId: thread.id, updatedAt: thread.updatedAt,
                      }) ?? true)}
                      badgePlacement={grouped && grouping.hideRowBadge ? undefined : threadBadge?.placement}
                      badge={threadBadge && !(grouped && grouping.hideRowBadge) ? <SidebarThreadBadge store={threadMenuStore} contribution={threadBadge} hostId={thread.connectionHostId} threadId={thread.id}
                        portalContainer={portalContainer}
                        onCloseAutoFocus={event => {
                          const current = threadMenuStore.getSnapshot();
                          if (current && !(current.kind === "badge" && current.hostId === thread.connectionHostId && current.threadId === thread.id)) event.preventDefault();
                        }}
                        onOpenChange={open => {
                          if (!open || thread.interactionAvailable !== false) updateThreadMenu({ hostId: thread.connectionHostId, threadId: thread.id, kind: "badge" }, open);
                        }}
                      /> : null}
                    />;
                    const row = threadActions && threadCapabilities ? (
                      <SidebarThreadRowMenu
                        store={threadMenuStore}
                        activityLabelId={activityId}
                        key={threadKey}
                        target={{ hostId: thread.connectionHostId, threadId: thread.id, title, pinned: thread.pinned }}
                        capabilities={threadCapabilities(thread.connectionHostId)}
                        disabled={thread.interactionAvailable === false}
                        onCloseAutoFocus={event => {
                          const current = threadMenuStore.getSnapshot();
                          if (current && (current.kind === "badge" || current.hostId !== thread.connectionHostId || current.threadId !== thread.id)) event.preventDefault();
                        }}
                        onOpenMenuChange={(kind: SidebarThreadMenuKind, open) => updateThreadMenu(
                          { hostId: thread.connectionHostId, threadId: thread.id, kind }, open)}
                        contextMenuExtra={threadListGrouping ? contextModeItems : null}
                        owner={threadActionOwner}
                      >
                        {button}
                      </SidebarThreadRowMenu>
                    ) : <div className="sidebar-activity-row" data-has-menu="false">{button}</div>;
                    return <div key={threadKey}>{dateHeading ? <div className="sidebar-activity-date">{dateHeading}</div> : null}{row}</div>;
                  })}
                  {!grouped && !group.collapsed && group.key === "pinned" ? <SidebarPagination total={flow.pinned.length} visibleCount={pinnedVisibleCount} pageSize={PINNED_PAGE_SIZE} onChange={setPinnedVisibleCount} /> : null}
                  {!grouped && !group.collapsed && group.key === "recent" ? <SidebarPagination total={flow.recent.length} visibleCount={recentVisibleCount} pageSize={RECENT_PAGE_SIZE} onChange={setRecentVisibleCount} /> : null}
                </div>
              </section>
            ))}
            {threadActions && threadCapabilities ? <ThreadActionModals owner={threadActionOwner} /> : null}
          </div>
        </section></ContextMenu.Trigger>
        <ContextMenu.Portal container={portalContainer}><ContextMenu.Content className="workbench-context-menu">{contextModeItems}</ContextMenu.Content></ContextMenu.Portal>
        </ContextMenu.Root>
      </div>

      {showFooter ? <div className="sidebar-panel__footer">
        {footerActions.map((action) => (
          <SidebarNavigationItem
            key={action.id}
            active={action.active}
            icon={<SidebarContributionIcon name={action.icon} />}
            title={action.title}
            onInvoke={action.onInvoke}
          />
        ))}
          <SidebarNavigationItem icon={<Settings size={15} />} title={intl.formatMessage({ id: "settings.title", defaultMessage: "Settings" })} onInvoke={onOpenSettings} />
      </div> : null}
      </div>
    </SidebarEntityDndCoordinator>
  );
});

/** Only this small control follows the Shell's transient action host. */
function SidebarNewChatButton({ onNewTask }: { onNewTask(): void }) {
  const intl = useIntl();
  const shell = useShellPresentation();
  const button = <button type="button" className="sidebar-new-chat" title={`${intl.formatMessage({ id: "sidebar.newChat", defaultMessage: "New chat" })} (${shortcutLabel("newChat")})`} aria-keyshortcuts={shortcutAria("newChat")} onClick={() => {
    onNewTask();
    shell?.dismissSidebarAfterSelection();
  }}><SquarePen size={16} aria-hidden="true" /><span>{intl.formatMessage({ id: "sidebar.newChat", defaultMessage: "New chat" })}</span></button>;

  return shell?.mobileSidebar
    ? shell.sidebarActionHost ? createPortal(button, shell.sidebarActionHost) : null
    : button;
}
