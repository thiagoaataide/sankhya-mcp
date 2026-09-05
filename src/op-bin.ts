import { existsSync } from "node:fs";
import { homedir } from "node:os";

export function resolveOpBinary(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  const explicit = env.SANKHYA_OP_BIN?.trim();
  if (explicit) {
    return explicit;
  }

  if (platform === "win32") {
    for (const candidate of windowsCandidates(env)) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return "op.exe";
  }

  return "op";
}

export function windowsCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const local = env.LOCALAPPDATA?.trim();
  const home = env.USERPROFILE?.trim() || homedir();
  return [
    "C:\\Program Files\\1Password CLI\\op.exe",
    local ? `${local}\\Microsoft\\WinGet\\Links\\op.exe` : "",
    `${home}\\AppData\\Local\\Microsoft\\WinGet\\Links\\op.exe`,
  ].filter(Boolean);
}

export function isMissingBinaryError(error: unknown): boolean {
  const err = error as { code?: string; message?: string };
  return err.code === "ENOENT" || /ENOENT/i.test(err.message ?? "");
}
