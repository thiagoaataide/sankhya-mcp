import { originFromUrl } from "./mode.js";
import {
  availableAmbientes,
  classifyAmbiente,
  fold,
  pickAmbiente,
  type Ambiente,
  type EnvSlot,
  type ItemEnvMap,
} from "./ambiente.js";

export type OpField = {
  id?: string;
  label?: string;
  type?: string;
  value?: string;
  purpose?: string;
  section?: { id?: string; label?: string };
};

export type OpUrl = { href?: string; label?: string; primary?: boolean };

export type OpItem = {
  id?: string;
  title: string;
  urls?: OpUrl[];
  fields?: OpField[];
};

const USER_LABELS = new Set(["username", "user", "nomusu", "usuario"]);
const URL_LABELS = new Set(["url", "website", "href", "host", "base url", "base_url"]);

function isUsername(field: OpField): boolean {
  if ((field.purpose || "").toLowerCase() === "username") {
    return true;
  }
  return USER_LABELS.has(fold(field.label || field.id || ""));
}

function isPassword(field: OpField): boolean {
  if ((field.purpose || "").toLowerCase() === "password") {
    return true;
  }
  const label = fold(field.label || field.id || "");
  return label === "password" || label === "senha" || label === "interno" || label.startsWith("senha ");
}

function isUrlField(field: OpField): boolean {
  return URL_LABELS.has(fold(field.label || field.id || ""));
}

function impliesSup(field: OpField): boolean {
  return fold(field.label || "").startsWith("senha sup");
}

function slot(map: ItemEnvMap, ambiente: Ambiente): EnvSlot {
  map[ambiente] ??= {};
  return map[ambiente];
}

export function collectItemEnvs(item: OpItem): { map: ItemEnvMap; itemUsername?: string; itemPassword?: string } {
  const map: ItemEnvMap = {};
  let itemUsername: string | undefined;
  let itemPassword: string | undefined;

  for (const url of item.urls ?? []) {
    const href = url.href?.trim();
    if (!href) {
      continue;
    }
    const ambiente = classifyAmbiente(url.label) ?? (url.primary ? "producao" : undefined);
    if (ambiente) {
      slot(map, ambiente).url = href;
    }
  }

  for (const field of item.fields ?? []) {
    const value = field.value?.trim();
    if (!value) {
      continue;
    }
    const sectionEnv = classifyAmbiente(field.section?.label);
    if (!sectionEnv) {
      if (isUsername(field)) {
        itemUsername = value;
      }
      if (isPassword(field) && !itemPassword) {
        itemPassword = value;
      }
      if (isUrlField(field) && classifyAmbiente(field.label)) {
        slot(map, classifyAmbiente(field.label)!).url = value;
      }
      continue;
    }
    const current = slot(map, sectionEnv);
    if (isUrlField(field) || field.type === "URL") {
      current.url = value;
    } else if (!current.url && /^https?:\/\//i.test(value) && !isPassword(field) && !isUsername(field)) {
      current.url = value;
    }
    if (isUsername(field)) {
      current.username = value;
    }
    if (isPassword(field)) {
      current.password = value;
      if (!current.username && impliesSup(field)) {
        current.username = "SUP";
      }
    }
  }

  const unlabeled = (item.urls ?? []).filter((entry) => entry.href && !classifyAmbiente(entry.label));
  if (availableAmbientes(map).length === 0 && unlabeled[0]?.href) {
    slot(map, "producao").url = unlabeled[0].href;
  }

  return { map, itemUsername, itemPassword };
}

export function secretsForAmbiente(
  item: OpItem,
  requested?: Ambiente,
): {
  ambiente: Ambiente;
  available: Ambiente[];
  username?: string;
  password?: string;
  baseUrl?: string;
} {
  const { map, itemUsername, itemPassword } = collectItemEnvs(item);
  const available = availableAmbientes(map);
  const ambiente = pickAmbiente(available, requested);
  const chosen = map[ambiente] ?? {};
  const username = chosen.username || itemUsername;
  const password = chosen.password || itemPassword;
  return {
    ambiente,
    available,
    username,
    password,
    baseUrl: chosen.url ? originFromUrl(chosen.url) : undefined,
  };
}
