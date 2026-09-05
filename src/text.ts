const SECRET_LIKE =
  /(password|passwd|secret|token|authorization|bearer|jsessionid|mgesession|interno|client_secret|x[_-]?token)\s*[:=]\s*\S+/gi;

export function sanitizeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(SECRET_LIKE, "$1=[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

export function toolText(payload: unknown, isError = false): {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
} {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  return isError ? { content: [{ type: "text", text }], isError: true } : { content: [{ type: "text", text }] };
}
