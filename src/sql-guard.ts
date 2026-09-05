const BLOCKED = /\b(insert|update|delete|merge|drop|alter|truncate|create|grant|revoke|exec|execute|call|begin|commit|rollback|attach|copy|into)\b/i;

export class SqlGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SqlGuardError";
  }
}

export function assertReadOnlySelect(sql: string): string {
  const stripped = stripComments(sql).trim();
  if (!stripped) {
    throw new SqlGuardError("SQL vazio.");
  }

  const statements = stripped
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  if (statements.length !== 1) {
    throw new SqlGuardError("Envie um único SELECT (sem múltiplos comandos).");
  }

  const statement = statements[0]!;
  const head = statement.replace(/\s+/g, " ");

  if (!/^(with\b[\s\S]+)?select\b/i.test(head)) {
    throw new SqlGuardError("Somente SELECT (ou WITH … SELECT) é permitido nesta tool.");
  }

  const afterSelect = head.replace(/^with\b[\s\S]*?\bselect\b/i, "SELECT");
  if (BLOCKED.test(afterSelect.replace(/^select\b/i, ""))) {
    throw new SqlGuardError("A query contém comando que não é leitura. Recusado.");
  }

  return statement;
}

function stripComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}
