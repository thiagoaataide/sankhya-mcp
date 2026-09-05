export const TEAM_VAULT_ID = "tkrys7yhgj64dmo643ovrxa7ie";
export const TEAM_VAULT_NAME = "Sankhya – Clientes";
export const DEFAULT_GATEWAY_URL = "https://api.sankhya.com.br";
export const DEFAULT_MAX_ROWS = 200;
export const HARD_MAX_ROWS = 2000;
export const REQUEST_TIMEOUT_MS = 60_000;

export function opVaultId(): string {
  return process.env.SANKHYA_OP_VAULT?.trim() || TEAM_VAULT_ID;
}

export function defaultProfile(): string | undefined {
  const value = process.env.SANKHYA_DEFAULT_PROFILE?.trim();
  return value || undefined;
}

export function gatewayUrl(): string {
  return (process.env.SANKHYA_GATEWAY_URL?.trim() || DEFAULT_GATEWAY_URL).replace(/\/$/, "");
}
