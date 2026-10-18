import type { IntlShape } from "@opencraft/i18n";
import type { NavigationAction } from "./navigation-action";

// Renderer-owned presentation of the built-in destinations. Stable contribution
// IDs select copy; extension titles remain the fallback for unknown destinations.
const labels = {
  "shell.home": { full: { id: "navigation.home", defaultMessage: "Home" }, short: { id: "navigation.home", defaultMessage: "Home" } },
  "shell.start": { full: { id: "sidebar.rail.start", defaultMessage: "Start" }, short: { id: "sidebar.rail.start.short", defaultMessage: "Start" } },
  "shell.chat": { full: { id: "sidebar.rail.chat", defaultMessage: "Chats" }, short: { id: "sidebar.rail.chat.short", defaultMessage: "Chats" } },
  "opencraft.tasks.navigation": { full: { id: "sidebar.rail.tasks", defaultMessage: "Tasks" }, short: { id: "sidebar.rail.tasks.short", defaultMessage: "Tasks" } },
  "lightvela.collaboration.workspace": { full: { id: "sidebar.rail.collaboration", defaultMessage: "Collaboration" }, short: { id: "sidebar.rail.collaboration.short", defaultMessage: "Collab" } },
  "lightvela.hermes.skills": { full: { id: "sidebar.rail.skills", defaultMessage: "Skills" }, short: { id: "sidebar.rail.skills.short", defaultMessage: "Skills" } },
  "lightvela.hermes.storage": { full: { id: "sidebar.rail.storage", defaultMessage: "Cloud storage" }, short: { id: "sidebar.rail.storage.short", defaultMessage: "Files" } },
  "vela.bot-management.navigation": { full: { id: "sidebar.bots", defaultMessage: "Bots" }, short: { id: "sidebar.rail.bots.short", defaultMessage: "Bots" } },
};

export function shellNavigationLabels(action: NavigationAction, intl: IntlShape) {
  const copy = labels[action.id as keyof typeof labels];
  return copy ? { full: intl.formatMessage(copy.full), short: intl.formatMessage(copy.short) }
    : { full: action.title, short: action.shortTitle ?? action.title };
}
