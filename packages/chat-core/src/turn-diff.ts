import type { TimelineStatus, TurnDiffFileSummary, TurnDiffTimelineBlock } from "./timeline";

/** Replacement method and historical boundary: docs/provenance/turn-diff-replacement.md. */
export interface TurnDiffSummary {
  readonly files: readonly TurnDiffFileSummary[];
  readonly additions: number;
  readonly deletions: number;
}

function destination(line: string): string | null {
  // Git emits either a whitespace-free token or a quoted path for each side.
  if (/\s$/u.test(line)) return null;
  const words = line.slice("diff --git ".length).match(/"(?:\\.|[^"\\])*"|[^\s]+/gu);
  if (words?.length !== 2) return null;
  let path = words[1];
  if (path.startsWith('"')) {
    const quoted = path.slice(1, -1);
    path = "";
    for (let index = 0; index < quoted.length; index++) {
      const character = quoted[index];
      const next = quoted[index + 1];
      if (character === "\\" && (next === "\\" || next === '"')) {
        path += next;
        index++;
      } else {
        path += character;
      }
    }
  }
  return path.replace(/^[ab]\//u, "");
}

export function summarizeTurnDiff(unifiedDiff: string): TurnDiffSummary {
  const byPath = new Map<string, { path: string; additions: number; deletions: number }>();
  let current: { path: string; additions: number; deletions: number } | null = null;
  for (const line of unifiedDiff.split(/\r?\n/u)) {
    if (line.startsWith("diff --git ")) {
      const path = destination(line);
      current = path === null ? null : byPath.get(path) ?? { path, additions: 0, deletions: 0 };
      if (current !== null) byPath.set(current.path, current);
      continue;
    }
    if (current === null) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) current.additions++;
    if (line.startsWith("-") && !line.startsWith("---")) current.deletions++;
  }
  const files = [...byPath.values()];
  return {
    files,
    additions: files.reduce((total, file) => total + file.additions, 0),
    deletions: files.reduce((total, file) => total + file.deletions, 0),
  };
}

export function createTurnChangeSummary(
  turnId: string, status: TimelineStatus, unifiedDiff: string | null,
): TurnDiffTimelineBlock | null {
  if (unifiedDiff === null || !unifiedDiff.trim()) return null;
  return {
    type: "turn-diff", id: `${turnId}:turn-diff`, sourceItemIds: [], unifiedDiff,
    ...summarizeTurnDiff(unifiedDiff),
    status: status === "pending" || status === "streaming" ? "running" : status,
  };
}
