import type { CSSProperties } from "react";
import { FormattedMessage } from "@opencraft/i18n/react";

/** Paint only: the conversation owner decides when recovery is pending. */
export function ComposerRecoveryScan({ active }: { readonly active: boolean }) {
  return <div className="opencraft-composer-recovery" data-active={active ? "true" : "false"}>
    <svg className="opencraft-composer-recovery__scan" aria-hidden="true" focusable="false">
      {[22, 18, 14, 10, 6, 2].map((length, index) => <rect
        key={length}
        x="0.5" y="0.5"
        pathLength={100}
        className="opencraft-composer-recovery__beam"
        strokeDasharray={`${length} ${100 - length}`}
        strokeWidth={0.3 + index * 0.16}
        opacity={0.14 + index * 0.025}
        style={{ "--scan-offset": `${length / 2}px` } as CSSProperties}
      />)}
    </svg>
    <span className="opencraft-composer-recovery__label" role="status">
      {active ? <FormattedMessage id="chat.restore.loading" defaultMessage="Loading conversation history…" /> : null}
    </span>
  </div>;
}
