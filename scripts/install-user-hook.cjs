#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const { SHELL_HOOK_MATCHER } = require(path.join(__dirname, "..", ".cursor", "hooks", "block-op-shell.cjs"));

function hookEntry() {
  return {
    command: "node ./hooks/block-op-shell.cjs",
    timeout: 10,
    failClosed: true,
    matcher: SHELL_HOOK_MATCHER,
  };
}

function install(homeDir = process.env.SANKHYA_HOOK_HOME || os.homedir()) {
  const entry = hookEntry();
  const repoHook = path.join(__dirname, "..", ".cursor", "hooks", "block-op-shell.cjs");
  const userCursor = path.join(homeDir, ".cursor");
  const userHooksDir = path.join(userCursor, "hooks");
  const userHookFile = path.join(userHooksDir, "block-op-shell.cjs");
  const userConfig = path.join(userCursor, "hooks.json");

  if (!fs.existsSync(repoHook)) {
    throw new Error("Não achei .cursor/hooks/block-op-shell.cjs. Rode a partir do clone do sankhya-mcp.");
  }

  fs.mkdirSync(userHooksDir, { recursive: true });
  fs.copyFileSync(repoHook, userHookFile);

  let config = { version: 1, hooks: {} };
  if (fs.existsSync(userConfig)) {
    try {
      config = JSON.parse(fs.readFileSync(userConfig, "utf8"));
    } catch {
      throw new Error("hooks.json do usuário está inválido. Corrija o JSON e rode de novo.");
    }
  }
  config.version = config.version ?? 1;
  config.hooks = config.hooks ?? {};
  const list = Array.isArray(config.hooks.beforeShellExecution)
    ? config.hooks.beforeShellExecution
    : [];
  const alreadyIndex = list.findIndex((hook) => String(hook.command || "").includes("block-op-shell"));
  if (alreadyIndex >= 0) {
    list[alreadyIndex] = { ...list[alreadyIndex], ...entry };
  } else {
    list.push(entry);
  }
  config.hooks.beforeShellExecution = list;
  fs.writeFileSync(userConfig, `${JSON.stringify(config, null, 2)}\n`);

  return { userHookFile, userConfig };
}

module.exports = { install, hookEntry, SHELL_HOOK_MATCHER };

if (require.main === module) {
  try {
    const { userHookFile, userConfig } = install();
    console.log("Hook global instalado:");
    console.log(`  script: ${userHookFile}`);
    console.log(`  config: ${userConfig}`);
    console.log("Reinicie o Cursor. Vale em qualquer projeto neste Windows.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
