export type Ambiente = "producao" | "teste" | "treinamento";

const ORDER: Ambiente[] = ["producao", "teste", "treinamento"];

const ALIASES: Record<Ambiente, string[]> = {
  producao: ["producao", "prod", "production", "prd"],
  teste: ["teste", "testes", "test", "testing", "homolog", "homologacao", "hml"],
  treinamento: ["treinamento", "treinamentos", "treino", "training"],
};

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function classifyAmbiente(raw?: string): Ambiente | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const folded = fold(raw);
  const tokens = folded.split(" ").filter(Boolean);
  for (const ambiente of ["treinamento", "teste", "producao"] as Ambiente[]) {
    for (const alias of ALIASES[ambiente]) {
      if (folded === alias || tokens.includes(alias)) {
        return ambiente;
      }
    }
  }
  return undefined;
}

export function parseAmbiente(raw?: string): Ambiente | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const classified = classifyAmbiente(raw);
  if (!classified) {
    throw new Error(
      `Ambiente inválido: "${raw}". Use producao, teste ou treinamento.`,
    );
  }
  return classified;
}

export type EnvSlot = {
  url?: string;
  username?: string;
  password?: string;
};

export type ItemEnvMap = Partial<Record<Ambiente, EnvSlot>>;

export function pickAmbiente(available: Ambiente[], requested?: Ambiente): Ambiente {
  if (requested) {
    if (!available.includes(requested)) {
      const list = available.length ? available.join(", ") : "(nenhum)";
      throw new Error(
        `Este cliente não tem a base "${requested}". Disponíveis: ${list}.`,
      );
    }
    return requested;
  }
  if (available.includes("producao")) {
    return "producao";
  }
  if (available.length === 1) {
    return available[0]!;
  }
  if (available.length === 0) {
    throw new Error("Item sem URL de Om (website ou campo url na seção).");
  }
  throw new Error(
    `Informe ambiente. Este cliente não tem producao; disponíveis: ${available.join(", ")}.`,
  );
}

export function availableAmbientes(map: ItemEnvMap): Ambiente[] {
  return ORDER.filter((ambiente) => Boolean(map[ambiente]?.url));
}
