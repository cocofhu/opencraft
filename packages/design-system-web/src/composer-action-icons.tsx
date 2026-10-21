import type { ReactNode } from "react";

interface ComposerActionIconProps {
  readonly size?: number;
  readonly className?: string;
  readonly "aria-label"?: string;
}

function ComposerActionGlyph({ size = 20, className, "aria-label": label, kind, children }: ComposerActionIconProps & {
  readonly kind: string;
  readonly children: ReactNode;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
    strokeLinecap="round" strokeLinejoin="round" focusable="false"
    className={["ui-composer-action-glyph", className].filter(Boolean).join(" ")}
    data-composer-glyph={kind} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined}>
    {children}
  </svg>;
}

/** Input geometry remains owned by ui-composer-input-icon (including touch). */
export function ComposerMicrophoneIcon({ off = false, ...props }: ComposerActionIconProps & { readonly off?: boolean }) {
  return <ComposerActionGlyph {...props} kind={off ? "microphone-off" : "microphone"}>
    {off ? <>
      <path d="M9 6.5v4a3 3 0 0 0 5.1 2.15M15 9V6a3 3 0 0 0-5.15-2.1" />
      <path d="M6.5 10.5v.5a5.5 5.5 0 0 0 9.4 3.9M17.5 11v-.5" />
      <path d="m4 4 16 16" />
    </> : <>
      <path d="M9 6a3 3 0 0 1 6 0v4.5a3 3 0 0 1-6 0Z" />
      <path d="M6.5 10.5v.5a5.5 5.5 0 0 0 11 0v-.5" />
    </>}
    <path d="M12 16.5V21m-3 0h6" />
  </ComposerActionGlyph>;
}

/** One silhouette for commands, permissions and both Fast presentations. */
export function ComposerLightningIcon({ filled = false, ...props }: ComposerActionIconProps & { readonly filled?: boolean }) {
  return <ComposerActionGlyph {...props} kind="lightning">
    <path d="m13.25 3.5-7.75 9.5h6l-.75 7.5L18.5 11h-6l.75-7.5Z" fill={filled ? "currentColor" : "none"} />
  </ComposerActionGlyph>;
}
