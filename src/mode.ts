import type { Ambiente } from "./ambiente.js";

export type AuthMode = "direct" | "gateway";

export type ProfileSecrets = {
  title: string;
  username?: string;
  password?: string;
  baseUrl?: string;
  modeField?: string;
  clientId?: string;
  clientSecret?: string;
  xToken?: string;
  ambiente?: Ambiente;
  availableAmbientes?: Ambiente[];
};

export type ResolvedProfile = ProfileSecrets & {
  mode: AuthMode;
  warning?: string;
};

export function resolveAuthMode(profile: ProfileSecrets): Pick<ResolvedProfile, "mode" | "warning"> {
  const mode = (profile.modeField ?? "").trim().toLowerCase();
  const hasGatewayKeys = Boolean(
    profile.clientId?.trim() && profile.clientSecret?.trim() && profile.xToken?.trim(),
  );

  if (mode === "gateway") {
    if (hasGatewayKeys) {
      return { mode: "gateway" };
    }
    return {
      mode: "direct",
      warning:
        "Item tem mode=gateway, mas faltam client_id, client_secret ou x_token. Usando direct.",
    };
  }

  if (hasGatewayKeys) {
    return {
      mode: "direct",
      warning: "Item tem chaves de Gateway, mas mode não é gateway. Usando direct.",
    };
  }

  return { mode: "direct" };
}

export function originFromUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("URL do Om vazia no item do 1Password.");
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error(`URL do Om inválida no item do 1Password: ${trimmed}`);
  }
  return parsed.origin;
}
