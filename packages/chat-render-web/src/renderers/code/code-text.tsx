import { Component, createElement, createRef } from "react";

interface CodeTextProps {
  readonly code: string;
  readonly highlightedHtml: string | null;
}

type Endpoint = {
  readonly code: HTMLElement;
  readonly source: string;
  readonly offset: number;
} | {
  readonly node: Node;
  readonly offset: number;
};

interface CodeSelection {
  readonly selection: Selection;
  readonly anchor: Endpoint;
  readonly focus: Endpoint;
}

function endpoint(code: HTMLElement, node: Node, offset: number): Endpoint {
  // The other endpoint may belong to another code surface whose syntax tokens
  // are replaced in this same commit. Keep its stable code root, not a token.
  const root = code.contains(node) ? code
    : (node.nodeType === Node.ELEMENT_NODE ? node as Element : node.parentElement)?.closest("code");
  if (!root) return { node, offset };
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return { code: root, source: root.textContent ?? "", offset: range.toString().length };
}

function resolveEndpoint(point: Endpoint): { node: Node; offset: number } | null {
  if ("node" in point) return point.node.isConnected ? point : null;
  const code = point.code;
  if (!code.isConnected || !(code.textContent ?? "").startsWith(point.source)) return null;
  const walker = code.ownerDocument.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  let remaining = point.offset;
  let node: Node | null;
  while ((node = walker.nextNode()) !== null) {
    const length = node.textContent?.length ?? 0;
    if (remaining <= length) return { node, offset: remaining };
    remaining -= length;
  }
  return point.offset === 0 ? { node: code, offset: 0 } : null;
}

/** Keep the reader's selection across text appends and syntax-only DOM updates. */
export class CodeText extends Component<CodeTextProps, object, CodeSelection | null> {
  private readonly element = createRef<HTMLElement>();

  getSnapshotBeforeUpdate(previous: Readonly<CodeTextProps>): CodeSelection | null {
    if (previous.code === this.props.code && previous.highlightedHtml === this.props.highlightedHtml) return null;
    // A replacement may change the meaning of the selected text. Only retain
    // offsets when the existing source is unchanged or extended at the end.
    if (!this.props.code.startsWith(previous.code)) return null;
    const code = this.element.current;
    const selection = code?.ownerDocument.getSelection();
    if (!code || !selection || selection.isCollapsed || !selection.anchorNode || !selection.focusNode) return null;
    if (!code.contains(selection.anchorNode) && !code.contains(selection.focusNode)) return null;
    return { selection,
      anchor: endpoint(code, selection.anchorNode, selection.anchorOffset),
      focus: endpoint(code, selection.focusNode, selection.focusOffset) };
  }

  componentDidUpdate(_previous: Readonly<CodeTextProps>, _state: object, snapshot: CodeSelection | null) {
    const code = this.element.current;
    if (!code || !snapshot) return;
    const anchor = resolveEndpoint(snapshot.anchor);
    const focus = resolveEndpoint(snapshot.focus);
    if (anchor && focus) snapshot.selection.setBaseAndExtent(anchor.node, anchor.offset, focus.node, focus.offset);
  }

  render() {
    const { code, highlightedHtml } = this.props;
    return createElement("code", { ref: this.element,
      className: highlightedHtml === null ? undefined : "chat-code-highlight",
      dangerouslySetInnerHTML: highlightedHtml === null ? undefined : { __html: highlightedHtml } },
      highlightedHtml === null ? code : undefined);
  }
}
