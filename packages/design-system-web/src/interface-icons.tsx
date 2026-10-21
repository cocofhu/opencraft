import React, { type ReactNode } from "react";
import { ActionGlyph, type ActionIconProps } from "./icon-glyph";

/** Static interface artwork. Slots, colors, motion and interaction belong to the consumer. */
function glyph(kind: string, artwork: ReactNode) {
  return function InterfaceIcon(props: ActionIconProps) {
    return <ActionGlyph {...props} kind={kind}>{artwork}</ActionGlyph>;
  };
}

function Page({ children }: { readonly children?: ReactNode }) {
  return <><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-5.5-5.5ZM13.5 3.5V8a1 1 0 0 0 1 1H19" />{children}</>;
}
function Screen({ children }: { readonly children?: ReactNode }) {
  return <><rect x="3.5" y="4.5" width="17" height="12" rx="2.5" /><path d="M12 16.5V20m-4 0h8" />{children}</>;
}
function Person() {
  return <><circle cx="11.5" cy="7.5" r="3.1" /><path d="M5 20v-1a6.5 6.5 0 0 1 13 0v1" /></>;
}
function Shield({ children }: { readonly children?: ReactNode }) {
  return <><path d="M12 3.5c2.15 1.65 4.5 2.5 7 3v5.25c0 4.25-2.6 7.25-7 9.25-4.4-2-7-5-7-9.25V6.5c2.5-.5 4.85-1.35 7-3Z" />{children}</>;
}
function Chat({ children }: { readonly children?: ReactNode }) {
  return <><path d="M8 4.5h8a4 4 0 0 1 4 4V14a4 4 0 0 1-4 4H9l-5 3V8.5a4 4 0 0 1 4-4Z" />{children}</>;
}

export const HomeIcon = glyph("home", <><path d="m3.5 10 7-5.8a2.4 2.4 0 0 1 3 0l7 5.8M5.5 9v9a2 2 0 0 0 2 2H10v-6h4v6h2.5a2 2 0 0 0 2-2v-5" /></>);
export const ChatIcon = glyph("chat", <path d="M7.5 18.5 4 20l1.2-4.2a8 8 0 1 1 5.3 3.7" />);
export const MessageIcon = glyph("message", <Chat />);
export const NewMessageIcon = glyph("new-message", <Chat><path d="M12 8v6m-3-3h6" /></Chat>);
export const CollaborationIcon = glyph("collaboration", <><path d="M15.5 12v-5A3.5 3.5 0 0 0 12 3.5H7A3.5 3.5 0 0 0 3.5 7v9L7 13.5h5M19 8.5a3 3 0 0 1 1.5 2.6V21L17 18.5h-5a3.5 3.5 0 0 1-3.5-3.5" /></>);
export const AgentIcon = glyph("agent", <><rect x="4" y="6.5" width="16" height="13" rx="4" /><path d="M12 3v3.5M8.5 15.5h7" /><circle cx="8.5" cy="11.5" r=".85" fill="currentColor" stroke="none" /><circle cx="15.5" cy="11.5" r=".85" fill="currentColor" stroke="none" /></>);
export const CloudIcon = glyph("cloud", <path d="M8 18.5H6.8a4.3 4.3 0 0 1-1-8.5 6.2 6.2 0 0 1 12-1.5A5 5 0 0 1 17 18.5h-5" />);
export const ServerIcon = glyph("server", <><rect x="4" y="4" width="16" height="6" rx="2.3" /><rect x="4" y="14" width="16" height="6" rx="2.3" /><path d="M13 7h3m-3 10h3" /><circle cx="7.5" cy="7" r=".7" fill="currentColor" stroke="none" /><circle cx="7.5" cy="17" r=".7" fill="currentColor" stroke="none" /></>);
export const GlobeIcon = glyph("globe", <><circle cx="12" cy="12" r="8" /><path d="M4.5 12h15M12 4c-4.5 4.6-4.5 11.4 0 16m0-16c4.5 4.6 4.5 11.4 0 16" /></>);
export const MonitorIcon = glyph("monitor", <Screen />);
export const MonitorOffIcon = glyph("monitor-off", <><path d="M9 4.5h9a2.5 2.5 0 0 1 2.5 2.5v7M17 16.5H6A2.5 2.5 0 0 1 3.5 14V7M12 16.5V20m-4 0h8M3.5 3.5l17 17" /></>);
export const LaptopIcon = glyph("laptop", <><path d="M5 15V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v9M4 15h16l1 3a1.5 1.5 0 0 1-1.5 2h-15A1.5 1.5 0 0 1 3 18l1-3Zm6 2.5h4" /></>);
export const DevicesIcon = glyph("devices", <><path d="M10 16H6a2.5 2.5 0 0 1-2.5-2.5V7A2.5 2.5 0 0 1 6 4.5h11a2.5 2.5 0 0 1 2.5 2.5M8 16v4m-3 0h6" /><rect x="14" y="9.5" width="7" height="11" rx="1.8" /><path d="M17 18h1" /></>);
export const CalendarIcon = glyph("calendar", <><path d="M9 20H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M8 3.5v4m8-4v4M4 10h6" /><circle cx="16.5" cy="16.5" r="4.5" /><path d="M16.5 14v2.5l1.5 1" /></>);
export const ClockIcon = glyph("clock", <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3.5 2" /></>);
export const PersonIcon = glyph("person", <Person />);
export const PeopleIcon = glyph("people", <><g transform="translate(-1.5 .5) scale(.9)"><Person /></g><path d="M17.5 4.8a3.2 3.2 0 0 1 0 6.1m1 2.9a5 5 0 0 1 3 4.6V20" /></>);
export const PersonSettingsIcon = glyph("person-settings", <><path d="M4 20v-1a6 6 0 0 1 8-5.7" /><circle cx="9.5" cy="7.5" r="3.1" /><circle cx="17" cy="17" r="2.8" /><path d="M17 12.5v1m0 7v1m4.5-4.5h-1m-7 0h-1m1.3-3.2.7.7m5 5 .7.7m0-6.4-.7.7m-5 5-.7.7" /></>);
export const ArrowLeftIcon = glyph("arrow-left", <path d="M20 12H4.5m6-6-6 6 6 6" />);
export const ArrowRightIcon = glyph("arrow-right", <path d="M4 12h15.5m-6-6 6 6-6 6" />);
export const ArrowUpIcon = glyph("arrow-up", <path d="M12 20V4.5m-6 6 6-6 6 6" />);
export const ArrowDownIcon = glyph("arrow-down", <path d="M12 4v15.5m-6-6 6 6 6-6" />);
export const ArrowUpRightIcon = glyph("arrow-up-right", <path d="M5.5 18.5 18 6m-9 0h9v9" />);
export const TurnRightIcon = glyph("turn-right", <path d="M5 5v7a4 4 0 0 0 4 4h11m-4-4 4 4-4 4" />);
export const ExternalLinkIcon = glyph("external-link", <><path d="M11 4.5H7a2.5 2.5 0 0 0-2.5 2.5v10A2.5 2.5 0 0 0 7 19.5h10a2.5 2.5 0 0 0 2.5-2.5v-4M13.5 4.5h6v6m0-6-10 10" /></>);
export const DownloadIcon = glyph("download", <path d="M12 3.5v12m-4-4 4 4 4-4M4.5 15v3A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" />);
export const UploadIcon = glyph("upload", <path d="M12 15.5v-12m-4 4 4-4 4 4M4.5 15v3A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" />);
export const AlertIcon = glyph("alert", <><circle cx="12" cy="12" r="8" /><path d="M12 7.5v5" /><circle cx="12" cy="16.2" r=".7" fill="currentColor" stroke="none" /></>);
export const WarningIcon = glyph("warning", <><path d="m10.2 4.8-7 12.5A2 2 0 0 0 5 20.2h14a2 2 0 0 0 1.8-2.9l-7-12.5a2 2 0 0 0-3.6 0Z" /><path d="M12 9v4.5" /><circle cx="12" cy="17" r=".7" fill="currentColor" stroke="none" /></>);
export const HelpIcon = glyph("help", <><circle cx="12" cy="12" r="8" /><path d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-1.4.9-1.6 1.3-1.6 2.4" /><circle cx="12" cy="16.5" r=".7" fill="currentColor" stroke="none" /></>);
export const InfoIcon = glyph("info", <><circle cx="12" cy="12" r="8" /><path d="M10.5 11.5H12v5m-1.5 0h3" /><circle cx="12" cy="7.5" r=".7" fill="currentColor" stroke="none" /></>);
export const CircleIcon = glyph("circle", <circle cx="12" cy="12" r="8" />);
export const CheckedCircleIcon = glyph("checked-circle", <><path d="M19.5 9A8 8 0 1 1 15 4.6M8 11.5l3.5 3.5 8-8" /></>);
export const PausedCircleIcon = glyph("paused-circle", <><circle cx="12" cy="12" r="8" /><path d="M9.5 8.5v7m5-7v7" /></>);
export const SquareIcon = glyph("square", <rect x="5" y="5" width="14" height="14" rx="2.5" />);
export const PlayIcon = glyph("play", <path d="m8.5 4.8 11 6a1.3 1.3 0 0 1 0 2.4l-11 6a1.3 1.3 0 0 1-2-1.2V6a1.3 1.3 0 0 1 2-1.2Z" />);
export const PauseIcon = glyph("pause", <><rect x="6" y="4.5" width="3.5" height="15" rx="1" /><rect x="14.5" y="4.5" width="3.5" height="15" rx="1" /></>);
export const ToolIcon = glyph("tool", <path d="M13.5 4.5a5.5 5.5 0 0 0-5.8 7.4l-4.2 4.2a2.8 2.8 0 0 0 4 4l4.2-4.2a5.5 5.5 0 0 0 7.4-6.1l-3.6 3-3.2-3.2 3-3.6" />);
export const ExtensionsIcon = glyph("extensions", <><rect x="4" y="11" width="6.5" height="9" rx="1.5" /><rect x="4" y="4" width="6.5" height="4" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="9" rx="1.5" /><rect x="13.5" y="16" width="6.5" height="4" rx="1.5" /></>);
export const GridIcon = glyph("grid", <><rect x="4.5" y="4.5" width="6" height="6" rx="1.8" /><rect x="13.5" y="4.5" width="6" height="6" rx="1.8" /><rect x="4.5" y="13.5" width="6" height="6" rx="1.8" /><rect x="13.5" y="13.5" width="6" height="6" rx="1.8" /></>);
export const ColumnsIcon = glyph("columns", <><rect x="4" y="4.5" width="16" height="15" rx="2.5" /><path d="M9.3 4.5v15m5.4-15v15" /></>);
export const SlidersIcon = glyph("sliders", <><path d="M4 7h3m4 0h9M4 17h9m4 0h3" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></>);
export const BranchIcon = glyph("branch", <><circle cx="6" cy="5.5" r="2" /><circle cx="6" cy="18.5" r="2" /><circle cx="18" cy="5.5" r="2" /><path d="M6 7.5v9m12-9c0 5-4 5-7 5H6" /></>);
export const ForkIcon = glyph("fork", <><circle cx="5.5" cy="5.5" r="2" /><circle cx="18.5" cy="5.5" r="2" /><circle cx="12" cy="18.5" r="2" /><path d="M5.5 7.5V9a3 3 0 0 0 3 3h7a3 3 0 0 0 3-3V7.5M12 12v4.5" /></>);
export const EyeIcon = glyph("eye", <><path d="M3.5 12s3-6 8.5-6 8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" /><circle cx="12" cy="12" r="2.8" /></>);
export const EyeOffIcon = glyph("eye-off", <><path d="M9 6.5c4.7-1.6 8.6.8 11.5 5.5-.8 1.3-1.7 2.4-2.8 3.4M14.8 17.5C10 19 6.3 16.7 3.5 12c.8-1.3 1.7-2.4 2.8-3.4M3.5 3.5l17 17" /></>);
export const KeyboardIcon = glyph("keyboard", <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M7 9h.1m3.2 0h.1m3.2 0h.1m3.2 0h.1M7 12h.1m3.2 0h.1m3.2 0h.1m3.2 0h.1M8 15h8" /></>);
export const AudioIcon = glyph("audio", <path d="M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4" />);
export const CpuIcon = glyph("cpu", <><rect x="6" y="6" width="12" height="12" rx="2.5" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" /><path d="M9 3.5V6m6-2.5V6M9 18v2.5m6-2.5v2.5M3.5 9H6m-2.5 6H6m12-6h2.5M18 15h2.5" /></>);
export const DatabaseIcon = glyph("database", <><ellipse cx="12" cy="6.5" rx="7.5" ry="3" /><path d="M4.5 6.5v10c0 4 15 4 15 0v-10M4.5 11.5c0 4 15 4 15 0" /></>);
export const DriveIcon = glyph("drive", <><path d="m4.5 13 2-7A2 2 0 0 1 8.4 4.5h7.2A2 2 0 0 1 17.5 6l2 7" /><rect x="4" y="12" width="16" height="7" rx="2.5" /><path d="M8 15.5h.1m3.9 0h4" /></>);
export const PlugIcon = glyph("plug", <path d="M9 3.5V8m6-4.5V8M6.5 8h11M8 8v4a4 4 0 0 0 8 0V8m-4 8v4.5" />);
export const ArchiveIcon = glyph("archive", <><rect x="4" y="4.5" width="16" height="5" rx="1.5" /><path d="M5.5 9.5v8.3a2.2 2.2 0 0 0 2.2 2.2h8.6a2.2 2.2 0 0 0 2.2-2.2V9.5M10 13h4" /></>);
export const RestoreArchiveIcon = glyph("restore-archive", <><path d="M7 4.5h12a1 1 0 0 1 1 1v3H9M5.5 12v5.8A2.2 2.2 0 0 0 7.7 20h8.6a2.2 2.2 0 0 0 2.2-2.2v-6M12 13h3M7 3.5 3.5 7 7 10.5M3.5 7H12" /></>);
export const ListIcon = glyph("list", <path d="M8 6h12M8 12h12M8 18h12M4 6h.1M4 12h.1M4 18h.1" />);
export const TasksIcon = glyph("tasks", <><rect x="4" y="4.5" width="4" height="4" rx="1" /><rect x="4" y="15.5" width="4" height="4" rx="1" /><path d="M12 6.5h8m-8 11h8M5 12h15" /></>);
export const ChecklistIcon = glyph("checklist", <path d="m3.5 6 1.5 1.5L8 4m3 2.5h9M3.5 17 5 18.5l3-3.5m3 2.5h9M11 12h9" />);
export const FilterIcon = glyph("filter", <path d="M4 6h16M7.5 12h9M10.5 18h3" />);
export const ChartIcon = glyph("chart", <path d="M4.5 4.5v13a2 2 0 0 0 2 2h13M8 14l4-4 3 2.5 5-6" />);
export const PulseIcon = glyph("pulse", <path d="M3.5 12H7l3-7 4 14 3-7h3.5" />);
export const TargetIcon = glyph("target", <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".7" fill="currentColor" stroke="none" /></>);
export const GaugeIcon = glyph("gauge", <><path d="M5 18a8.5 8.5 0 1 1 14 0M5.5 9l2 1M12 4.5v2m6.5 2.5-2 1M12 16l4-4" /><circle cx="12" cy="16" r="1.5" /></>);
export const SparklesIcon = glyph("sparkles", <><path d="m11 4 2.1 5.9L19 12l-5.9 2.1L11 20l-2.1-5.9L3 12l5.9-2.1L11 4ZM19 3.5V7m-1.75-1.75h3.5" /></>);
export const AppearanceIcon = glyph("appearance", <><path d="M13 4a8 8 0 1 0 7 11.5A7.5 7.5 0 0 1 13 4Z" /><path d="M18.5 3.5v4m-2-2h4M20 10h.1" /></>);
export const SunriseIcon = glyph("sunrise", <><path d="M7 15a5 5 0 0 1 10 0M3.5 15h17M6 19h12M12 3.5v2m-7 3 1.5 1.5M19 8.5 17.5 10" /></>);
export const PaletteIcon = glyph("palette", <><path d="M14 4.3a8.5 8.5 0 1 0 1.2 15.5c1.8-1 .8-2.5.1-3.8-.7-1.4.5-2.6 2-2.3 2 .4 3.2-1.2 2.9-3.2-.5-3-3-5.4-6.2-6.2Z" /><circle cx="8" cy="9" r=".8" /><circle cx="13" cy="7.5" r=".8" /><circle cx="6.5" cy="14" r=".8" /></>);
export const BellIcon = glyph("bell", <path d="M7 10a5 5 0 0 1 10 0c0 6 2 6 2 7H5c0-1 2-1 2-7Zm3 10h4M12 3.5V5" />);
export const PinIcon = glyph("pin", <path d="M9 4.5h9m-7 0v5l-5 4.8h8.5l.5-5 3-4.8M10 14.3 5 20" />);
export const PinOffIcon = glyph("pin-off", <path d="M11 4.5h7l-3 4.8-.2 2M8 8v1.5l-3 4.8h8M10 14.3 5 20M3.5 3.5l17 17" />);
export const GripIcon = glyph("grip", <><path d="M9 5.5h.1m5.8 0h.1M9 12h.1m5.8 0h.1M9 18.5h.1m5.8 0h.1" strokeWidth="2.8" /></>);
export const LoginIcon = glyph("login", <path d="M14 4.5h3a2.5 2.5 0 0 1 2.5 2.5v10a2.5 2.5 0 0 1-2.5 2.5h-3M3.5 12H14m-4-4 4 4-4 4" />);
export const LogoutIcon = glyph("logout", <path d="M10 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h3M10 12h10.5m-4-4 4 4-4 4" />);
export const AtSignIcon = glyph("mention", <><circle cx="11.5" cy="12" r="3.5" /><path d="M15 8.5v6a2 2 0 0 0 4 0V12a7.5 7.5 0 1 0-5 7.1" /></>);
export const LinkIcon = glyph("link", <path d="m9 8 3-3a4.2 4.2 0 0 1 6 6l-3 3M9 10l-3 3a4.2 4.2 0 0 0 6 6l3-3M8.5 15.5l7-7" />);
export const LocationIcon = glyph("location", <><path d="M19 10.5C19 16 12 21 12 21S5 16 5 10.5a7 7 0 0 1 14 0Z" /><circle cx="12" cy="10.5" r="2.5" /></>);
export const ShieldIcon = glyph("shield", <Shield />);
export const PasteIcon = glyph("paste", <><path d="M8 5.5H6A2 2 0 0 0 4 7.5V18a2 2 0 0 0 2 2h5M16 5.5h2a2 2 0 0 1 2 2V10" /><rect x="8" y="3.5" width="8" height="4" rx="1.3" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>);
export const SaveIcon = glyph("save", <><path d="M15 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-5-5ZM8 4v6h7V4M8 20v-6h8v6" /></>);
export const SendIcon = glyph("send", <path d="m4.5 10 15-6a.5.5 0 0 1 .7.7l-6 15a.5.5 0 0 1-.9 0L10 14l-5.5-3.1a.5.5 0 0 1 0-.9ZM10 14l6-6" />);
export const RedoIcon = glyph("redo", <path d="M19 9a8 8 0 1 0 1 5M19 4.5V9h-4.5" />);
export const DoubleCheckIcon = glyph("double-check", <path d="m3.5 12 4 4L17 6.5M12 16l8.5-8.5" />);
export const ExpandIcon = glyph("expand", <path d="M9 4H4v5m0-5 6 6m5 10h5v-5m0 5-6-6" />);
export const CollapseIcon = glyph("collapse", <path d="M4 10h6V4m0 6L4 4m10 16v-6h6m-6 0 6 6" />);
export const ZoomInIcon = glyph("zoom-in", <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5M7.5 10.5h6m-3-3v6" /></>);
export const ZoomOutIcon = glyph("zoom-out", <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5M7.5 10.5h6" /></>);
export const ImageIcon = glyph("image", <><path d="M15 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V9M4 16l5-5 4 4 2.5-2.5L20 17" /><circle cx="15.5" cy="8.5" r="1.5" /></>);
export const DocumentIcon = glyph("document", <Page />);
export const TextFileIcon = glyph("text-file", <Page><path d="M8.5 12.5h7m-7 4h5" /></Page>);
export const CodeFileIcon = glyph("code-file", <Page><path d="m10 12.5-2 2 2 2m4-4 2 2-2 2" /></Page>);
export const JsonFileIcon = glyph("json-file", <Page><path d="M10.5 11.5H10v2l-1 1 1 1v2h.5m3-6h.5v2l1 1-1 1v2h-.5" /></Page>);
export const DiffFileIcon = glyph("diff-file", <Page><path d="M8.5 12h6m-3-3v6m-3 2h6" /></Page>);
export const ImageFileIcon = glyph("image-file", <Page><path d="m7.5 17 3-3 2 2 1.5-1.5L17 17.5" /><circle cx="9" cy="11.5" r=".6" fill="currentColor" stroke="none" /></Page>);
export const CodeIcon = glyph("code", <path d="m8 6-5 6 5 6M16 6l5 6-5 6M14 4l-4 16" />);
export const BookIcon = glyph("book", <><path d="M12 6c-2.5-1.5-5.5-1.7-8.5-.7v13c3-1 6-.8 8.5.7m0-13c2.5-1.5 5.5-1.7 8.5-.7v13c-3-1-6-.8-8.5.7V6Z" /></>);
export const NewFolderIcon = glyph("new-folder", <><path d="M4 7a3 3 0 0 1 3-3h3l2.2 2.5H17a3 3 0 0 1 3 3V17a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7ZM12 10v6m-3-3h6" /></>);
export const TableIcon = glyph("table", <><rect x="4" y="4.5" width="16" height="15" rx="2.5" /><path d="M4 10h16M9 10v9.5M4 15h16" /></>);
export const LabIcon = glyph("lab", <path d="M8 3.5h8m-6 0v6l-5.5 8a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3l-5.5-8v-6M7.5 14h9" />);
export const LayersIcon = glyph("layers", <path d="m12 3.5 9 5-9 5-9-5 9-5ZM3.5 13l8.5 4.5 8.5-4.5m-17 4 8.5 4.5 8.5-4.5" />);
export const BoxesIcon = glyph("boxes", <><path d="m12 3.5 5 2.7-5 2.7-5-2.7 5-2.7ZM7 6.2v5.6m10-5.6v5.6M12 9v5m-5-3 5 2.7-5 2.8-5-2.8 5-2.7Zm10 0 5 2.7-5 2.8-5-2.8 5-2.7ZM2 13.7v4.5L7 21l5-2.8 5 2.8 5-2.8v-4.5M7 16.5V21m10-4.5V21" /></>);
export const BriefcaseIcon = glyph("briefcase", <><rect x="4" y="7" width="16" height="13" rx="2.5" /><path d="M8.5 7V4.5h7V7M4 12c5 3 11 3 16 0m-8 0v4" /></>);
export const BalanceIcon = glyph("balance", <><path d="M12 3.5V20m-5 0h10M5 7h14M5 7l-3 7h6L5 7Zm14 0-3 7h6l-3-7Z" /></>);
export const HookIcon = glyph("hook", <><circle cx="12" cy="5" r="2.5" /><path d="M12 7.5V16a4.5 4.5 0 0 0 9 0v-3l-2 2M12 16a4.5 4.5 0 0 1-9 0v-3l2 2" /></>);

export const EnvironmentsIcon = glyph("environments", <><rect x="3.5" y="7" width="12" height="5" rx="1.5" /><rect x="3.5" y="15" width="12" height="5" rx="1.5" /><path d="M7 9.5h4.5M7 17.5h4.5M5 3.5h11l-2-2M20 7v13l2-2" /></>);

export const ReviewShieldIcon = glyph("review-shield", <Shield><path d="m8 10 2.5 2.5L8 15m5 0h3" /></Shield>);
