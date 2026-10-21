import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createIntl, RawIntlProvider } from "react-intl";
import { MessageTimestamp } from "../apps/workbench-web/src/components/conversation/message-timestamp";

const render = (sentAtMs: number | null | undefined, locale = "en-US", assistant = false) =>
  renderToStaticMarkup(<RawIntlProvider value={createIntl({ locale, defaultLocale: locale, messages: {} })}>
    <MessageTimestamp sentAtMs={sentAtMs} assistant={assistant} />
  </RawIntlProvider>);
const label = (html: string) => html.match(/>([^<]*)<\/time>/)?.[1];

function freeze(t: TestContext, now: string, zone = "Asia/Shanghai") {
  const previousZone = process.env.TZ;
  process.env.TZ = zone;
  t.after(() => { if (previousZone === undefined) delete process.env.TZ; else process.env.TZ = previousZone; });
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(now) });
}

test("both roles use the same unpadded English clock, canonical instant and full title", t => {
  freeze(t, "2026-10-21T15:00:00+08:00");
  const instant = Date.parse("2026-10-21T14:33:00+08:00");
  const user = render(instant); const assistant = render(instant, "en-US", true);
  assert.equal(label(user), "2:33 PM");
  assert.equal(label(assistant), label(user));
  assert.match(assistant, /data-assistant-message-sent-time=""/);
  assert.match(user, /dateTime="2026-10-21T06:33:00.000Z"/i);
  assert.match(user, /title="[^"]*2026[^"]*GMT\+8/);
});

test("today, six days, seven days, another year and future use calendar boundaries", t => {
  freeze(t, "2026-10-21T15:00:00+08:00");
  for (const [sent, expected] of [
    ["2026-10-21", "2:33 PM"], ["2026-10-20", "Tuesday 2:33 PM"],
    ["2026-10-15", "Thursday 2:33 PM"], ["2026-10-14", "Oct 14, 2:33 PM"],
    ["2025-12-31", "Dec 31, 2:33 PM"], ["2026-10-22", "Oct 22, 2:33 PM"],
  ]) assert.equal(label(render(Date.parse(`${sent}T14:33:00+08:00`))), expected);
});

test("application Chinese locale formats both roles independently of the host language", t => {
  freeze(t, "2026-10-21T15:00:00+08:00");
  const instant = Date.parse("2026-10-21T14:33:00+08:00");
  assert.equal(label(render(instant, "zh-CN")), "14:33");
  assert.equal(label(render(instant, "zh-CN", true)), "14:33");
});

test("local midnight and DST do not turn calendar days into elapsed-hour days", t => {
  freeze(t, "2026-03-09T00:05:00-04:00", "America/New_York");
  assert.equal(label(render(Date.parse("2026-03-08T23:55:00-04:00"))), "Sunday 11:55 PM");
  assert.equal(label(render(Date.parse("2026-03-03T23:55:00-05:00"))), "Tuesday 11:55 PM");
  assert.equal(label(render(Date.parse("2026-03-02T23:55:00-05:00"))), "Mar 2, 11:55 PM");
});

test("missing and invalid clocks are omitted while epoch zero remains real", t => {
  freeze(t, "2026-10-21T15:00:00+08:00");
  for (const value of [null, undefined, NaN, Infinity, 9e15]) assert.equal(render(value), "");
  assert.match(render(0), /1970-01-01T00:00:00.000Z/);
});
