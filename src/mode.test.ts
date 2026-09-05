import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAuthMode } from "./mode.js";

test("default is direct when item is a plain Login", () => {
  const resolved = resolveAuthMode({
    title: "Fralia",
    username: "sup",
    password: "x",
    baseUrl: "http://erp.example:8280",
  });
  assert.equal(resolved.mode, "direct");
  assert.equal(resolved.warning, undefined);
});

test("gateway requires mode plus the three keys", () => {
  const resolved = resolveAuthMode({
    title: "Acme",
    modeField: "gateway",
    clientId: "id",
    clientSecret: "secret",
    xToken: "xt",
  });
  assert.equal(resolved.mode, "gateway");
  assert.equal(resolved.warning, undefined);
});

test("mode=gateway without keys stays direct and warns", () => {
  const resolved = resolveAuthMode({
    title: "Acme",
    modeField: "gateway",
    clientId: "id",
  });
  assert.equal(resolved.mode, "direct");
  assert.match(resolved.warning ?? "", /faltam/);
});

test("gateway keys without mode stay direct and warn", () => {
  const resolved = resolveAuthMode({
    title: "Acme",
    clientId: "id",
    clientSecret: "secret",
    xToken: "xt",
  });
  assert.equal(resolved.mode, "direct");
  assert.match(resolved.warning ?? "", /mode não é gateway/);
});
