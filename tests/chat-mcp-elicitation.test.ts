import assert from "node:assert/strict";
import test from "node:test";
import { createMcpElicitationDraft, normalizeMcpElicitationMetadata as metadata,
  normalizeMcpElicitationSchema as schema, presentMcpElicitationDisplayValue as display,
  validateMcpElicitationDraft as validate } from "../packages/chat-core/src/mcp-elicitation";

test("metadata routing respects mode, typed identities and persistence order", () => {
  const source = { codex_approval_kind: "mcp_tool_call", connector_id: "issues", tool_params: { title: "Hi" },
    tool_params_display: [{ name: "title", display_name: "Title", value: "Hi" }, { name: 3 }], persist: ["always", "session", "always", "bad"] };
  const result = metadata("form", source);
  assert.equal(result.interactionKind, "tool-approval");
  assert.deepEqual(result.persist, ["always", "session"]);
  assert.deepEqual(result.toolApproval?.toolParamsDisplay, [{ name: "title", displayName: "Title", value: "Hi" }]);
  assert.equal(metadata("url", source).interactionKind, "url-action");
  assert.equal(metadata("form", { riskLevel: "critical" }).riskLevel, null);
});

test("connector auth and suggestions require their complete typed metadata", () => {
  const auth = { _codex_apps: { connector_auth_failure: { is_auth_failure: true, connector_id: "drive", connector_name: "Drive",
    install_url: "https://example.test/auth", requested_scopes: ["read", 3] } } };
  assert.equal(metadata("url", auth, { serverName: "other" }).connectorAuth, null);
  assert.deepEqual(metadata("url", auth, { serverName: "codex_apps" }).connectorAuth?.requestedScopes, ["read"]);
  const suggestion = { codex_approval_kind: "tool_suggestion", suggest_type: "install", suggest_reason: "Use issues", tool_type: "connector", tool_id: "issues", tool_name: "Issues", persist: "always" };
  assert.equal(metadata("form", suggestion).toolSuggestion?.persistAlways, true);
  assert.equal(metadata("form", { ...suggestion, persist: ["always"] }).toolSuggestion?.persistAlways, false);
  assert.equal(metadata("form", { ...suggestion, suggest_reason: 3 }).toolSuggestion, null);
});

test("computer-use fallback is an exact engine contract and does not create authorization", () => {
  const context = { serverName: "computer-use", message: "Allow Codex to use Notes?", requestedSchema: { properties: {} } };
  const input = { codex_approval_kind: "mcp_tool_call", persist: "always", tool_params: { old: true } };
  assert.deepEqual(metadata("form", input, context).toolApproval?.toolParams, { app: "Notes" });
  assert.equal(metadata("form", {}, context).interactionKind, "form");
  const explicit = metadata("form", { ...input, connector_id: "desktop", tool_name: "open_app", tool_title: "Open", connector_name: "Desktop" }, context).toolApproval;
  assert.equal(explicit?.connectorId, "desktop");
  assert.equal(explicit?.toolName, "open_app");
  assert.equal(explicit?.connectorName, "Desktop");
  assert.equal(metadata("form", { persist: "always" }, { ...context, message: "Allow Codex to use Notes\nNow?" }).interactionKind, "form");
  assert.equal(metadata("form", { persist: "always" }, { ...context, message: "Use Notes" }).interactionKind, "form");
  assert.equal(metadata("form", { persist: "always" }, { ...context, requestedSchema: { properties: { name: { type: "string" } } } }).interactionKind, "form");
});

test("schema choices, defaults and typed validation retain ordered data", () => {
  const fields = schema({ required: ["name", "count", "tags"], properties: {
    name: { type: "string", minLength: 2, maxLength: 4 }, count: { type: "integer", minimum: 1, maximum: 3 },
    enabled: { type: "boolean", default: true }, tags: { type: "array", items: { enum: ["safe", "fast"] } },
    choice: { type: "integer", items: { enum: ["a"] } },
  } });
  assert.equal(fields[4].integer, true);
  assert.equal(fields[4].kind, "select");
  const draft = createMcpElicitationDraft(fields);
  assert.deepEqual(validate(fields, draft).errors, { name: "This field is required", count: "This field is required", tags: "Select at least one option" });
  assert.deepEqual(validate(fields, { ...draft, name: " good ", count: "2", tags: ["fast", "safe"] }), {
    content: { name: "good", count: 2, enabled: true, tags: ["fast", "safe"], choice: "a" }, errors: {},
  });
  for (const [value, error] of [["1.5", "Enter a whole number"], ["0", "Must be at least 1"], ["4", "Must be at most 3"]]) {
    assert.equal(validate(fields, { ...draft, count: value }).errors.count, error);
  }
});

test("display boundaries preserve complete values and tolerate circular input", () => {
  assert.equal(display("x".repeat(120)).isExpandable, false);
  assert.equal(display("x".repeat(121)).isExpandable, true);
  const result = display({ text: "x".repeat(100) });
  assert.equal(result.previewText.length, 48);
  assert.equal(result.previewText.endsWith("…"), true);
  assert.match(result.expandedText, /x{100}/u);
  const circular: Record<string, unknown> = {}; circular.self = circular;
  assert.equal(display(circular).expandedText, "[object Object]");
  assert.equal(display(undefined).expandedText, "");
});

test("prototype-like field names stay own data properties without prototype mutation", () => {
  const fields = schema(JSON.parse('{"properties":{"__proto__":{"type":"string","default":"safe"},"constructor":{"type":"string","default":"value"}}}'));
  const draft = createMcpElicitationDraft(fields);
  assert.equal(Object.hasOwn(draft, "__proto__"), true);
  assert.equal(Object.getPrototypeOf(draft), Object.prototype);
  const content = validate(fields, draft).content!;
  assert.equal(Object.hasOwn(content, "__proto__"), true);
  assert.equal(content.__proto__, "safe");
  assert.equal(Object.getPrototypeOf(content), Object.prototype);
});
