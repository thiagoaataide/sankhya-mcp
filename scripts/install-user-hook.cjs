#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const MATCHER =
  "op\\.exe|(^|[\\s;&|\\\\/'\"])op(\\s|$)|1password-cli|AgileBits\\.1Password|where\\s+op|Get-Command\\s+op";

const entry = {
  command: "node ./hooks/block-op-shell.cjs",
  timeout: 10,
  failClosed: true,
  matcher: MATCHER,
};

const repoHook = path.join(__dirname, "..", ".cursor", "hooks", "block-op-shell.cjs");
const userCursor = path.join(os.homedir(), ".cursor");
const userHooksDir = path.join(userCursor, "hooks");
const userHookFile = path.join(userHooksDir, "block-op-shell.cjs");
const userConfig = path.join(userCursor, "hooks.json");

if (!fs.existsSync(repoHook)) {
  console.error("Não achei .cursor/hooks/block-op-shell.cjs. Rode a partir do clone do sankhya-mcp.");
  process.exit(1);
}

fs.mkdirSync(userHooksDir, { recursive: true });
fs.copyFileSync(repoHook, userHookFile);

let config = { version: 1, hooks: {} };
if (fs.existsSync(userConfig)) {
  try {
    config = JSON.parse(fs.readFileSync(userConfig, "utf8"));
  } catch {
    console.error("hooks.json do usuário está inválido. Corrija o JSON e rode de novo.");
    process.exit(1);
  }
}
config.version = config.version ?? 1;
config.hooks = config.hooks ?? {};
const list = Array.isArray(config.hooks.beforeShellExecution)
  ? config.hooks.beforeShellExecution
  : [];
const already = list.some((hook) => String(hook.command || "").includes("block-op-shell"));
if (!already) {
  list.push(entry);
}
config.hooks.beforeShellExecution = list;
fs.writeFileSync(userConfig, `${JSON.stringify(config, null, 2)}\n`);

console.log("Hook global instalado:");
console.log(`  script: ${userHookFile}`);
console.log(`  config: ${userConfig}`);
console.log("Reinicie o Cursor. Vale em qualquer projeto neste Windows.");
