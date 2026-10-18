import assert from "node:assert/strict";
import test from "node:test";
import { maskCodexAccountIdentity } from "../plugins/builtin-agents/src/codex-accounts/identity.js";

test("account display masks mailbox and private domain in email-based labels", () => {
  for (const [input, expected] of [
    ["person@example.com", "p***@e***.com"],
    ["a@b.co", "***@***.co"],
    ["staff+codex@private.example.org", "s***@p***.e***.org"],
    ["Team <person@example.com>", "Team <p***@e***.com>"],
    ["person@example.com / other@example.com", "p***@e***.com / o***@e***.com"],
    ["用户@企业.中国", "用***@企***.中国"],
    ["hello@localhost", "h***@l***"],
    ["错误：person@example.com", "错误：p***@e***.com"],
    ["Work account", "Work account"],
    ["", ""],
  ]) assert.equal(maskCodexAccountIdentity(input!), expected);
});
