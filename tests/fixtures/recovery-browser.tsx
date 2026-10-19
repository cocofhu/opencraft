import React, { useSyncExternalStore } from "react";
import { createIntlTestRoot as createRoot } from "./intl-root";
import { Context } from "@deepseek-ai/cordis";
import { WebSocketTransport } from "@opencraft/appserver-transport-websocket";
import { createAppServerWorkbenchRuntime } from "@opencraft/workbench-runtime";
import { buildCodexThemeCssProperties } from "@opencraft/design-system/theme-engine";
import { TimelineBlockRendererProvider, TimelineBlockRendererRegistryService } from "@opencraft/timeline-render-react";
import { Conversation } from "../../apps/workbench-web/src/components/conversation";
import { BuiltinTimelineRendererPlugin } from "../../apps/workbench-web/src/components/conversation-renderers/builtin-timeline-renderer-plugin";
import { reportRecoveryEvent } from "../../apps/workbench-web/src/runtime/recovery-diagnostics";
import "../../apps/workbench-web/src/styles/app.scss";
const ctx = new Context();
await ctx.plugin(TimelineBlockRendererRegistryService);
await ctx.plugin(BuiltinTimelineRendererPlugin);
document.documentElement.dataset.theme = "light";
for (const [key, value] of Object.entries(buildCodexThemeCssProperties("light"))) document.documentElement.style.setProperty(key, value);
const trace: Record<string, string | number>[] = [];
const runtime = createAppServerWorkbenchRuntime({hostId:"fixture",autoReconnect:true,reconnectDelaysMs:[50,100,250],requestTimeoutMs:500,
  createTransport:()=>new WebSocketTransport({url:location.origin.replace(/^http/,"ws")+"/fixture-rpc"}),
  onRecoveryEvent:event=>{trace.push({...event});reportRecoveryEvent(event);},
});
await runtime.connect();
const lease = await runtime.acquireThread("s"); lease.setRecoveryVisibility(true);
(window as any).recovery = { trace, navigation:lease.getNavigation(), snapshot:lease.getSnapshot, revalidate:()=>lease.retryRestore(), loadOlder:()=>lease.loadOlder(), runtime:runtime.getSnapshot };
function Demo() {
 const state = useSyncExternalStore(lease.subscribe,lease.getSnapshot,lease.getSnapshot);
 return <div style={{width:"100vw",height:"100vh"}} data-authoritative={String(state.authoritative)}>
 <TimelineBlockRendererProvider registry={ctx.timelineBlockRenderers}>
 <Conversation timeline={state.timeline} threadDetailLevel="STEPS_PROSE" scrollPolicy="response-placement"
 footer={<textarea aria-label="Unsent draft" defaultValue="Draft preserved across recovery" />} />
 </TimelineBlockRendererProvider></div>;
}
createRoot(document.getElementById("root")!).render(<Demo />);
