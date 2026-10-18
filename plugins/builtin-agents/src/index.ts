import { createDeferredView } from "@opencraft/extension-react";
import type { DuplexTransport } from "@opencraft/appserver-client/transport";
import type { TrustedExtensionDefinition } from "@opencraft/extension-runtime";
import {
  HOST_PROFILE_CONTRIBUTION_CHANNEL,
  type HostConnectionJson,
  type HostConnectionProvider,
  type HostConnectionProviderContext,
} from "@opencraft/workbench-runtime";
import { LocalAgentSettingsService, type HostProtocolRequest } from "./local-agent-settings-service";
import { ModelServicesController } from "./model-services/controller";
import { CodexAccountsService } from "./codex-accounts/service";
import { SshConnectionsController } from "./ssh-connections/controller";
export { SshConnectionsController, type SshDiscoveryLifecycle } from "./ssh-connections/controller";

type LocalAgentConfig = Readonly<Record<string, never>>;

function validate(value: HostConnectionJson): LocalAgentConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("Local Agent connection config must be an object");
  return Object.freeze({});
}

export type BuiltinAgentsExtensionOptions =
  | {
      readonly platform?: "electron";
      readonly requestHost: HostProtocolRequest;
      readonly createTransport: (hostId: string) => DuplexTransport;
    }
  | {
      readonly platform: "web";
      /** Server deployments contribute their own account page. */
      readonly includeCodexAccounts?: boolean;
      readonly requestHost: HostProtocolRequest;
    };

export interface HeadlessCodexExtensionOptions {
  readonly requestHost: HostProtocolRequest;
  readonly createTransport: (hostId: string) => DuplexTransport;
  readonly workspaceBrowseRoots: readonly string[];
  readonly sshServers?: readonly { readonly serverId: string; readonly displayName: string; readonly workspaceBrowseRoots: readonly string[] }[];
  readonly sshManagement?: SshConnectionsController;
}

export function createHeadlessModelServicesExtension(options: {
  readonly requestHost: HostProtocolRequest;
  readonly hostId: string;
}): TrustedExtensionDefinition {
  return {
    manifest: {
      manifestVersion: 1,
      id: "vela.headless-model-services",
      name: "Server Model Services",
      description: "Configures models on the OpenCraft server that owns execution.",
      version: "0.1.0",
      apiVersion: 1,
      trust: "trusted",
      platforms: ["web"],
      activationEvents: ["onStartupFinished"],
    },
    activate(api) {
      const service = new LocalAgentSettingsService(options.requestHost, options.hostId);
      const controller = new ModelServicesController(service);
      api.views.register({ id: "vela.headless-model-services.view", title: "模型服务", viewType: "vela.headless-model-services", platforms: ["web"] });
      api.settings.registerPage({ id: "vela.headless-model-services", title: "Model services", titleMessage: { id: "settings.contributions.modelServices", defaultMessage: "Model services" }, viewId: "vela.headless-model-services.view", layout: "master-detail", group: "Server", groupMessage: { id: "settings.groups.server", defaultMessage: "Server" }, icon: "brain", platforms: ["web"] });
      api.internal.register("platformViewRenderer", { viewType: "vela.headless-model-services", Component: createDeferredView(async () => (await import("./model-services/view")).createModelServicesView(controller)) });
      api.subscriptions.add(() => { controller.dispose(); service.dispose(); });
    },
  };
}

export function createHeadlessCodexExtension(options: HeadlessCodexExtensionOptions): TrustedExtensionDefinition {
  const config = validate({});
  const hostProvider: HostConnectionProvider = Object.freeze({
    id: "vela.headless-codex",
    label: "Join",
    targets: ["web"] as const,
    configVersion: 1,
    validate,
    createTransport(_config: HostConnectionJson, context: HostConnectionProviderContext) {
      return options.createTransport(context.hostId);
    },
  });
  return {
    manifest: {
      manifestVersion: 1,
      id: "vela.headless-codex",
      name: "Server Codex",
      description: "Connects the browser Workbench to the server-owned Codex Host.",
      version: "0.1.0",
      apiVersion: 1,
      trust: "trusted",
      platforms: ["web"],
      activationEvents: ["onStartupFinished"],
    },
    activate(api) {
      const accounts = new CodexAccountsService(options.requestHost, "local-codex");
      const sshManagement = options.sshManagement;
      if (sshManagement && sshManagement.getSnapshot().available !== false) {
        api.views.register({ id: "vela.headless-codex.ssh-view", title: "远程连接", viewType: "vela.headless-codex.ssh", platforms: ["web"] });
        api.settings.registerPage({ id: "vela.headless-codex.ssh", title: "Remote connections", titleMessage: { id: "settings.contributions.remoteConnections", defaultMessage: "Remote connections" }, viewId: "vela.headless-codex.ssh-view", group: "Server", groupMessage: { id: "settings.groups.server", defaultMessage: "Server" }, icon: "server", platforms: ["web"] });
        api.internal.register("platformViewRenderer", { viewType: "vela.headless-codex.ssh", Component: createDeferredView(async () => (await import("./ssh-connections/view")).createSshConnectionsView(sshManagement)) });
      }
      api.views.register({ id: "vela.headless-codex.accounts-view", title: "Codex 账户", viewType: "vela.headless-codex.accounts", platforms: ["web"] });
      api.settings.registerPage({ id: "vela.headless-codex.accounts", title: "Codex accounts", titleMessage: { id: "settings.contributions.codexAccounts", defaultMessage: "Codex accounts" }, viewId: "vela.headless-codex.accounts-view", group: "Server", groupMessage: { id: "settings.groups.server", defaultMessage: "Server" }, icon: "user-round-cog", platforms: ["web"] });
      api.internal.register("platformViewRenderer", { viewType: "vela.headless-codex.accounts", Component: createDeferredView(async () => (await import("./codex-accounts/view")).createCodexAccountsView(accounts, { allowImport: false, credentialLocation: "服务器" })) });
      api.subscriptions.add(() => accounts.dispose());
      api.internal.register("hostConnectionProvider", hostProvider);
      api.internal.register(HOST_PROFILE_CONTRIBUTION_CHANNEL, {
        profile: {
          hostId: "local-codex",
          displayName: "Join",
          providerId: hostProvider.id,
          providerConfig: config,
          providerConfigVersion: 1,
          hostKind: "durable",
          enabled: true,
          autoConnect: true,
          includeInSidebar: true,
          credentialRef: null,
          transportEndpoint: "Join",
          executionLocation: "This server · Join",
          workspaceBrowseRoots: options.workspaceBrowseRoots,
          revision: 0,
        },
      });
      for (const server of options.sshServers ?? []) api.internal.register(HOST_PROFILE_CONTRIBUTION_CHANNEL, {
        profile: {
          hostId: server.serverId,
          displayName: server.displayName,
          providerId: hostProvider.id,
          providerConfig: config,
          providerConfigVersion: 1,
          hostKind: "remote-ssh",
          enabled: true,
          autoConnect: false,
          includeInSidebar: true,
          credentialRef: null,
          transportEndpoint: null,
          executionLocation: server.displayName,
          workspaceBrowseRoots: server.workspaceBrowseRoots,
          revision: 0,
        },
      });
    },
  };
}

export function createBuiltinAgentsExtension(options: BuiltinAgentsExtensionOptions): TrustedExtensionDefinition {
  const platform = options.platform ?? "electron";
  const config = validate({});
  const hostProvider: HostConnectionProvider | null = options.platform === "web" ? null : Object.freeze({
    id: "vela.builtin-agents",
    label: "OpenCraft Local Agent",
    targets: ["electron"] as const,
    configVersion: 1,
    validate,
    createTransport(_config: HostConnectionJson, context: HostConnectionProviderContext) {
      return options.createTransport(context.hostId);
    },
  });
  return {
    manifest: {
      manifestVersion: 1,
      id: "vela.builtin-agents",
      name: "Built-in Agents",
      description: "Connects the workbench to the OpenCraft-owned local AppServer host.",
      version: "0.1.0",
      apiVersion: 1,
      trust: "trusted",
      platforms: [platform],
      activationEvents: ["onStartupFinished"],
    },
    activate(api) {
      const service = new LocalAgentSettingsService(options.requestHost, "local");
      const controller = new ModelServicesController(service);
      const codexAccounts = options.platform === "web" && options.includeCodexAccounts === false
        ? null : new CodexAccountsService(options.requestHost, "local-codex");
      api.views.register({ id: "vela.builtin-agents.model-services-view", title: "模型服务", viewType: "vela.builtin-agents.model-services", platforms: [platform] });
      api.settings.registerPage({ id: "vela.builtin-agents.model-services", title: "Model services", titleMessage: { id: "settings.contributions.modelServices", defaultMessage: "Model services" }, viewId: "vela.builtin-agents.model-services-view", layout: "master-detail", targetHostId: service.hostId, icon: "brain", platforms: [platform] });
      api.internal.register("platformViewRenderer", { viewType: "vela.builtin-agents.model-services", Component: createDeferredView(async () => (await import("./model-services/view")).createModelServicesView(controller)) });
      if (codexAccounts !== null) {
        api.views.register({ id: "vela.builtin-agents.codex-accounts-view", title: "Codex 账户", viewType: "vela.builtin-agents.codex-accounts", platforms: [platform] });
        api.settings.registerPage({ id: "vela.builtin-agents.codex-accounts", title: "Codex accounts", titleMessage: { id: "settings.contributions.codexAccounts", defaultMessage: "Codex accounts" }, viewId: "vela.builtin-agents.codex-accounts-view", targetHostId: codexAccounts.hostId, icon: "user-round-cog", platforms: [platform] });
        api.internal.register("platformViewRenderer", { viewType: "vela.builtin-agents.codex-accounts", Component: createDeferredView(async () => (await import("./codex-accounts/view")).createCodexAccountsView(codexAccounts)) });
      }
      api.subscriptions.add(() => { codexAccounts?.dispose(); controller.dispose(); service.dispose(); });
      if (hostProvider === null) return;
      api.internal.register("hostConnectionProvider", hostProvider);
      api.internal.register(HOST_PROFILE_CONTRIBUTION_CHANNEL, {
        profile: {
          hostId: "local",
          displayName: "OpenCraft",
          providerId: hostProvider.id,
          providerConfig: config,
          providerConfigVersion: 1,
          hostKind: "local",
          enabled: true,
          autoConnect: true,
          includeInSidebar: true,
          credentialRef: null,
          transportEndpoint: "OpenCraft Daemon",
          executionLocation: null,
          workspaceBrowseRoots: [],
          revision: 0,
        },
      });
      api.internal.register(HOST_PROFILE_CONTRIBUTION_CHANNEL, {
        profile: {
          hostId: "local-codex",
          displayName: "Join",
          providerId: hostProvider.id,
          providerConfig: config,
          providerConfigVersion: 1,
          hostKind: "local",
          enabled: true,
          autoConnect: true,
          includeInSidebar: true,
          credentialRef: null,
          transportEndpoint: "OpenCraft Daemon",
          executionLocation: null,
          workspaceBrowseRoots: [],
          revision: 0,
        },
      });
    },
  };
}
