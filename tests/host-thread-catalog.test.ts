import assert from "node:assert/strict";
import test from "node:test";
import { HostRuntimeRegistry, type AppServerWorkbenchRuntime, type HostConnectionProfile } from "@opencraft/workbench-runtime";
import type { SshConnectionView } from "@opencraft/app-host-protocol";
import { canDisplayHostThreadCatalog, canReadHostThreadCatalog, managedHostCatalogSignature, readHostThreadCatalog, type ManagedHostCatalogSnapshot } from "../apps/workbench-web/src/runtime/host-thread-catalog.js";

function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
const profile: HostConnectionProfile = {
  hostId: "ssh:fixture", displayName: "Fixture", providerId: "fixture", providerConfig: {}, providerConfigVersion: 1,
  hostKind: "remote-ssh", enabled: true, autoConnect: false, includeInSidebar: true, revision: 1,
  credentialRef: null, transportEndpoint: null, executionLocation: "Fixture", workspaceBrowseRoots: ["/remote"],
};
const row: SshConnectionView = { serverId: profile.hostId, displayName: "Fixture", workspaceBrowseRoots: ["/remote"],
  revision: 1, enabled: true, hostname: "fixture.invalid", port: 22, username: "fixture", fingerprint: `SHA256:${"a".repeat(43)}`, state: "open" };

function harness(initialProfile: HostConnectionProfile = profile) {
  let current: HostConnectionProfile | undefined = initialProfile;
  let snapshot: ManagedHostCatalogSnapshot = { available: true, authenticated: true, items: [row], legacyServers: [], refreshing: false, error: null };
  let authorizationEpoch = 0;
  const calls: string[] = [];
  let phase = "idle";
  let connectGate: Promise<void> = Promise.resolve(), listGate: Promise<void> = Promise.resolve();
  type Page = { data: Array<{ id: string; pinned?: boolean }>; nextCursor: string | null };
  let listPage: (params: { cursor: string | null; limit: number }) => Promise<Page> = async params => {
    assert.deepEqual(params, { cursor: null, limit: 50 });
    return { data: [{ id: "same-native-id" }], nextCursor: null };
  };
  const runtime = {
    getSnapshot: () => ({ phase }),
    async connect() { calls.push("connect"); phase = "connecting"; await connectGate; phase = "ready"; },
    async dispose() { calls.push("dispose"); phase = "disposed"; },
    resources: { threads: { async list(params: { cursor: string | null; limit: number }) { calls.push("thread/list");
      await listGate; return listPage(params); } } },
  } as unknown as AppServerWorkbenchRuntime;
  const registry = new HostRuntimeRegistry([{ descriptor: { hostId: profile.hostId, label: "Fixture", kind: "remote-ssh",
    transportEndpoint: null, executionLocation: "Fixture", workspaceBrowseRoots: ["/remote"] }, createRuntime: () => runtime }]);
  const source = { getSnapshot: () => snapshot, getAuthorizationEpoch: () => authorizationEpoch, subscribe: () => () => {}, refresh: async () => {} };
  return { calls, registry, source, read: () => readHostThreadCatalog({ profile: initialProfile, currentProfile: () => current, management: source, registry }),
    setCurrent: (value: HostConnectionProfile | undefined) => { current = value; },
    setSnapshot: (value: Partial<ManagedHostCatalogSnapshot>) => { snapshot = { ...snapshot, ...value }; },
    nextAuthorization: () => { authorizationEpoch++; },
    setListPage: (read: typeof listPage) => { listPage = read; },
    holdConnect: (gate: Promise<void>) => { connectGate = gate; }, holdList: (gate: Promise<void>) => { listGate = gate; } };
}

test("Chat catalog ignores healthy poll progress and fresh copies of unchanged responses", () => {
  const h = harness();
  const before = managedHostCatalogSignature(h.source);
  h.setSnapshot({ refreshing: true });
  assert.equal(managedHostCatalogSignature(h.source), before);
  h.setSnapshot({ refreshing: false, items: [structuredClone(row)], legacyServers: [] });
  assert.equal(managedHostCatalogSignature(h.source), before);
  assert.equal(managedHostCatalogSignature(null), null);
});

test("Chat catalog observes authorization epochs, configuration, physical state and legacy changes", () => {
  const changes: Array<(h: ReturnType<typeof harness>) => void> = [
    h => h.nextAuthorization(), // Same rows after reauthentication must still invalidate query keys.
    h => h.setSnapshot({ authenticated: false }),
    h => h.setSnapshot({ available: false }),
    h => h.setSnapshot({ items: [] }),
    h => h.setSnapshot({ items: [{ ...row, enabled: false }] }),
    h => h.setSnapshot({ items: [{ ...row, revision: 2 }] }),
    h => h.setSnapshot({ items: [{ ...row, state: "failed" }] }),
    h => h.setSnapshot({ items: [{ ...row, displayName: "Renamed" }] }),
    h => h.setSnapshot({ items: [{ ...row, workspaceBrowseRoots: ["/new-root"] }] }),
    h => h.setSnapshot({ legacyServers: [{ serverId: "legacy", displayName: "Legacy", workspaceBrowseRoots: [] }] }),
  ];
  for (const change of changes) {
    const h = harness();
    const before = managedHostCatalogSignature(h.source);
    change(h);
    assert.notEqual(managedHostCatalogSignature(h.source), before);
  }
});

test("Chat catalog retains cold discovery, error, retry and recovery updates", () => {
  const h = harness();
  const healthy = managedHostCatalogSignature(h.source);
  h.setSnapshot({ available: null });
  const cold = managedHostCatalogSignature(h.source);
  h.setSnapshot({ refreshing: true });
  assert.notEqual(managedHostCatalogSignature(h.source), cold);
  h.setSnapshot({ refreshing: false, error: "offline" });
  const failed = managedHostCatalogSignature(h.source);
  h.setSnapshot({ refreshing: true });
  assert.notEqual(managedHostCatalogSignature(h.source), failed);
  h.setSnapshot({ available: true, refreshing: false, error: null });
  assert.equal(managedHostCatalogSignature(h.source), healthy);
});

test("shared Sidebar and search catalog includes older pages and preserves authoritative native pins", async () => {
  for (const initialProfile of [profile, { ...profile, hostKind: "local" as const, autoConnect: true }]) {
    const h = harness(initialProfile), cursors: Array<string | null> = [];
    h.setListPage(async ({ cursor, limit }) => {
      cursors.push(cursor); assert.equal(limit, 50);
      if (cursor === null) return { data: [{ id: "old-pin", pinned: true }, ...Array.from({ length: 50 }, (_, n) => ({ id: `recent-${n}` }))], nextCursor: "page-2" };
      if (cursor === "page-2") return { data: [], nextCursor: "page-3" };
      assert.equal(cursor, "page-3");
      return { data: [{ id: "old-pin", pinned: false }, { id: "yesterday-cloud-desktop" }], nextCursor: null };
    });
    try {
      const result = await h.read();
      assert.deepEqual(cursors, [null, "page-2", "page-3"]);
      assert.equal(result.nextCursor, null);
      assert.equal(result.data.length, 52);
      assert.equal(result.data.at(-1)?.id, "yesterday-cloud-desktop");
      assert.equal(result.data.filter(row => row.id === "old-pin").length, 1);
      assert.equal(result.data[0]?.pinned, true);
      assert.deepEqual(h.calls, ["connect", "thread/list", "thread/list", "thread/list"]);
    } finally { await h.registry.dispose(); }
  }
});

test("failed or repeating later pages cannot publish a misleading complete catalog", async () => {
  for (const failure of ["request", "cursor"] as const) {
    const h = harness();
    h.setListPage(async ({ cursor }) => {
      if (cursor === null) return { data: [{ id: "recent" }], nextCursor: "next" };
      if (failure === "request") throw new Error("later page unavailable");
      return { data: [], nextCursor: "next" };
    });
    try {
      await assert.rejects(h.read(), failure === "request" ? /later page unavailable/ : /Repeated thread catalog cursor/);
      assert.deepEqual(h.calls, ["connect", "thread/list", "thread/list"]);
    } finally { await h.registry.dispose(); }
  }
});

test("authorization and recipe changes during pagination reject late history before another page", async () => {
  for (const change of ["authorization", "recipe", "remove"] as const) {
    const h = harness();
    h.setListPage(async ({ cursor }) => {
      if (cursor === null) return { data: [{ id: "recent" }], nextCursor: "next" };
      if (change === "authorization") h.nextAuthorization();
      if (change === "recipe") h.setCurrent({ ...profile, revision: 2 });
      if (change === "remove") h.setCurrent(undefined);
      return { data: [{ id: "private-old-history" }], nextCursor: "never-request" };
    });
    try {
      await assert.rejects(h.read(), /不可读取会话/);
      assert.deepEqual(h.calls, ["connect", "thread/list", "thread/list"]);
    } finally { await h.registry.dispose(); }
  }
});

test("an enabled but idle SSH recipe does not dial merely to discover history", async () => {
  const h = harness(); h.setSnapshot({ items: [{ ...row, state: "idle" }] });
  await assert.rejects(h.read(), /不可读取会话/);
  assert.deepEqual(h.calls, []); assert.equal(h.registry.peekRuntime(profile.hostId), null);
  await h.registry.dispose();
});

test("an explicitly open backend admits a logical catalog reader with no Thread activation", async () => {
  const h = harness(), gate = deferred(); h.holdConnect(gate.promise);
  const first = h.read(), second = h.read();
  assert.deepEqual(h.calls, ["connect"]); gate.resolve();
  const pages = await Promise.all([first, second]);
  assert.equal(pages[0].data[0]?.id, "same-native-id");
  assert.deepEqual(h.calls, ["connect", "thread/list", "thread/list"]);
  await h.registry.dispose();
});

test("lock or delete during logical attachment prevents the subsequent Thread read", async () => {
  for (const change of ["lock", "delete"] as const) {
    const h = harness(), gate = deferred(); h.holdConnect(gate.promise);
    const pending = h.read();
    h.setSnapshot(change === "lock" ? { authenticated: false } : { items: [] });
    gate.resolve(); await assert.rejects(pending, /不可读取会话/);
    assert.deepEqual(h.calls, ["connect"]); await h.registry.dispose();
  }
});

test("revocation, disablement and recipe replacement fence late catalog replies", async () => {
  for (const change of ["lock", "disable", "revision", "remove"] as const) {
    const h = harness(), gate = deferred(); h.holdList(gate.promise);
    const pending = h.read(); await new Promise(resolve => setImmediate(resolve));
    assert.ok(h.calls.includes("thread/list"));
    if (change === "lock") h.setSnapshot({ authenticated: false });
    if (change === "disable") h.setCurrent({ ...profile, enabled: false });
    if (change === "revision") h.setCurrent({ ...profile, revision: 2 });
    if (change === "remove") h.setCurrent(undefined);
    gate.resolve(); await assert.rejects(pending, /不可读取会话/); await h.registry.dispose();
  }
});

test("logout followed by unlock cannot publish an old authorization's late history", async () => {
  const h = harness(), gate = deferred(); h.holdList(gate.promise);
  const pending = h.read(); await new Promise(resolve => setImmediate(resolve));
  h.nextAuthorization(); // The new session can be authenticated with the same public config.
  gate.resolve(); await assert.rejects(pending, /不可读取会话/); await h.registry.dispose();
});

test("local discovery, explicit logical selection and static SSH compatibility retain their admission rules", () => {
  const management = { available: true, authenticated: true, items: [{ ...row, state: "idle" as const }], legacyServers: [], refreshing: false, error: null };
  assert.equal(canReadHostThreadCatalog(profile, "ready", management), true);
  assert.equal(canReadHostThreadCatalog(profile, "idle", management), false);
  assert.equal(canReadHostThreadCatalog(profile, "ready", { ...management, authenticated: false }), false);
  assert.equal(canReadHostThreadCatalog(profile, "ready", { ...management, items: [] }), false);
  assert.equal(canReadHostThreadCatalog(profile, "ready", { ...management, items: [], legacyServers: [row] }), true);
  assert.equal(canReadHostThreadCatalog(profile, "idle", null), false);
  assert.equal(canReadHostThreadCatalog({ ...profile, hostKind: "local", autoConnect: true }, "idle", null), true);
  assert.equal(canReadHostThreadCatalog({ ...profile, hostKind: "local", autoConnect: true }, "reconnecting", null), false);
  assert.equal(canReadHostThreadCatalog({ ...profile, autoConnect: true }, "error", null), false);
});

test("one Server's open state cannot admit another Server's history", () => {
  const management = { available: true, authenticated: true, items: [row], legacyServers: [], refreshing: false, error: null };
  assert.equal(canReadHostThreadCatalog({ ...profile, hostId: "ssh:second" }, "idle", management), false);
  assert.equal(canReadHostThreadCatalog(profile, "idle", management), true);
});

test("SSH logout does not invalidate an unrelated local Host's in-flight catalog", async () => {
  const h = harness({ ...profile, hostKind: "local", autoConnect: true }), gate = deferred(); h.holdList(gate.promise);
  const pending = h.read(); await new Promise(resolve => setImmediate(resolve));
  h.nextAuthorization(); h.setSnapshot({ authenticated: false, items: [] });
  gate.resolve(); assert.equal((await pending).data[0]?.id, "same-native-id"); await h.registry.dispose();
});


test("cached remote rows survive transport transitions without admitting offline reads", () => {
  for (const state of ["open", "connecting", "idle", "error"] as const) {
    const management: ManagedHostCatalogSnapshot = { available: true, authenticated: true,
      items: [{ ...row, state }], legacyServers: [], refreshing: false, error: null };
    assert.equal(canDisplayHostThreadCatalog(profile, management), true);
    assert.equal(canReadHostThreadCatalog(profile, "reconnecting", management), false);
    assert.equal(canReadHostThreadCatalog(profile, "error", management), false);
    assert.equal(canDisplayHostThreadCatalog(profile, { ...management, refreshing: true, error: "temporary" }), true);
    assert.equal(canDisplayHostThreadCatalog(profile, { ...management, authenticated: false }), false);
    assert.equal(canDisplayHostThreadCatalog(profile, { ...management, items: [] }), false);
    assert.equal(canDisplayHostThreadCatalog(profile, { ...management, items: [{ ...row, enabled: false }] }), false);
    assert.equal(canDisplayHostThreadCatalog(profile, { ...management, items: [{ ...row, revision: 2 }] }), false);
  }
  assert.equal(canDisplayHostThreadCatalog({ ...profile, enabled: false }, null), false);
  assert.equal(canDisplayHostThreadCatalog({ ...profile, includeInSidebar: false }, null), false);
});

test("stale open management observation cannot redial a reconnecting runtime", async () => {
  const h = harness();
  await h.registry.ensureConnected(profile.hostId);
  const runtime = h.registry.peekRuntime(profile.hostId)!;
  const originalSnapshot = runtime.getSnapshot;
  runtime.getSnapshot = () => ({ ...originalSnapshot(), phase: "reconnecting" });
  h.calls.length = 0;
  await assert.rejects(h.read(), /不可读取会话/);
  assert.deepEqual(h.calls, []);
  await h.registry.dispose();
});
