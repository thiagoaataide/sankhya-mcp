import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireCjs = createRequire(import.meta.url);
const { install, hookEntry } = requireCjs(join(root, "scripts/install-user-hook.cjs"));

test("installs hook and writes matcher including Sankhya HTTP", () => {
  const home = mkdtempSync(join(tmpdir(), "sankhya-hook-"));
  const result = install(home);
  const config = JSON.parse(readFileSync(result.userConfig, "utf8"));
  const entry = config.hooks.beforeShellExecution[0];
  assert.equal(entry.command, "node ./hooks/block-op-shell.cjs");
  assert.match(entry.matcher, /service\\.sbr/);
  assert.match(entry.matcher, /DbExplorerSP/);
  assert.equal(readFileSync(result.userHookFile, "utf8").includes("looksLikeSankhyaBypass"), true);
});

test("updates matcher of an existing block-op-shell entry", () => {
  const home = mkdtempSync(join(tmpdir(), "sankhya-hook-"));
  mkdirSync(join(home, ".cursor"), { recursive: true });
  writeFileSync(
    join(home, ".cursor", "hooks.json"),
    JSON.stringify({
      version: 1,
      hooks: {
        beforeShellExecution: [
          {
            command: "node ./hooks/block-op-shell.cjs",
            timeout: 10,
            failClosed: true,
            matcher: "op\\\\.exe",
          },
        ],
      },
    }),
  );
  install(home);
  const config = JSON.parse(readFileSync(join(home, ".cursor", "hooks.json"), "utf8"));
  assert.equal(config.hooks.beforeShellExecution.length, 1);
  assert.equal(config.hooks.beforeShellExecution[0].matcher, hookEntry().matcher);
  assert.match(config.hooks.beforeShellExecution[0].matcher, /snk\\.ativy|sankhya\\.com/);
});
