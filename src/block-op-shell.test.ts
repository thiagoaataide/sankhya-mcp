import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hook = join(root, ".cursor/hooks/block-op-shell.cjs");
const requireHook = createRequire(import.meta.url);
const { looksLikeOpCli, looksLikeSankhyaBypass, decide } = requireHook(hook);

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

test("blocks curl and PowerShell against Om", () => {
  assert.equal(
    looksLikeSankhyaBypass(
      "curl https://facilita.sankhya.com.br/mge/service.sbr?serviceName=DbExplorerSP.executeQuery",
    ),
    true,
  );
  assert.equal(
    looksLikeSankhyaBypass(
      "Invoke-WebRequest -Uri 'https://rhb.snk.ativy.com/mge/service.sbr' -Method POST",
    ),
    true,
  );
  assert.equal(
    looksLikeSankhyaBypass("iwr https://api.sankhya.com.br/gateway/v1/mge/service.sbr"),
    true,
  );
  assert.equal(
    decide("curl -d serviceName=MobileLoginSP.login http://cliente/mge/service.sbr").permission,
    "deny",
  );
});

test("blocks python/node one-liners against Om", () => {
  assert.equal(
    looksLikeSankhyaBypass(
      "python -c \"import urllib.request; urllib.request.urlopen('https://a.sankhya.com.br/mge/service.sbr')\"",
    ),
    true,
  );
  assert.equal(
    looksLikeSankhyaBypass("node -e \"fetch('https://x.sankhya.com.br/mge/service.sbr')\""),
    true,
  );
});

test("allows searching the repo for Sankhya strings", () => {
  assert.equal(looksLikeSankhyaBypass("rg service.sbr"), false);
  assert.equal(looksLikeSankhyaBypass("grep DbExplorerSP src/query.ts"), false);
  assert.equal(looksLikeSankhyaBypass("git log --grep=MobileLoginSP"), false);
  assert.equal(decide("rg api.sankhya.com.br README.md").permission, "allow");
});

test("allows unrelated curl", () => {
  assert.equal(looksLikeSankhyaBypass("curl https://api.github.com"), false);
  assert.equal(decide("curl https://api.github.com").permission, "allow");
});

test("hook process reads stdin JSON", () => {
  const ran = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ command: "op item list" }),
    encoding: "utf8",
  });
  assert.equal(ran.status, 0);
  assert.equal(JSON.parse(ran.stdout).permission, "deny");
});

test("hook process denies Sankhya HTTP via stdin", () => {
  const ran = spawnSync(process.execPath, [hook], {
    input: JSON.stringify({
      command: "curl https://cliente.sankhya.com.br/mge/service.sbr",
    }),
    encoding: "utf8",
  });
  assert.equal(ran.status, 0);
  assert.equal(JSON.parse(ran.stdout).permission, "deny");
});
