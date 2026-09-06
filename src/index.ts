#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { parseAmbiente } from "./ambiente.js";
import { defaultProfile, opVaultId, TEAM_VAULT_NAME } from "./config.js";
import { listProfiles, loadProfile } from "./onepassword.js";
import { executeQuery } from "./query.js";
import { ensureSession, peekSession } from "./sankhya.js";
import { assertReadOnlySelect } from "./sql-guard.js";
import { sanitizeError, toolText } from "./text.js";

const server = new McpServer(
  { name: "sankhya", version: "0.1.0" },
  {
    instructions:
      "MCP local de consulta ao Sankhya Om. Credenciais vêm do vault 1Password Sankhya – Clientes. Informe profile (título do item) e ambiente (producao, teste ou treinamento). Nem todo cliente tem as três bases; se faltar, a tool lista as disponíveis. Default de ambiente é producao. Default de auth é direct. Gateway só com mode=gateway e as três chaves. Nunca peça senha. Somente SELECT.",
  },
);

server.registerTool(
  "sankhya_status",
  {
    title: "Status Sankhya",
    description:
      "Mostra vault 1Password, perfil padrão e se há sessão viva. Não devolve token nem senha.",
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    const profile = defaultProfile();
    const session = profile ? peekSession(profile) : undefined;
    return toolText({
      vaultId: opVaultId(),
      vaultName: TEAM_VAULT_NAME,
      defaultProfile: profile ?? null,
      session: session
        ? {
            profile: session.profile,
            ambiente: session.ambiente ?? null,
            mode: session.mode,
            warning: session.warning ?? null,
          }
        : null,
    });
  },
);

server.registerTool(
  "sankhya_list_profiles",
  {
    title: "Listar clientes Sankhya",
    description:
      "Lista os títulos dos itens no vault Sankhya – Clientes. Use o título como profile nas outras tools.",
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  async () => {
    try {
      const profiles = await listProfiles();
      return toolText({ count: profiles.length, profiles: profiles.map((item) => item.title) });
    } catch (error) {
      return toolText(sanitizeError(error), true);
    }
  },
);

server.registerTool(
  "sankhya_execute_query",
  {
    title: "Executar SELECT no Sankhya",
    description:
      "Executa um SELECT no Om do cliente. Autentica sozinho. profile é o título do item (ex.: Facilita Telecom). ambiente é producao, teste ou treinamento — não misture no nome do perfil. Somente SELECT/WITH. Default 200 linhas.",
    inputSchema: {
      sql: z.string().describe("Um único SELECT (ou WITH … SELECT). Sem INSERT/UPDATE/DELETE."),
      profile: z
        .string()
        .optional()
        .describe("Título do item no vault Sankhya – Clientes. Se omitido, usa SANKHYA_DEFAULT_PROFILE."),
      ambiente: z
        .string()
        .optional()
        .describe(
          "Base Sankhya: producao, teste ou treinamento (aceita prod, testes, treino). Padrão: producao se existir; senão a única base do item.",
        ),
      max_rows: z
        .number()
        .int()
        .min(1)
        .max(2000)
        .optional()
        .describe("Teto de linhas devolvidas ao modelo. Default 200."),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ sql, profile, ambiente, max_rows }) => {
    try {
      const name = profile?.trim() || defaultProfile();
      if (!name) {
        return toolText(
          "Informe profile (título do item no 1Password) ou defina SANKHYA_DEFAULT_PROFILE.",
          true,
        );
      }
      const safeSql = assertReadOnlySelect(sql);
      const env = parseAmbiente(ambiente);
      const loaded = await loadProfile(name, env);
      const session = await ensureSession(loaded);
      try {
        const result = await executeQuery(session, safeSql, max_rows);
        return toolText({
          profile: loaded.title,
          ambiente: loaded.ambiente ?? null,
          availableAmbientes: loaded.availableAmbientes ?? [],
          mode: session.mode,
          warning: session.warning ?? null,
          sql: safeSql,
          ...result,
        });
      } catch (error) {
        const message = sanitizeError(error);
        if (/401|sessão|session|jsession|unauthorized|expir/i.test(message)) {
          const retried = await ensureSession(loaded, true);
          const result = await executeQuery(retried, safeSql, max_rows);
          return toolText({
            profile: loaded.title,
            ambiente: loaded.ambiente ?? null,
            availableAmbientes: loaded.availableAmbientes ?? [],
            mode: retried.mode,
            warning: retried.warning ?? null,
            sql: safeSql,
            relogged: true,
            ...result,
          });
        }
        throw error;
      }
    } catch (error) {
      return toolText(sanitizeError(error), true);
    }
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("sankhya-mcp ready (stdio)");
}

main().catch((error) => {
  console.error(sanitizeError(error));
  process.exit(1);
});
