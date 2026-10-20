import { BookOpen, FileDiff, Folder, Globe2, Pencil, Search, Square, TerminalSquare } from "lucide-react";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Licensed semantic artwork; activity rail metrics belong to shared CSS. */
export function ChangeResourceIcon(props: IconProps) {
  return <FileDiff size={24} {...props} />;
}

export function GlobeActivityIcon(props: IconProps) {
  return <Globe2 size={20} {...props} />;
}

export function StopActivityIcon(props: IconProps) {
  return <Square size={20} fill="currentColor" {...props} />;
}

export function SearchActivityIcon(props: IconProps) {
  return <Search size={20} {...props} />;
}

export function ReadActivityIcon(props: IconProps) {
  return <BookOpen size={20} data-rtl-flip="" {...props} />;
}

export function FilesActivityIcon(props: IconProps) {
  return <Folder size={20} {...props} />;
}

export function PatchActivityIcon(props: IconProps) {
  return <Pencil size={20} {...props} />;
}

export function TerminalActivityIcon(props: IconProps) {
  return <TerminalSquare size={20} {...props} />;
}
