import { gatewayUrl, REQUEST_TIMEOUT_MS } from "./config.js";
import type { Ambiente } from "./ambiente.js";
import type { AuthMode, ResolvedProfile } from "./mode.js";
import { isSessionExpiredError } from "./session-error.js";

export type Session = {
  profile: string;
  ambiente?: Ambiente;
  mode: AuthMode;
  authorization?: string;
  cookie?: string;
  serviceBase: string;
  warning?: string;
};

type Cached = Session & { expiresAt: number };

const cache = new Map<string, Cached>();

function sessionKey(profile: string, ambiente?: Ambiente): string {
  return `${profile.toLowerCase()}::${ambiente ?? "_"}`;
}

export function peekSession(profile: string, ambiente?: Ambiente): Session | undefined {
  const key = sessionKey(profile, ambiente);
  const hit = cache.get(key);
  if (!hit) {
    return undefined;
  }
  if (Date.now() >= hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit;
}

export async function ensureSession(profile: ResolvedProfile, force = false): Promise<Session> {
  const key = sessionKey(profile.title, profile.ambiente);
  if (!force) {
    const existing = peekSession(profile.title, profile.ambiente);
    if (existing && existing.mode === profile.mode) {
      return existing;
    }
  }

  const session =
    profile.mode === "gateway" ? await loginGateway(profile) : await loginDirect(profile);

  cache.set(key, session);
  return session;
}

async function loginDirect(profile: ResolvedProfile): Promise<Cached> {
  if (!profile.baseUrl || !profile.username || !profile.password) {
    throw new Error(
      `Perfil "${profile.title}" (${profile.ambiente ?? "producao"}) em modo direct precisa de username, password e URL do Om no 1Password.`,
    );
  }

  const url = `${profile.baseUrl}/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json`;
  const body = {
    serviceName: "MobileLoginSP.login",
    requestBody: {
      NOMUSU: { $: profile.username },
      INTERNO: { $: profile.password },
      KEEPCONNECTED: { $: "S" },
    },
  };

  const response = await fetchJson(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  assertSankhyaOk(response.json, "MobileLoginSP.login");
  const jsessionId = extractJsessionId(response.json, response.headers);
  if (!jsessionId) {
    throw new Error(`Login direct em "${profile.title}" não devolveu jsessionId.`);
  }

  return {
    profile: profile.title,
    ambiente: profile.ambiente,
    mode: "direct",
    cookie: `JSESSIONID=${jsessionId}`,
    serviceBase: `${profile.baseUrl}/mge/service.sbr`,
    warning: profile.warning,
    expiresAt: Date.now() + 25 * 60 * 1000,
  };
}

async function loginGateway(profile: ResolvedProfile): Promise<Cached> {
  const url = `${gatewayUrl()}/authenticate`;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: profile.clientId!,
    client_secret: profile.clientSecret!,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Token": profile.xToken!,
    },
    body: params,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Gateway /authenticate HTTP ${response.status}`);
  }

  const json = parseLooseJson(text) as {
    access_token?: string;
    bearerToken?: string;
    expires_in?: number;
    error?: string;
  };
  const token = json.access_token || json.bearerToken;
  if (!token) {
    throw new Error("Gateway /authenticate não devolveu access_token.");
  }

  const ttlMs = Math.max(30, (json.expires_in ?? 300) - 30) * 1000;
  return {
    profile: profile.title,
    ambiente: profile.ambiente,
    mode: "gateway",
    authorization: `Bearer ${token}`,
    serviceBase: `${gatewayUrl()}/gateway/v1/mge/service.sbr`,
    warning: profile.warning,
    expiresAt: Date.now() + ttlMs,
  };
}

export async function callServiceWithAuthRetry(
  profile: ResolvedProfile,
  serviceName: string,
  requestBody: unknown,
): Promise<{ json: unknown; session: Session; relogged: boolean }> {
  let session = await ensureSession(profile);
  try {
    const json = await callService(session, serviceName, requestBody);
    return { json, session, relogged: false };
  } catch (error) {
    if (!isSessionExpiredError(error)) {
      throw error;
    }
    session = await ensureSession(profile, true);
    const json = await callService(session, serviceName, requestBody);
    return { json, session, relogged: true };
  }
}

export async function callService(
  session: Session,
  serviceName: string,
  requestBody: unknown,
): Promise<unknown> {
  const url = `${session.serviceBase}?serviceName=${encodeURIComponent(serviceName)}&outputType=json`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session.authorization) {
    headers.Authorization = session.authorization;
  }
  if (session.cookie) {
    headers.Cookie = session.cookie;
  }

  const response = await fetchJson(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ serviceName, requestBody }),
  });

  assertSankhyaOk(response.json, serviceName);
  return response.json;
}

function extractJsessionId(json: unknown, headers: Headers): string | undefined {
  const cookie = headers.get("set-cookie") || "";
  const fromCookie = /JSESSIONID=([^;]+)/i.exec(cookie)?.[1];
  if (fromCookie) {
    return fromCookie;
  }

  const root = json as Record<string, unknown>;
  const body = (root.responseBody ?? root) as Record<string, unknown>;
  const candidates = [body.jsessionId, body.JSESSIONID, root.jsessionId];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate) {
      return candidate;
    }
    if (candidate && typeof candidate === "object" && "$" in candidate) {
      const value = (candidate as { $?: string }).$;
      if (value) {
        return value;
      }
    }
  }
  return undefined;
}

function assertSankhyaOk(json: unknown, serviceName: string): void {
  if (!json || typeof json !== "object") {
    return;
  }
  const root = json as { status?: string | number; statusMessage?: string };
  if (root.status === undefined) {
    return;
  }
  if (String(root.status) !== "1") {
    throw new Error(`${serviceName} status=${root.status}: ${root.statusMessage || "erro Sankhya"}`);
  }
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<{ json: unknown; headers: Headers }> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} em ${safeUrl(url)}`);
  }
  return { json: parseLooseJson(text), headers: response.headers };
}

function parseLooseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Resposta Sankhya não é JSON.");
  }
}

function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("mgeSession");
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return "url";
  }
}
