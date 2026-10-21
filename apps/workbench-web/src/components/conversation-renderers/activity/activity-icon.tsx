import type { ToolActivityIcon } from "@opencraft/chat-core";
import { ImageIcon, Monitor, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import {
  AgentActivityIcon,
  FilesActivityIcon,
  GlobeActivityIcon,
  PatchActivityIcon,
  ReadActivityIcon,
  SearchActivityIcon,
  StopActivityIcon,
  TerminalActivityIcon,
} from "../../activity-glyphs";

export function activityIcon(icon: ToolActivityIcon): ReactNode {
  if (icon === "none") return null;
  if (icon === "terminal") return <TerminalActivityIcon aria-hidden="true" data-codex-activity-icon="terminal" />;
  if (icon === "patch") return <PatchActivityIcon aria-hidden="true" data-codex-activity-icon="patch" />;
  if (icon === "search") return <SearchActivityIcon aria-hidden="true" data-codex-activity-icon="search" />;
  if (icon === "read") return <ReadActivityIcon aria-hidden="true" data-codex-activity-icon="read" />;
  if (icon === "files") return <FilesActivityIcon aria-hidden="true" data-codex-activity-icon="files" />;
  if (icon === "stop") return <StopActivityIcon aria-hidden="true" data-codex-activity-icon="stop" />;
  if (icon === "image") return <ImageIcon />;
  if (icon === "agent") return <AgentActivityIcon />;
  if (icon === "browser") return <GlobeActivityIcon aria-hidden="true" data-codex-activity-icon="browser" />;
  if (icon === "computer") return <Monitor />;
  return <Wrench />;
}

/** Shared process-glyph rail. Glyph identity is supplied by the renderer; CSS
 * alone calibrates canvas padding, painted size and effective stroke. */
export function ActivityIcon({ children, running = false }: { readonly children: ReactNode; readonly running?: boolean }) {
  return <span className="thread-activity-item__icon" data-running={running || undefined} aria-hidden="true">{children}</span>;
}
