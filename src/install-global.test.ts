import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requireCjs = createRequire(import.meta.url);
const {
  TEAM_VAULT_ID,
  GET_REMOTE,
  upsertCursorMcp,
  upsertCodexToml,
  installConfigs,
  ensureCompanyRemote,
} = requireCjs(join(root, "scripts/install-global.cjs"));

test("merges Cursor mcp.json without dropping other servers", () => {
  const json = upsertCursorMcp(
    JSON.stringify({
      mcpServers: {
        github: { command: "npx", args: ["-y", "github"] },
        sankhya: { command: "old.cmd", env: { KEEP: "1" } },
      },
    }),
    "C:\\projetos\\sankhya-mcp",
    { SANKHYA_OP_BIN: "C:\\Program Files\\1Password CLI\\op.exe" },
  );
  const parsed = JSON.parse(json);
  assert.equal(parsed.mcpServers.github.command, "npx");
  assert.equal(parsed.mcpServers.sankhya.env.KEEP, "1");
  assert.equal(parsed.mcpServers.sankhya.env.SANKHYA_OP_VAULT, TEAM_VAULT_ID);
  assert.match(parsed.mcpServers.sankhya.command, /sankhya-mcp\.cmd$/);
  assert.equal(parsed.mcpServers.sankhya.env.SANKHYA_OP_BIN, "C:\\Program Files\\1Password CLI\\op.exe");
});

test("rejects invalid Cursor mcp.json", () => {
  assert.throws(() => upsertCursorMcp("{nope", "C:\\projetos\\sankhya-mcp"), /inválido/);
});

test("upserts Codex TOML with literal Windows paths and keeps other servers", () => {
  const previous = `
model = "gpt-5"

[mcp_servers.docs]
command = "npx"

[mcp_servers.sankhya]
command = "old"

[mcp_servers.sankhya.env]
SANKHYA_OP_VAULT = "old"
`.trim();
  const next = upsertCodexToml(
    previous,
    "C:\\projetos\\sankhya-mcp",
    {},
    "C:\\Program Files\\nodejs\\node.exe",
  );
  assert.match(next, /model = "gpt-5"/);
  assert.match(next, /\[mcp_servers\.docs\]/);
  assert.equal((next.match(/\[mcp_servers\.sankhya\]/g) || []).length, 1);
  assert.match(next, /command = 'C:\\Program Files\\nodejs\\node\.exe'/);
  assert.match(next, /cwd = 'C:\\projetos\\sankhya-mcp'/);
  assert.match(next, /SANKHYA_OP_VAULT = "tkrys7yhgj64dmo643ovrxa7ie"/);
  assert.doesNotMatch(next, /command = "old"/);
});

test("installConfigs writes Cursor, Codex, hook and user rule", () => {
  const home = mkdtempSync(join(tmpdir(), "sankhya-home-"));
  const clone = mkdtempSync(join(tmpdir(), "sankhya-clone-"));
  mkdirSync(join(clone, "dist"), { recursive: true });
  writeFileSync(join(clone, "dist", "index.js"), "console.log('ok')\n");
  mkdirSync(join(home, ".codex"), { recursive: true });
  writeFileSync(join(home, ".codex", "config.toml"), '[mcp_servers.other]\ncommand = "echo"\n');

  const result = installConfigs({
    root: clone,
    home,
    extraEnv: { SANKHYA_OP_BIN: "/usr/bin/op" },
    nodeBin: "/usr/bin/node",
  });

  const cursor = JSON.parse(readFileSync(result.cursorFile, "utf8"));
  assert.equal(cursor.mcpServers.sankhya.env.SANKHYA_OP_BIN, "/usr/bin/op");
  const toml = readFileSync(result.codexFile, "utf8");
  assert.match(toml, /\[mcp_servers\.other\]/);
  assert.match(toml, /\[mcp_servers\.sankhya\]/);
  assert.equal(existsSync(result.ruleFile), true);
  assert.match(readFileSync(result.agentsFile, "utf8"), /sankhya_execute_query/);
  assert.equal(existsSync(result.hook.userConfig), true);
});

test("append Codex AGENTS.md is idempotent", () => {
  const home = mkdtempSync(join(tmpdir(), "sankhya-agents-"));
  const clone = mkdtempSync(join(tmpdir(), "sankhya-clone-"));
  mkdirSync(join(clone, "dist"), { recursive: true });
  writeFileSync(join(clone, "dist", "index.js"), "");
  mkdirSync(join(home, ".codex"), { recursive: true });
  writeFileSync(join(home, ".codex", "AGENTS.md"), "## Outro\n\ntexto\n");
  installConfigs({ root: clone, home, skipHook: true, nodeBin: "/usr/bin/node" });
  installConfigs({ root: clone, home, skipHook: true, nodeBin: "/usr/bin/node" });
  const body = readFileSync(join(home, ".codex", "AGENTS.md"), "utf8");
  const matches = body.match(/sankhya_execute_query/g) || [];
  assert.equal(matches.length, 1);
  assert.match(body, /## Outro/);
});

test("ensureCompanyRemote adds get without removing origin", () => {
  const dir = mkdtempSync(join(tmpdir(), "sankhya-git-"));
  const git = (args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  const init = git(["init"]);
  assert.equal(init.status, 0, init.stderr);
  git(["checkout", "-B", "main"]);
  git(["config", "user.email", "dev@example.com"]);
  git(["config", "user.name", "dev"]);
  writeFileSync(join(dir, "README.md"), "x\n");
  git(["add", "."]);
  git(["commit", "-m", "init"]);
  git(["remote", "add", "origin", "git@github.com:alguem/outro.git"]);
  const result = ensureCompanyRemote(dir);
  assert.equal(result.get, "added");
  assert.equal(git(["remote", "get-url", "get"]).stdout.trim(), GET_REMOTE);
  assert.equal(git(["remote", "get-url", "origin"]).stdout.trim(), "git@github.com:alguem/outro.git");
});
