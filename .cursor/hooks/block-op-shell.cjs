#!/usr/bin/env node
"use strict";

function looksLikeOpCli(command) {
  const text = String(command || "");
  if (!text.trim()) {
    return false;
  }
  if (/1password-cli/i.test(text) || /AgileBits\.1Password/i.test(text)) {
    return true;
  }
  if (/(^|[\\/"'\s;&|])op\.exe\b/i.test(text)) {
    return true;
  }
  if (/(?:^|[\s;&|<>]|(?:&&|\|\|))\s*(?:&\s*)?(?:(?:["'][^"']+["'])\s+)*op(?=\s|$)/i.test(text)) {
    return true;
  }
  if (/(?:^|[\s;&|])(?:where(?:\.exe)?|Get-Command|which)\s+op(?=\s|$)/i.test(text)) {
    return true;
  }
  return false;
}

function decide(command) {
  if (looksLikeOpCli(command)) {
    return {
      permission: "deny",
      user_message:
        "Comando 1Password CLI bloqueado no terminal do Agent. Use a tool MCP sankhya_list_profiles / sankhya_execute_query.",
      agent_message:
        "O Shell tentou chamar o 1Password CLI (op). Isso está bloqueado por hook. Use sankhya_list_profiles, sankhya_execute_query ou sankhya_status. Não contorne com op, op.exe, winget 1password-cli nem where op.",
    };
  }
  return { permission: "allow" };
}

function main() {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    let command = "";
    try {
      const raw = Buffer.concat(chunks).toString("utf8").trim() || "{}";
      const input = JSON.parse(raw);
      command = String(input.command ?? input.tool_input?.command ?? "");
    } catch {
      command = "";
    }
    process.stdout.write(JSON.stringify(decide(command)));
  });
}

module.exports = { looksLikeOpCli, decide };

if (require.main === module) {
  main();
}
