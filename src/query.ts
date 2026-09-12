import { DEFAULT_MAX_ROWS, HARD_MAX_ROWS } from "./config.js";
import type { ResolvedProfile } from "./mode.js";
import { callServiceWithAuthRetry } from "./sankhya.js";

export type QueryResult = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
  maxRows: number;
  service: string;
};

export async function executeQuery(
  profile: ResolvedProfile,
  sql: string,
  maxRowsInput?: number,
): Promise<QueryResult & { relogged: boolean }> {
  const maxRows = clampMaxRows(maxRowsInput);
  const { json, relogged } = await callServiceWithAuthRetry(profile, "DbExplorerSP.executeQuery", { sql });
  const parsed = normalizeQueryResponse(json);
  const truncated = parsed.rows.length > maxRows;
  const rows = truncated ? parsed.rows.slice(0, maxRows) : parsed.rows;
  return {
    columns: parsed.columns,
    rows,
    rowCount: rows.length,
    truncated: truncated || parsed.truncated,
    maxRows,
    service: "DbExplorerSP.executeQuery",
    relogged,
  };
}

function clampMaxRows(value?: number): number {
  if (!value || Number.isNaN(value)) {
    return DEFAULT_MAX_ROWS;
  }
  return Math.min(HARD_MAX_ROWS, Math.max(1, Math.floor(value)));
}

function normalizeQueryResponse(json: unknown): {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  truncated: boolean;
} {
  const root = json as Record<string, unknown>;
  const body = (root.responseBody ?? root) as Record<string, unknown>;
  const payload = (body.querydata ?? body) as Record<string, unknown>;

  const fieldsRaw = payload.fields ?? payload.metadata ?? payload.colnames;
  const rowsRaw = payload.rows ?? payload.data ?? payload.records;

  const columns = normalizeColumns(fieldsRaw);
  const rows = normalizeRows(rowsRaw, columns);
  return { columns, rows, truncated: false };
}

function normalizeColumns(fields: unknown): string[] {
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields.map((field, index) => {
    if (typeof field === "string") {
      return field;
    }
    if (field && typeof field === "object") {
      const record = field as Record<string, unknown>;
      const name = record.name ?? record.field ?? record.id ?? record.$;
      if (typeof name === "string") {
        return name;
      }
    }
    return `col_${index + 1}`;
  });
}

function normalizeRows(rows: unknown, columns: string[]): Array<Record<string, unknown>> {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row) => {
    if (Array.isArray(row)) {
      const record: Record<string, unknown> = {};
      row.forEach((value, index) => {
        record[columns[index] ?? `col_${index + 1}`] = unwrap(value);
      });
      return record;
    }
    if (row && typeof row === "object") {
      const record: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
        record[key] = unwrap(value);
      }
      return record;
    }
    return { value: row };
  });
}

function unwrap(value: unknown): unknown {
  if (value && typeof value === "object" && "$" in (value as object)) {
    return (value as { $?: unknown }).$;
  }
  return value;
}
