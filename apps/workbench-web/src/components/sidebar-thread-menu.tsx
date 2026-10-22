import { Root as DropdownMenuRoot } from "@radix-ui/react-dropdown-menu";
import { useCallback, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import type { ThreadBadgeContribution, ThreadBadgeProps } from "@opencraft/extension-react";
import { ThreadRowMenu } from "./thread-management";
import { SidebarThreadMenuStore, type OpenSidebarThreadMenu } from "./sidebar-thread-menu-state";

type Target = Pick<OpenSidebarThreadMenu, "hostId" | "threadId">;
function useRowMenu(store: SidebarThreadMenuStore, { hostId, threadId }: Target) {
  const subscribe = useCallback((listener: () => void) => store.subscribe({ hostId, threadId }, listener), [store, hostId, threadId]);
  const snapshot = useCallback(() => store.getKind({ hostId, threadId }), [store, hostId, threadId]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function SidebarThreadRowMenu({ store, ...props }: Omit<ComponentProps<typeof ThreadRowMenu>, "openMenuKind"> & { store: SidebarThreadMenuStore }) {
  const kind = useRowMenu(store, props.target);
  return <ThreadRowMenu {...props} openMenuKind={kind === "badge" ? null : kind} />;
}

export function SidebarThreadBadge({ store, contribution, ...props }: Omit<ThreadBadgeProps, "open"> & { store: SidebarThreadMenuStore; contribution: ThreadBadgeContribution }) {
  const kind = useRowMenu(store, props);
  return <contribution.Component {...props} open={kind === "badge"} />;
}

/** The list-level menu subscribes without rebuilding the conversation list. */
export function SidebarFiltersMenu({ store, children }: { store: SidebarThreadMenuStore; children: ReactNode }) {
  const open = useSyncExternalStore(store.subscribeFilters, store.getFiltersOpen, store.getFiltersOpen);
  return <DropdownMenuRoot open={open} onOpenChange={store.setFiltersOpen}>{children}</DropdownMenuRoot>;
}
