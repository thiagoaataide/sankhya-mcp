import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hook = join(root, ".cursor/hooks/block-op-shell.cjs");
const requireHook = createRequire(import.meta.url);
const { looksLikeOpCli, decide } = requireHook(hook);

test("blocks op item and op.exe", () => {
  assert.equal(looksLikeOpCli("op item list --vault abc"), true);
  assert.equal(looksLikeOpCli("& 'C:\\\\Program Files\\\\1Password CLI\\\\op.exe' item get Garra"), true);
  assert.equal(decide("op vault list").permission, "deny");
});

test("blocks install and where op", () => {
  assert.equal(looksLikeOpCli("winget install 1password-cli"), true);
  assert.equal(looksLikeOpCli("where op"), true);
});

test("allows normal agent shells", () => {
  assert.equal(looksLikeOpCli("git status"), false);
  assert.equal(looksLikeOpCli("npm install"), false);
  assert.equal(looksLikeOpCli("open README.md"), false);
  assert.equal(looksLikeOpCli("openssl version"), false);
  assert.equal(decide("git pull").permission, "allow");
});

test("hook process reads stdin JSON", () => {
  const ran = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ command: "op item list" }),
    encoding: "utf8",
  });
  assert.equal(ran.status, 0);
  assert.equal(JSON.parse(ran.stdout).permission, "deny");
});
