import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { opVaultId } from "./config.js";
import { originFromUrl, resolveAuthMode, type ProfileSecrets, type ResolvedProfile } from "./mode.js";
import { isMissingBinaryError, resolveOpBinary } from "./op-bin.js";

const execFileAsync = promisify(execFile);

type OpField = {
  id?: string;
  label?: string;
  type?: string;
  value?: string;
  purpose?: string;
};

type OpUrl = { href?: string; primary?: boolean };

type OpItem = {
  id: string;
  title: string;
  vault?: { id?: string; name?: string };
  urls?: OpUrl[];
  fields?: OpField[];
};

type OpListRow = {
  id: string;
  title: string;
  vault?: { id?: string; name?: string };
};

export type ProfileSummary = {
  title: string;
  id: string;
};

async function op(args: string[]): Promise<string> {
  const bin = resolveOpBinary();
  try {
    const { stdout } = await execFileAsync(bin, args, {
      timeout: 30_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    if (isMissingBinaryError(error)) {
      throw new Error(
        `1Password CLI não está no PATH deste processo (tentou: ${bin}). Defina SANKHYA_OP_BIN no mcp.json com o caminho completo do op.exe (where op). Não use o terminal do Cursor para ler o cofre.`,
      );
    }
    const err = error as { stderr?: string; message?: string };
    const detail = (err.stderr || err.message || "falha ao executar op").trim();
    throw new Error(
      `1Password CLI falhou. App aberto, CLI integrado e vault acessível? Detalhe: ${detail}`,
    );
  }
}

function fieldValue(item: OpItem, names: string[]): string | undefined {
  const wanted = names.map((name) => name.toLowerCase());
  for (const field of item.fields ?? []) {
    const label = (field.label || field.id || "").toLowerCase();
    const purpose = (field.purpose || "").toLowerCase();
    if (wanted.includes(label) || wanted.includes(purpose)) {
      const value = field.value?.trim();
      if (value) {
        return value;
      }
    }
  }
  return undefined;
}

function primaryUrl(item: OpItem): string | undefined {
  const urls = item.urls ?? [];
  const primary = urls.find((entry) => entry.primary) ?? urls[0];
  return primary?.href?.trim();
}

function toSecrets(item: OpItem): ProfileSecrets {
  const url = primaryUrl(item);
  return {
    title: item.title,
    username: fieldValue(item, ["username", "user", "nomusu"]),
    password: fieldValue(item, ["password", "senha", "interno"]),
    baseUrl: url ? originFromUrl(url) : undefined,
    modeField: fieldValue(item, ["mode", "modo"]),
    clientId: fieldValue(item, ["client_id", "clientid", "client id"]),
    clientSecret: fieldValue(item, ["client_secret", "clientsecret", "client secret"]),
    xToken: fieldValue(item, ["x_token", "xtoken", "x-token"]),
  };
}

export async function listProfiles(): Promise<ProfileSummary[]> {
  const raw = await op(["item", "list", "--vault", opVaultId(), "--format", "json"]);
  const rows = JSON.parse(raw) as OpListRow[];
  return rows
    .map((row) => ({ id: row.id, title: row.title }))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

export async function loadProfile(title: string): Promise<ResolvedProfile> {
  const raw = await op(["item", "get", title, "--vault", opVaultId(), "--reveal", "--format", "json"]);
  const item = JSON.parse(raw) as OpItem;
  const secrets = toSecrets(item);
  const resolved = resolveAuthMode(secrets);
  return { ...secrets, ...resolved };
}
