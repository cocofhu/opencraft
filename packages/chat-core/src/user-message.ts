
export interface CodexUserMessageSemantics {
  readonly message: string;
  readonly goal: boolean;
  readonly referencesPriorConversation: boolean;
  readonly reviewMode: boolean;
  readonly pullRequestFixMode: boolean;
  readonly autoResolveSync: boolean;
}

export const CODEX_USER_REQUEST_MARKER = /## My request(?: for Codex)?:/g;
export const CODEX_REVIEW_MODE_HEADER = "## Code review guidelines:";
export const CODEX_PULL_REQUEST_FIX_HEADER = "## Pull request fix:";
export const CODEX_AUTO_RESOLVE_MERGE_HEADER = "## Auto resolve merge:";
export const CODEX_PRIOR_CONVERSATION_HEADER = "## Prior conversation with Codex:";

const requestHeaders = ["## My request:", "## My request for Codex:"] as const;

function requestBoundary(text: string): { first: number; end: number } | null {
  let first = text.length;
  let end = -1;
  for (const header of requestHeaders) {
    const start = text.indexOf(header);
    if (start === -1) continue;
    first = Math.min(first, start);
    end = Math.max(end, text.lastIndexOf(header) + header.length);
  }
  return end === -1 ? null : { first, end };
}

export function extractLastCodexUserRequest(promptContext: string): string {
  const boundary = requestBoundary(promptContext);
  return boundary === null ? promptContext : promptContext.slice(boundary.end).trim();
}

export function stripCodexGoalDirective(message: string): string | null {
  const candidate = message.trimStart();
  if (candidate === "/goal") return "";
  return candidate.startsWith("/goal ") ? candidate.slice(6).trimStart() : null;
}

export function deriveCodexUserMessageSemantics(rawMessage: string): CodexUserMessageSemantics {
  const boundary = requestBoundary(rawMessage);
  const context = boundary === null ? rawMessage : rawMessage.slice(0, boundary.first);
  const request = boundary === null ? rawMessage : rawMessage.slice(boundary.end).trim();
  const directive = stripCodexGoalDirective(request);
  const reviewMode = context.includes(CODEX_REVIEW_MODE_HEADER);
  const pullRequestFixMode = context.includes(CODEX_PULL_REQUEST_FIX_HEADER);
  return {
    message: directive ?? request,
    goal: directive !== null,
    reviewMode,
    pullRequestFixMode,
    autoResolveSync: context.includes(CODEX_AUTO_RESOLVE_MERGE_HEADER),
    referencesPriorConversation: !reviewMode && !pullRequestFixMode
      && context.includes(CODEX_PRIOR_CONVERSATION_HEADER),
  };
}
