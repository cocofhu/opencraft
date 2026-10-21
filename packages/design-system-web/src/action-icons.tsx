import type { ReactNode, SVGProps } from "react";
import { progressIndicatorGeometry } from "@opencraft/design-system/progress";

interface ActionIconProps extends Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height"> {
  readonly size?: number;
  readonly className?: string;
  readonly "aria-label"?: string;
}

function ActionGlyph({ size = 20, strokeWidth = 1.5, className, "aria-label": label, kind, children, ...attributes }: ActionIconProps & {
  readonly kind: string;
  readonly children: ReactNode;
}) {
  return <svg {...attributes} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
    strokeLinecap="round" strokeLinejoin="round" focusable="false"
    className={["ui-action-glyph", className].filter(Boolean).join(" ")}
    data-action-glyph={kind} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined}>
    {children}
  </svg>;
}

/** Input geometry remains owned by ui-composer-input-icon (including touch). */
export function MicrophoneIcon({ off = false, ...props }: ActionIconProps & { readonly off?: boolean }) {
  return <ActionGlyph {...props} kind={off ? "microphone-off" : "microphone"}>
    {off ? <>
      <path d="M9 6.5v4a3 3 0 0 0 5.1 2.15M15 9V6a3 3 0 0 0-5.15-2.1" />
      <path d="M6.5 10.5v.5a5.5 5.5 0 0 0 9.4 3.9M17.5 11v-.5" />
      <path d="m4 4 16 16" />
    </> : <>
      <path d="M9 6a3 3 0 0 1 6 0v4.5a3 3 0 0 1-6 0Z" />
      <path d="M6.5 10.5v.5a5.5 5.5 0 0 0 11 0v-.5" />
    </>}
    <path d="M12 16.5V21m-3 0h6" />
  </ActionGlyph>;
}

/** One silhouette for commands, permissions and both Fast presentations. */
export function LightningIcon({ filled = false, ...props }: ActionIconProps & { readonly filled?: boolean }) {
  return <ActionGlyph {...props} kind="lightning">
    <path d="m13.25 3.5-7.75 9.5h6l-.75 7.5L18.5 11h-6l.75-7.5Z" fill={filled ? "currentColor" : "none"} />
  </ActionGlyph>;
}

/** A ring distinguishes stopping a response from recording and sending. */
export function StopCircleIcon(props: ActionIconProps) {
  return <ActionGlyph {...props} kind="stop">
    <circle cx="12" cy="12" r="9" />
    <rect x="8.5" y="8.5" width="7" height="7" rx="1.25" />
  </ActionGlyph>;
}

/** A shared page silhouette keeps read and edit permissions in one family. */
export function PermissionDocumentIcon({ editable = false, ...props }: ActionIconProps & { readonly editable?: boolean }) {
  return <ActionGlyph {...props} kind={editable ? "permission-edit" : "permission-read"}>
    <path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10L14 3.5Z" />
    <path d="M13.5 3.5V8a1 1 0 0 0 1 1H19" />
    {editable ? <path d="m9.25 12.5-2 2 2 2m5.5-4 2 2-2 2" /> : <path d="M8.5 12.5h7m-7 4h5" />}
  </ActionGlyph>;
}

export function PermissionShieldIcon(props: ActionIconProps) {
  return <ActionGlyph {...props} kind="permission-shield">
    <path d="M12 3.5c2.15 1.65 4.5 2.5 7 3v5.25c0 4.25-2.6 7.25-7 9.25-4.4-2-7-5-7-9.25V6.5c2.5-.5 4.85-1.35 7-3Z" />
    <path d="m8.75 11.75 2.25 2.25 4.5-4.5" />
  </ActionGlyph>;
}

/** The same gear is used by Shell, account menus and settings contributions. */
export function SettingsGearIcon(props: ActionIconProps) {
  return <ActionGlyph {...props} kind="settings">
    <path d="M8.93 5.58 Q9.21 5.42 9.34 5.01 L9.82 3.54 Q9.95 3.13 10.69 3.13 L13.31 3.13 Q14.05 3.13 14.18 3.54 L14.66 5.01 Q14.79 5.42 15.07 5.58 L16.03 6.13 Q16.30 6.29 16.73 6.20 L18.23 5.88 Q18.66 5.79 19.02 6.43 L20.33 8.70 Q20.70 9.34 20.41 9.66 L19.39 10.81 Q19.10 11.13 19.10 11.44 L19.10 12.56 Q19.10 12.87 19.39 13.19 L20.41 14.34 Q20.70 14.66 20.33 15.30 L19.02 17.57 Q18.66 18.21 18.23 18.12 L16.73 17.80 Q16.30 17.71 16.03 17.87 L15.07 18.42 Q14.79 18.58 14.66 18.99 L14.18 20.46 Q14.05 20.87 13.31 20.87 L10.69 20.87 Q9.95 20.87 9.82 20.46 L9.34 18.99 Q9.21 18.58 8.93 18.42 L7.97 17.87 Q7.70 17.71 7.27 17.80 L5.77 18.12 Q5.34 18.21 4.98 17.57 L3.67 15.30 Q3.30 14.66 3.59 14.34 L4.61 13.19 Q4.90 12.87 4.90 12.56 L4.90 11.44 Q4.90 11.13 4.61 10.81 L3.59 9.66 Q3.30 9.34 3.67 8.70 L4.98 6.43 Q5.34 5.79 5.77 5.88 L7.27 6.20 Q7.70 6.29 7.97 6.13Z" />
    <circle cx="12" cy="12" r="3.1" />
  </ActionGlyph>;
}

/** Artwork only: the progress adapter or existing busy control owns motion. */
export function LoadingRingIcon(props: ActionIconProps) {
  const geometry = progressIndicatorGeometry;
  return <ActionGlyph {...props} strokeWidth={geometry.strokeWidth} kind="loading">
    <circle cx={geometry.center} cy={geometry.center} r={geometry.radius} opacity={geometry.trackOpacity} />
    <path d={geometry.foregroundPath} />
  </ActionGlyph>;
}

/** Counterclockwise return shared by reset and retry actions. */
export function ResetIcon(props: ActionIconProps) {
  return <ActionGlyph {...props} kind="reset">
    <path d="M5 9a8 8 0 1 1-1 5" />
    <path d="M5 4.5V9h4.5" />
  </ActionGlyph>;
}
