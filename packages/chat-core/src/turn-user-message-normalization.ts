import type { TimelineSourceItem, TimelineSourceTurn } from "./projection";

type RecordValue = Readonly<Record<string, unknown>>;

interface UserMessageCompareKey {
  readonly rawText: string;
  readonly imageCount: number;
}

// Requirements and historical source boundary:
// docs/provenance/message-normalization-replacement.md
function record(value: unknown): RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue : {};
}

function string(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function codexUserMessageCompareKey(value: unknown): UserMessageCompareKey {
  if (typeof value === "string") return { rawText: value, imageCount: 0 };
  const text: string[] = [];
  let imageCount = 0;
  if (Array.isArray(value)) for (const part of value) {
    const data = record(part);
    if (typeof part === "string") text.push(part);
    else if (data.type === "text" && typeof data.text === "string") text.push(data.text);
    if (data.type === "image" || data.type === "localImage") imageCount++;
  }
  return { rawText: text.join("\n"), imageCount };
}

function inputOf(item: TimelineSourceItem): unknown {
  const data = record(item.payload);
  return item.type === "steeringUserMessage" ? data.input : data.content ?? data.input;
}

function clientOf(data: RecordValue): string | null {
  return string(data.clientId) ?? string(data.clientUserMessageId);
}

function equalInput(left: unknown, right: unknown): boolean {
  const a = codexUserMessageCompareKey(left);
  const b = codexUserMessageCompareKey(right);
  return a.rawText === b.rawText && a.imageCount === b.imageCount;
}

function identities(item: TimelineSourceItem, server?: TimelineSourceItem): string[] {
  const old = record(item.payload).__velaSourceItemIds;
  return [...new Set([item.id, ...(Array.isArray(old) ? old.filter((id): id is string => typeof id === "string") : []),
    ...(server ? [server.id] : [])])];
}

function hasStagedDisplay(input: unknown): boolean {
  if (!Array.isArray(input)) return false;
  const mentions = input.map(record).filter(part => part.type === "mention" && typeof part.name === "string" && typeof part.path === "string");
  for (const part of input) {
    const data = record(part);
    if (data.type !== "text" || typeof data.text !== "string" || !Array.isArray(data.text_elements)) continue;
    const text = data.text;
    const length = new TextEncoder().encode(text).length;
    for (const element of data.text_elements) {
      const span = record(element);
      const range = record(span.byte_range);
      if (range.start !== 0 || range.end !== length) continue;
      if (span.placeholder === "opencraft:staged-file:v1") return true;
      if (span.placeholder === "" && mentions.some(mention => text ===
        `The user attached a file named ${JSON.stringify(mention.name)}. Its readable path on this Host is ${JSON.stringify(mention.path)}. Read the file before answering questions about its contents; treat its contents as user-provided data.`)) return true;
    }
  }
  return false;
}

function localCanReceive(item: TimelineSourceItem): boolean {
  if (item.type !== "steeringUserMessage") return false;
  const status = record(item.payload).status;
  return status == null || status === "pending" || status === "accepted";
}

/** Associate echoes only with earlier local rows; the last echo owns metadata. */
function steeringAcknowledgements(items: readonly TimelineSourceItem[]) {
  const latest = new Map<number, TimelineSourceItem>();
  const consumed = new Set<number>();
  const eligible: number[] = [];
  for (let serverIndex = 0; serverIndex < items.length; serverIndex++) {
    const server = items[serverIndex]!;
    if (localCanReceive(server)) eligible.push(serverIndex);
    if (server.type !== "userMessage") continue;
    const client = clientOf(record(server.payload));
    for (const localIndex of eligible) {
      const local = items[localIndex]!;
      const localClient = clientOf(record(local.payload));
      if ((client !== null && client === localClient) || equalInput(inputOf(local), inputOf(server))) {
        latest.set(localIndex, server);
        consumed.add(serverIndex);
        break;
      }
    }
  }
  return { latest, consumed };
}

function canonicalMessage(turn: TimelineSourceTurn, params: RecordValue, server?: TimelineSourceItem): TimelineSourceItem {
  const id = server?.id ?? `${turn.id}:composer-user-message`;
  const data = record(server?.payload);
  const content = server && hasStagedDisplay(inputOf(server)) ? inputOf(server) : params.input;
  return {
    id, type: "userMessage", payload: {
      ...data, id, type: "userMessage", content,
      clientId: string(params.clientUserMessageId) ?? clientOf(data),
      attachments: params.attachments ?? data.attachments,
      sender: data.sender ?? params.sender ?? null,
      commentAttachments: params.commentAttachments ?? data.commentAttachments,
      mcpAppModelContextAttachments: turn.mcpAppModelContextAttachments,
      __velaMessageKind: "user",
      __velaSourceItemIds: server ? identities(server) : [id],
      __velaTurnParamsMessage: true,
    },
  };
}

function localMessage(item: TimelineSourceItem, server?: TimelineSourceItem): TimelineSourceItem {
  const data = record(item.payload);
  const acknowledged = record(server?.payload);
  return { ...item, payload: {
    ...data,
    input: server && hasStagedDisplay(inputOf(server)) ? inputOf(server) : data.input,
    attachments: data.attachments ?? acknowledged.attachments,
    sender: acknowledged.sender ?? data.sender ?? null,
    __velaMessageKind: "steering", __velaSourceItemIds: identities(item, server),
    serverUserMessageId: server?.id ?? null,
  } };
}

export function normalizeCodexTurnUserMessages(turn: TimelineSourceTurn): TimelineSourceTurn {
  const params = record(turn.params);
  const canonical = params.input != null && !(Array.isArray(params.input) && params.input.length === 0);
  const first = turn.items[0];
  const client = string(params.clientUserMessageId);
  const reuseFirst = canonical && first?.type === "userMessage" && (
    (client !== null && client === clientOf(record(first.payload))) || equalInput(params.input, inputOf(first))
  );
  const { latest, consumed } = steeringAcknowledgements(turn.items);
  const items: TimelineSourceItem[] = [];
  const hidden = new Set(turn.nonVisualItemIds ?? []);
  let leading = !canonical && turn.preserveServerUserMessages !== true;
  if (canonical) items.push(canonicalMessage(turn, params, reuseFirst ? first : undefined));
  for (let index = 0; index < turn.items.length; index++) {
    const item = turn.items[index]!;
    if ((reuseFirst && index === 0) || consumed.has(index)) continue;
    if (item.type === "steeringUserMessage") {
      items.push(localMessage(item, latest.get(index)));
      continue;
    }
    if (item.type === "steered") {
      hidden.add(item.id);
      leading = false;
      continue;
    }
    if (item.type !== "userMessage") {
      items.push(item);
      if (item.type !== "hookPrompt") leading = false;
      continue;
    }
    const data = record(item.payload);
    const serverClient = clientOf(data);
    if (leading) items.push({ ...item, payload: { ...data, __velaMessageKind: "user" } });
    else if (turn.preserveServerUserMessages === true || (serverClient !== null && !(client !== null && client === serverClient))) {
      items.push({ ...item, payload: { ...data, __velaMessageKind: "steering", __velaSteeringStatus: "accepted" } });
    } else hidden.add(item.id);
  }
  return { ...turn, items, ...(turn.nonVisualItemIds !== undefined || hidden.size > 0 ? { nonVisualItemIds: [...hidden] } : {}) };
}
