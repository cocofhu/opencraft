// Actual components at mono2 443554e0ba2e56ee5b8652e810024451fa1028ab. Test-only visual oracle.
import { Blocks, Bot, Cloud, Columns3, Database, Folder, HardDrive, LayoutGrid, MessageCircle, MessageSquare, Server, Settings, SquarePen, type LucideIcon } from "lucide-react";
import { createElement } from "react";

export interface NavigationAction {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  readonly active?: boolean;
  readonly onInvoke: () => void;
}

/** Semantic glyph mapping is platform-owned; CSS tokens own the physical scale. */
export function ReferenceNavigationIcon({ name, size = 15, selected = false }: {
  name?: string;
  size?: number;
  selected?: boolean;
}) {
  let icon: LucideIcon;
  // Only closed silhouettes can be filled. A server's lights, a Bot's face or
  // a gear's hub must not disappear under a generic `svg { fill }` rule.
  let silhouette = false;
  switch (name) {
    case "chat": icon = MessageSquare; silhouette = true; break;
    case "write": icon = SquarePen; break;
    case "message-circle": icon = MessageCircle; silhouette = true; break;
    case "cloud": icon = Cloud; silhouette = true; break;
    case "database": icon = Database; break;
    case "folder": icon = Folder; silhouette = true; break;
    case "hard-drive": icon = HardDrive; break;
    case "server": icon = Server; break;
    case "bot": icon = Bot; break;
    case "settings": icon = Settings; break;
    case "applications": icon = LayoutGrid; silhouette = true; break;
    case "columns": icon = Columns3; break;
    default: icon = Blocks; break;
  }
  const props = {
    size,
    "aria-hidden": true,
    focusable: false,
    "data-navigation-glyph-variant": selected ? "selected" : "outline",
    fill: selected && silhouette ? "currentColor" : "none",
    strokeWidth: selected && !silhouette ? 2.5 : 2,
  };
  return createElement(icon, props);
}

import { sidebarToggleGlyphs } from "@opencraft/design-system/sidebar-toggle-glyphs";

interface SidebarToggleIconProps {
  readonly sidebarOpen: boolean;
}

interface SidebarStateIconProps {
  readonly state: "hidden" | "visible";
  readonly path: string;
}

function SidebarStateIcon({ state, path }: SidebarStateIconProps) {
  return (
    <svg
      aria-hidden="true"
      data-sidebar-toggle-icon-state={state}
      width={sidebarToggleGlyphs.size}
      height={sidebarToggleGlyphs.size}
      viewBox={sidebarToggleGlyphs.viewBox}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}

function SidebarHiddenIcon() {
  return <SidebarStateIcon state="hidden" path={sidebarToggleGlyphs.hidden} />;
}

function SidebarVisibleIcon() {
  return <SidebarStateIcon state="visible" path={sidebarToggleGlyphs.visible} />;
}

export function ReferenceSidebarToggleIcon({ sidebarOpen }: SidebarToggleIconProps) {
  // Codex chooses between hGr and vGr component types. Replacing the SVG
  // atomically avoids WebKit's one-frame repaint when a complex path's `d`
  // attribute is mutated in place, while the owning button stays mounted.
  return sidebarOpen ? <SidebarVisibleIcon /> : <SidebarHiddenIcon />;
}

/** Source-faithful 16px Write glyph used by Codex's collapsed-sidebar action. */
export function ReferenceNewTaskIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.33325 1.88379C6.58178 1.88379 6.78345 2.08546 6.78345 2.33398C6.78328 2.58237 6.58168 2.78418 6.33325 2.78418H4.66626C3.62638 2.78435 2.78362 3.62711 2.78345 4.66699V11.334C2.78361 12.3739 3.62637 13.2176 4.66626 13.2178H11.3333C12.3733 13.2178 13.2169 12.374 13.217 11.334V9.66699C13.2172 9.41872 13.418 9.21795 13.6663 9.21777C13.9147 9.21777 14.1163 9.41861 14.1165 9.66699V11.334C14.1163 12.871 12.8703 14.1172 11.3333 14.1172H4.66626C3.12932 14.117 1.88322 12.8709 1.88306 11.334V4.66699C1.88323 3.13006 3.12933 1.88396 4.66626 1.88379H6.33325Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.8948 2.375C11.6494 1.63227 12.8628 1.63698 13.6116 2.38574C14.362 3.13643 14.3637 4.35266 13.6165 5.10644L9.36353 9.39355C9.01402 9.74579 8.56977 9.98985 8.08521 10.0967L6.17603 10.5166C5.74813 10.6107 5.36686 10.2296 5.46118 9.80176L5.88208 7.89746C5.98978 7.4105 6.23578 6.96428 6.59106 6.61426L10.8948 2.375ZM12.9749 3.02148C12.5756 2.62258 11.9289 2.62086 11.5266 3.0166L7.2229 7.25586C6.99148 7.4839 6.83116 7.77457 6.76099 8.0918L6.44165 9.53711L7.89185 9.21777C8.20744 9.14811 8.49721 8.98919 8.72485 8.75976L12.9778 4.47266C13.3759 4.07066 13.375 3.42164 12.9749 3.02148Z"
        fill="currentColor"
      />
    </svg>
  );
}
