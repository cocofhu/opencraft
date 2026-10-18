import assert from "node:assert/strict";
import test, { after } from "node:test";
import React, { createElement } from "react";
// The root tsx harness uses classic JSX; the application Vite target uses automatic JSX.
const previousReact = Object.getOwnPropertyDescriptor(globalThis, "React");
Object.defineProperty(globalThis, "React", { configurable: true, value: React });
after(() => { if (previousReact) Object.defineProperty(globalThis, "React", previousReact); else Reflect.deleteProperty(globalThis, "React"); });
import { createIntl, RawIntlProvider } from "react-intl";
import { SidebarActivityItem } from "../apps/workbench-web/src/components/sidebar-activity-item";
import { renderToStaticMarkup } from "react-dom/server";
import { Palette, Brain, MessageSquare, Globe2, Blocks, Plus } from "lucide-react";
import { WorkbenchProductContext } from "../apps/workbench-web/src/workbench-product";
import { WorkbenchIcon } from "../apps/workbench-web/src/components/ui/workbench-icon";
import { NavigationIcon } from "../apps/workbench-web/src/components/shell-navigation/navigation-action";
import { SidebarToggleIcon } from "../apps/workbench-web/src/chrome-actions/sidebar-toggle-icon";
import { NewTaskIcon } from "../apps/workbench-web/src/chrome-actions/new-task-icon";
import { ReferenceNavigationIcon, ReferenceNewTaskIcon, ReferenceSidebarToggleIcon } from "./fixtures/vela-icon-reference";
const render = (component: ReturnType<typeof createElement>, product = "lightvela-web") => renderToStaticMarkup(createElement(WorkbenchProductContext.Provider, { value: product }, component));
const geometry = (markup: string) => [...markup.matchAll(/<(?:path|circle|rect|line|polyline|polygon|ellipse)\b[^>]*>/g)].map(match => match[0]);
for (const selected of [false,true]) test(`Downstream navigation retains the fixed old artwork, size and selected/silhouette state (${selected})`, () => {
  for (const name of ["chat","write","message-circle","cloud","database","folder","hard-drive","server","bot","settings","applications","columns","unknown","collaboration"]) {
    const actual=render(createElement(NavigationIcon,{name,selected}));
    const reference=renderToStaticMarkup(createElement(ReferenceNavigationIcon,{name,selected}));
    assert.equal(actual,reference,name);
  }
});
test("New task retains product artwork while panel toggles share the reference pair", () => {
  assert.equal(render(createElement(NewTaskIcon)),renderToStaticMarkup(createElement(ReferenceNewTaskIcon)));
  assert.notDeepEqual(geometry(render(createElement(NewTaskIcon),"opencraft")),geometry(render(createElement(NewTaskIcon))));
  for (const product of ["lightvela-web", "opencraft"]) for(const sidebarOpen of [false,true]) assert.equal(render(createElement(SidebarToggleIcon,{sidebarOpen}),product),renderToStaticMarkup(createElement(ReferenceSidebarToggleIcon,{sidebarOpen})));
});
test("semantic settings/panel icons retain old consumer-specific artwork and scale",()=>{
  for(const [name,purpose,Icon,size] of [["appearance","settings",Palette,16],["brain","settings",Brain,16],["chat","panel",MessageSquare,14],["browser","panel",Globe2,14],["activity","settings-page",Blocks,16],["changes","panel",Plus,14]] as const){
    const actual=render(createElement(WorkbenchIcon,{name,purpose}));
    const old=renderToStaticMarkup(createElement(Icon,{size,strokeWidth:2}));
    assert.deepEqual(geometry(actual),geometry(old));assert.match(actual,new RegExp(`width="${size}"`));assert.match(actual,/stroke-width="2"/);
  }
});


test("activity rows present a complete project badge without Server artwork", () => {
  const intl = createIntl({locale: "en-US", messages: {"sidebar.status.running": "Running"}});
  for (const twoLine of [false, true]) {
    const markup = renderToStaticMarkup(createElement(RawIntlProvider, {value: intl},
      createElement(SidebarActivityItem, {active: false, twoLine,
        onInvoke() {}, pending: false, project: "a-long-project-directory", selected: false,
        status: twoLine ? "running" : "ready", title: "Synthetic task", tooltip: "Unchanged row title"})));
    assert.match(markup, /title="Unchanged row title"/);
    assert.doesNotMatch(markup, /server-origin|server-dot|lucide-globe|lucide-folder/);
    assert.match(markup, /sidebar-activity-item__project">a-long-project-directory</);
  }
});
