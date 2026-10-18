import { workbenchIconMetrics } from "@opencraft/design-system/tokens";
import { useWorkbenchProductId, usesVelaIcons } from "../../workbench-product";
import {
  Blocks, Brain, Palette, MessageSquare, Activity, Archive, ArrowLeft, ArrowRight, AudioLines, Bot, BrainCircuit,
  CalendarClock, CircleHelp, Cloud, Columns3, Cpu, Database, FileCode2, Folder,
  GitBranch, Globe2, Keyboard, HardDrive, House, LayoutGrid, ListTodo, MessageCircle,
  MessagesSquare, Mic, Monitor, PanelLeft, PanelLeftClose, Plug,
  Plus, Search, Server, Settings, SlidersHorizontal, Sparkles, SunMoon,
  SquarePen, TerminalSquare, UserRound, UserRoundCog, UsersRound,
  type LucideIcon,
} from "lucide-react";

/** Wire names stay semantic. Only this Web adapter selects the artwork. */
export const workbenchIconRegistry = {
  activity: Activity, appearance: SunMoon, archive: Archive, "arrow-left": ArrowLeft, "arrow-right": ArrowRight,
  audio: AudioLines, bot: Bot, brain: BrainCircuit, browser: Globe2,
  calendar: CalendarClock, changes: GitBranch, chat: MessageCircle,
  cloud: Cloud, collaboration: MessagesSquare, cpu: Cpu, database: Database,
  desktop: Monitor, write: SquarePen, applications: LayoutGrid, columns: Columns3,
  file: FileCode2, folder: Folder, "hard-drive": HardDrive,
  keyboard: Keyboard, home: House, grid: LayoutGrid, "message-circle": MessageCircle, microphone: Mic,
  monitor: Monitor, "panel-left": PanelLeft, "panel-left-close": PanelLeftClose,
  plug: Plug, plus: Plus, search: Search, server: Server, settings: Settings,
  sliders: SlidersHorizontal, sparkles: Sparkles, start: SquarePen,
  tasks: ListTodo, terminal: TerminalSquare, user: UserRound,
  "user-round": UserRound, "user-round-cog": UserRoundCog, users: UsersRound,
} satisfies Record<string, LucideIcon>;

export type WorkbenchIconName = keyof typeof workbenchIconRegistry;

export type WorkbenchIconPurpose = "navigation" | "settings" | "settings-page" | "panel" | "work";
const legacyIconOverrides = { chat: MessageSquare, appearance: Palette, brain: Brain };
/** One semantic mapping, with only product-specific artwork overrides. */
export function resolveWorkbenchIcon(name: string | undefined, vela: boolean, purpose: WorkbenchIconPurpose = "settings") {
  if (vela && purpose === "settings-page") return Blocks;
  if (vela && purpose === "navigation" && !["home", "chat", "write", "start", "message-circle", "cloud", "database", "folder", "hard-drive", "server", "bot", "settings", "applications", "columns", "keyboard"].includes(name ?? "")) return Blocks;
  if (vela && purpose === "panel" && !["chat", "terminal", "browser", "desktop"].includes(name ?? "")) return Plus;
  if (vela && purpose === "work") return name === "sparkles" ? Sparkles : Cloud;
  if (vela && name && Object.hasOwn(legacyIconOverrides, name)) return legacyIconOverrides[name as keyof typeof legacyIconOverrides];
  if (name && Object.hasOwn(workbenchIconRegistry, name)) return workbenchIconRegistry[name as WorkbenchIconName];
  return purpose === "navigation" ? Blocks : vela ? purpose === "panel" ? Plus : Blocks : CircleHelp;
}
export function workbenchIconSize(vela: boolean, purpose: WorkbenchIconPurpose): number {
  return (vela ? workbenchIconMetrics.vela : workbenchIconMetrics.core)[purpose === "settings-page" ? "settings" : purpose];
}

/** Decorative glyph; the owning control supplies its accessible name. */
export function WorkbenchIcon({ name, size, purpose = "settings", className }: {
  readonly name?: string;
  readonly size?: number;
  readonly purpose?: WorkbenchIconPurpose;
  readonly className?: string;
}) {
  const vela = usesVelaIcons(useWorkbenchProductId());
  const Icon = resolveWorkbenchIcon(name, vela, purpose);
  const stroke = !vela && purpose === "navigation" ? workbenchIconMetrics.coreNavigation.stroke
    : (vela ? workbenchIconMetrics.vela : workbenchIconMetrics.core).stroke;
  return <Icon size={size ?? workbenchIconSize(vela, purpose)} strokeWidth={stroke} aria-hidden="true" focusable="false"
    className={className} data-workbench-icon={name ?? "unknown"} />;
}
