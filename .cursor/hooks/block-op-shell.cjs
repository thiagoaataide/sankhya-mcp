#!/usr/bin/env node
"use strict";

const SHELL_HOOK_MATCHER =
  "op\\.exe|(^|[\\s;&|\\\\/'\"])op(\\s|$)|1password-cli|AgileBits\\.1Password|where\\s+op|Get-Command\\s+op|service\\.sbr|DbExplorerSP|ExecQuerySP|MobileLoginSP|CRUDServiceProvider|/mge/|sankhya\\.com|snk\\.ativy|Invoke-WebRequest|\\biwr\\b|Invoke-RestMethod";

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

function hasSankhyaTarget(text) {
  if (/service\.sbr/i.test(text)) {
    return true;
  }
  if (/MobileLoginSP|DbExplorerSP|ExecQuerySP|CRUDServiceProvider/i.test(text)) {
    return true;
  }
  if (/sankhya\.com(?:\.br)?/i.test(text)) {
    return true;
  }
  if (/snk\.ativy\.com/i.test(text)) {
    return true;
  }
  if (/\/mge(?:com)?\//i.test(text) && /https?:\/\//i.test(text)) {
    return true;
  }
  return false;
}

function looksLikeHttpOrRuntime(text) {
  if (/\b(curl|wget)(\.exe)?\b/i.test(text)) {
    return true;
  }
  if (/\b(Invoke-WebRequest|Invoke-RestMethod|\biwr\b|\birm\b)\b/i.test(text)) {
    return true;
  }
  if (/System\.Net\.(WebClient|Http)/i.test(text)) {
    return true;
  }
  if (/\bfetch\s*\(/i.test(text)) {
    return true;
  }
  if (/\b(urllib|httpx|axios|node-fetch|got\s*\(|requests\.(get|post|put|request))/i.test(text)) {
    return true;
  }
  if (/\b(python3?|py|node|nodejs|php|ruby|perl)(\.exe)?\b\s+(?:-\w+\s+)*-(?:c|e|r)\b/i.test(text)) {
    return true;
  }
  if (/\b(npx|tsx|ts-node)\b.*https?:/i.test(text)) {
    return true;
  }
  return false;
}

function looksLikeSankhyaBypass(command) {
  const text = String(command || "");
  if (!text.trim() || !hasSankhyaTarget(text)) {
    return false;
  }
  if (looksLikeHttpOrRuntime(text)) {
    return true;
  }
  if (/^https?:\/\/\S*(?:sankhya|snk\.ativy|service\.sbr)/i.test(text.trim())) {
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
  if (looksLikeSankhyaBypass(command)) {
    return {
      permission: "deny",
      user_message:
        "Consulta/API Sankhya bloqueada no terminal do Agent. Use sankhya_execute_query.",
      agent_message:
        "O Shell tentou falar com o Om (service.sbr, /mge/, DbExplorer, Gateway). SQL e login Sankhya só pela tool MCP sankhya_execute_query. Não use curl, Invoke-WebRequest, python ou node contra o ERP.",
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

module.exports = {
  looksLikeOpCli,
  looksLikeSankhyaBypass,
  hasSankhyaTarget,
  looksLikeHttpOrRuntime,
  decide,
  SHELL_HOOK_MATCHER,
};

if (require.main === module) {
  main();
}
