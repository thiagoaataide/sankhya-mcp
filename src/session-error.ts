const LOGIN_FAILURE =
  /usu[aá]rio\s*\/?\s*senha|senha\s+inv[aá]lid|usu[aá]rio\s+bloqueado|tentativa.*logar|credenciais?\s+inv[aá]lid/i;

const SESSION_FAILURE =
  /\b401\b|\b403\b|unauthorized|expir|jsession|mgesession|n[aã]o\s+(autentic|logad|authoriz)|sess[aã]o|session\s+(expir|invalid|inv[aá]lida)|autentic/i;

export function isSessionExpiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.trim()) {
    return false;
  }
  if (LOGIN_FAILURE.test(message)) {
    return false;
  }
  return SESSION_FAILURE.test(message);
}
