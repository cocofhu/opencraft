import type { ReactNode } from "react";
import { CadencedShimmer } from "./activity-disclosure";
import { ActivityIcon } from "./activity-icon";

/** Noninteractive process summary; same visual contract as a disclosure header.
 * No feature-local class/style/size props: content and execution state only. */
export function ActivitySummaryRow({ icon, summary, running = false }: {
  readonly icon: ReactNode;
  readonly summary: ReactNode;
  readonly running?: boolean;
}) {
  return (
    <div className="thread-activity-item__header thread-activity-item__header-content">
      <ActivityIcon running={running}>{icon}</ActivityIcon>
      <CadencedShimmer active={running} className="thread-activity-item__summary">{summary}</CadencedShimmer>
    </div>
  );
}
