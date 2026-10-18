import type { ToolActivityIcon } from "@opencraft/chat-core";
import { Bot, ImageIcon, Monitor, Wrench } from "lucide-react";
import type { ReactNode } from "react";

import {
  CodexFilesActivityIcon,
  CodexGlobeActivityIcon,
  CodexPatchActivityIcon,
  CodexReadActivityIcon,
  CodexSearchActivityIcon,
  CodexStopActivityIcon,
  CodexTerminalActivityIcon,
} from "../../codex-activity-icons";

export function activityIcon(icon: ToolActivityIcon): ReactNode {
  if (icon === "none") return null;
  if (icon === "terminal") return <CodexTerminalActivityIcon aria-hidden="true" data-codex-activity-icon="terminal" />;
  if (icon === "patch") return <CodexPatchActivityIcon aria-hidden="true" data-codex-activity-icon="patch" />;
  if (icon === "search") return <CodexSearchActivityIcon aria-hidden="true" data-codex-activity-icon="search" />;
  if (icon === "read") return <CodexReadActivityIcon aria-hidden="true" data-codex-activity-icon="read" />;
  if (icon === "files") return <CodexFilesActivityIcon aria-hidden="true" data-codex-activity-icon="files" />;
  if (icon === "stop") return <CodexStopActivityIcon aria-hidden="true" data-codex-activity-icon="stop" />;
  if (icon === "image") return <ImageIcon />;
  if (icon === "agent") return <Bot />;
  if (icon === "browser") return <CodexGlobeActivityIcon aria-hidden="true" data-codex-activity-icon="browser" />;
  if (icon === "computer") return <Monitor />;
  return <Wrench />;
}

/** Shared process-glyph rail. Glyph identity is supplied by the renderer; CSS
 * alone calibrates canvas padding, painted size and effective stroke. */
export function ActivityIcon({ children }: { readonly children: ReactNode }) {
  return <span className="thread-activity-item__icon" aria-hidden="true">{children}</span>;
}
