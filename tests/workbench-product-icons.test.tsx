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
import { Palette, Brain, BrainCircuit, MessageSquare, Globe2, Activity, Plus, Server, UserRoundCog, SlidersHorizontal, UserRound, ListTodo, MessagesSquare, Blocks, CircleHelp } from "lucide-react";
import { WorkbenchProductContext, WorkbenchPresentationContext } from "../apps/workbench-web/src/workbench-product";
import { WorkbenchIcon } from "../apps/workbench-web/src/components/ui/workbench-icon";
import { NavigationIcon } from "../apps/workbench-web/src/components/shell-navigation/navigation-action";
import { SidebarToggleIcon } from "../apps/workbench-web/src/chrome-actions/sidebar-toggle-icon";
import { NewTaskIcon } from "../apps/workbench-web/src/chrome-actions/new-task-icon";
import { ReferenceNavigationIcon, ReferenceNewTaskIcon, ReferenceSidebarToggleIcon } from "./fixtures/vela-icon-reference";
import { resolveWorkbenchPresentation } from "../apps/workbench-web/src/workbench-presentation";
const render = (component: ReturnType<typeof createElement>, iconStyle: "classic" | "standard" = "classic") => renderToStaticMarkup(createElement(WorkbenchPresentationContext.Provider, { value: resolveWorkbenchPresentation({iconStyle}) }, component));
const geometry = (markup: string) => [...markup.matchAll(/<(?:path|circle|rect|line|polyline|polygon|ellipse)\b[^>]*>/g)].map(match => match[0]);
for (const selected of [false,true]) test(`Downstream navigation retains the fixed old artwork, size and selected/silhouette state (${selected})`, () => {
  for (const name of ["chat","write","message-circle","cloud","database","folder","hard-drive","server","bot","settings","applications","columns","unknown"]) {
    const actual=render(createElement(NavigationIcon,{name,selected}));
    const reference=renderToStaticMarkup(createElement(ReferenceNavigationIcon,{name,selected}));
    assert.equal(actual,reference,name);
  }
});
test("New task retains product artwork while panel toggles share the reference pair", () => {
  assert.equal(render(createElement(NewTaskIcon)),renderToStaticMarkup(createElement(ReferenceNewTaskIcon)));
  assert.notDeepEqual(geometry(render(createElement(NewTaskIcon),"standard")),geometry(render(createElement(NewTaskIcon))));
  for (const product of ["classic", "standard"] as const) for(const sidebarOpen of [false,true]) assert.equal(render(createElement(SidebarToggleIcon,{sidebarOpen}),product),renderToStaticMarkup(createElement(ReferenceSidebarToggleIcon,{sidebarOpen})));
});
test("semantic settings/panel icons retain old consumer-specific artwork and scale",()=>{
  for(const [name,purpose,Icon,size] of [["appearance","settings",Palette,16],["brain","settings",Brain,16],["chat","panel",MessageSquare,14],["browser","panel",Globe2,14],["activity","settings-page",Activity,16],["changes","panel",Plus,14]] as const){
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

test("identity alone never selects a different icon family", () => {
  const renderIdentity = (id: string) => renderToStaticMarkup(createElement(WorkbenchProductContext.Provider,
    {value: id}, createElement(WorkbenchIcon, {name: "appearance"})));
  assert.equal(renderIdentity("lightvela-web"), renderIdentity("an-unrelated-product"));
  assert.match(renderIdentity("lightvela-web"), /lucide-sun-moon/);
});


test("contributed settings and navigation honor semantic icons in both presentation styles", () => {
  // These are the actual settings contribution names, plus plugin navigation.
  const icons = [["brain", Brain], ["server", Server], ["user-round-cog", UserRoundCog],
    ["sliders", SlidersHorizontal], ["user", UserRound], ["tasks", ListTodo],
    ["collaboration", MessagesSquare]] as const;
  for (const style of ["classic", "standard"] as const) {
    for (const [name, Icon] of icons) {
      const expected = geometry(renderToStaticMarkup(createElement(name === "brain" && style === "standard" ? BrainCircuit : Icon)));
      for (const purpose of ["settings-page", "navigation"] as const) {
        const actual = render(createElement(WorkbenchIcon, { name, purpose }), style);
        assert.deepEqual(geometry(actual), expected, `${style}/${purpose}/${name}`);
        assert.match(actual, /aria-hidden="true"/);
        assert.match(actual, /focusable="false"/);
        assert.match(actual, new RegExp(`width="${purpose === "navigation" ? style === "classic" ? 15 : 14 : 16}"`));
      }
      for (const selected of [false, true]) {
        const actual = render(createElement(NavigationIcon, { name, selected }), style);
        assert.deepEqual(geometry(actual), expected, `${style}/selected=${selected}/${name}`);
        assert.match(actual, /fill="none"/);
      }
    }
    for (const name of [undefined, "unsupported-icon", "constructor", "__proto__"]) {
      for (const purpose of ["settings-page", "navigation"] as const) {
        const actual = render(createElement(WorkbenchIcon, { name, purpose }), style);
        const Fallback = style === "classic" || purpose === "navigation" ? Blocks : CircleHelp;
        assert.deepEqual(geometry(actual), geometry(renderToStaticMarkup(createElement(Fallback))));
      }
    }
  }
});
