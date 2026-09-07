#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const TEAM_VAULT_ID = "tkrys7yhgj64dmo643ovrxa7ie";
const GET_REMOTE = "git@github.com:GRUPO-GET/sankhya-mcp.git";
const GET_REMOTE_NAME = "get";
const DEFAULT_WINDOWS_ROOT = "C:\\projetos\\sankhya-mcp";

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function installRoot(env = process.env) {
  const explicit = env.SANKHYA_INSTALL_ROOT?.trim();
  if (explicit) {
    return explicit;
  }
  if (process.platform === "win32") {
    return DEFAULT_WINDOWS_ROOT;
  }
  return repoRoot();
}

function installHome(env = process.env) {
  return env.SANKHYA_INSTALL_HOME?.trim() || os.homedir();
}

function mcpEnv(extra = {}) {
  const env = {
    SANKHYA_OP_VAULT: extra.SANKHYA_OP_VAULT || process.env.SANKHYA_OP_VAULT || TEAM_VAULT_ID,
  };
  const opBin = extra.SANKHYA_OP_BIN || process.env.SANKHYA_OP_BIN;
  if (opBin?.trim()) {
    env.SANKHYA_OP_BIN = opBin.trim();
  }
  return env;
}

function cursorServerEntry(root, extraEnv = {}) {
  return {
    command: path.join(root, "scripts", "sankhya-mcp.cmd"),
    env: mcpEnv(extraEnv),
  };
}

function upsertCursorMcp(raw, root, extraEnv = {}) {
  let config = { mcpServers: {} };
  const text = String(raw || "").replace(/^\uFEFF/, "").trim();
  if (text) {
    try {
      config = JSON.parse(text);
    } catch {
      throw new Error("mcp.json do Cursor está inválido. Corrija o JSON e rode o instalador de novo.");
    }
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    config = { mcpServers: {} };
  }
  config.mcpServers = config.mcpServers && typeof config.mcpServers === "object" ? config.mcpServers : {};
  const previous = config.mcpServers.sankhya && typeof config.mcpServers.sankhya === "object" ? config.mcpServers.sankhya : {};
  const next = cursorServerEntry(root, extraEnv);
  config.mcpServers.sankhya = {
    ...previous,
    command: next.command,
    env: { ...(previous.env || {}), ...next.env },
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}

function tomlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function tomlBasic(value) {
  return JSON.stringify(String(value));
}

function codexSankhyaBlock(root, extraEnv = {}, nodeBin = process.execPath) {
  const env = mcpEnv(extraEnv);
  const indexJs = path.join(root, "dist", "index.js");
  const lines = [
    "[mcp_servers.sankhya]",
    `command = ${tomlLiteral(nodeBin)}`,
    `args = [${tomlBasic(indexJs)}]`,
    `cwd = ${tomlLiteral(root)}`,
    "startup_timeout_sec = 30",
    "tool_timeout_sec = 120",
    "",
    "[mcp_servers.sankhya.env]",
  ];
  for (const [key, value] of Object.entries(env)) {
    lines.push(`${key} = ${tomlBasic(value)}`);
  }
  lines.push("");
  return lines.join("\n");
}

function upsertCodexToml(raw, root, extraEnv = {}, nodeBin = process.execPath) {
  const text = String(raw || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const kept = [];
  let skipping = false;
  for (const line of text.split("\n")) {
    const header = line.match(/^\[([^\]]+)\]\s*$/);
    if (header) {
      const name = header[1];
      skipping = name === "mcp_servers.sankhya" || name.startsWith("mcp_servers.sankhya.");
    }
    if (!skipping) {
      kept.push(line);
    }
  }
  while (kept.length && kept[kept.length - 1] === "") {
    kept.pop();
  }
  const prefix = kept.join("\n").trimEnd();
  const block = codexSankhyaBlock(root, extraEnv, nodeBin);
  if (!prefix) {
    return `${block}`;
  }
  return `${prefix}\n\n${block}`;
}

function writeUtf8(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
}

function copyUserRule(home, fromRoot) {
  const src = path.join(fromRoot, ".cursor", "rules", "sankhya-mcp.mdc");
  if (!fs.existsSync(src)) {
    return null;
  }
  const dest = path.join(home, ".cursor", "rules", "sankhya-mcp.mdc");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return dest;
}

function appendCodexAgents(home) {
  const dest = path.join(home, ".codex", "AGENTS.md");
  const marker = "sankhya_execute_query";
  const section = [
    "## Sankhya Om",
    "",
    "Consulta SQL e login no Sankhya Om: use **somente** as tools MCP `sankhya_list_profiles`, `sankhya_execute_query` e `sankhya_status`.",
    "Não use `op`, `curl`, `Invoke-WebRequest` nem scripts contra `service.sbr` / `/mge/`.",
    "",
  ].join("\n");
  if (fs.existsSync(dest)) {
    const current = fs.readFileSync(dest, "utf8");
    if (current.includes(marker)) {
      return dest;
    }
    const joined = current.endsWith("\n") || current.length === 0 ? current : `${current}\n`;
    fs.writeFileSync(dest, `${joined}\n${section}`, "utf8");
    return dest;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${section}`, "utf8");
  return dest;
}

function git(args, cwd) {
  return spawnSync("git", args, { cwd, encoding: "utf8" });
}

function ensureGitRemote(cwd, name, url) {
  const listed = git(["remote"], cwd);
  if (listed.status !== 0) {
    throw new Error(`git remote falhou em ${cwd}: ${(listed.stderr || listed.stdout || "").trim()}`);
  }
  const names = (listed.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!names.includes(name)) {
    const added = git(["remote", "add", name, url], cwd);
    if (added.status !== 0) {
      throw new Error(`Não consegui adicionar remote ${name}: ${(added.stderr || added.stdout || "").trim()}`);
    }
    return "added";
  }
  const current = git(["remote", "get-url", name], cwd);
  if (current.status !== 0) {
    throw new Error(`Não li a URL do remote ${name}.`);
  }
  if (String(current.stdout || "").trim() !== url) {
    const updated = git(["remote", "set-url", name, url], cwd);
    if (updated.status !== 0) {
      throw new Error(`Não atualizei o remote ${name}.`);
    }
    return "updated";
  }
  return "ok";
}

function ensureCompanyRemote(cwd) {
  const result = { get: ensureGitRemote(cwd, GET_REMOTE_NAME, GET_REMOTE) };
  const remotes = git(["remote"], cwd);
  const names = (remotes.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!names.includes("origin")) {
    result.origin = ensureGitRemote(cwd, "origin", GET_REMOTE);
  }
  return result;
}

function installConfigs({
  root = installRoot(),
  home = installHome(),
  extraEnv = {},
  nodeBin = process.execPath,
  skipHook = false,
} = {}) {
  const cursorFile = path.join(home, ".cursor", "mcp.json");
  const cursorRaw = fs.existsSync(cursorFile) ? fs.readFileSync(cursorFile, "utf8") : "";
  writeUtf8(cursorFile, upsertCursorMcp(cursorRaw, root, extraEnv));

  const codexFile = path.join(home, ".codex", "config.toml");
  const codexRaw = fs.existsSync(codexFile) ? fs.readFileSync(codexFile, "utf8") : "";
  writeUtf8(codexFile, upsertCodexToml(codexRaw, root, extraEnv, nodeBin));

  const ruleFile = copyUserRule(home, repoRoot());
  const agentsFile = appendCodexAgents(home);

  let hook = null;
  if (!skipHook) {
    const { install } = require(path.join(__dirname, "install-user-hook.cjs"));
    hook = install(home);
  }

  let remotes = null;
  if (fs.existsSync(path.join(root, ".git"))) {
    remotes = ensureCompanyRemote(root);
  }

  return {
    root,
    cursorFile,
    codexFile,
    ruleFile,
    agentsFile,
    hook,
    remotes,
  };
}

function main() {
  const root = installRoot();
  const dist = path.join(root, "dist", "index.js");
  if (!fs.existsSync(dist)) {
    throw new Error(`Não achei ${dist}. Rode npm install na pasta do clone antes do install-global.`);
  }
  const result = installConfigs({ extraEnv: mcpEnv() });
  console.log("MCP Sankhya instalado no usuário:");
  console.log(`  clone:  ${result.root}`);
  console.log(`  Cursor: ${result.cursorFile}`);
  console.log(`  Codex:  ${result.codexFile}`);
  if (result.ruleFile) {
    console.log(`  rule:   ${result.ruleFile}`);
  }
  if (result.agentsFile) {
    console.log(`  Codex AGENTS.md: ${result.agentsFile}`);
  }
  if (result.hook) {
    console.log(`  hook:   ${result.hook.userConfig}`);
  }
  if (result.remotes) {
    console.log(`  remote get: ${GET_REMOTE} (${result.remotes.get})`);
  }
  console.log("Reinicie o Cursor e o Codex.");
}

module.exports = {
  TEAM_VAULT_ID,
  GET_REMOTE,
  GET_REMOTE_NAME,
  DEFAULT_WINDOWS_ROOT,
  upsertCursorMcp,
  upsertCodexToml,
  codexSankhyaBlock,
  cursorServerEntry,
  mcpEnv,
  installConfigs,
  ensureCompanyRemote,
  ensureGitRemote,
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
