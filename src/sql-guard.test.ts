import assert from "node:assert/strict";
import { test } from "node:test";
import { assertReadOnlySelect, SqlGuardError } from "./sql-guard.js";

test("allows a simple select", () => {
  const sql = assertReadOnlySelect("  SELECT CODPROD, DESCRPROD FROM TGFPRO  ");
  assert.equal(sql, "SELECT CODPROD, DESCRPROD FROM TGFPRO");
});

test("allows with-select", () => {
  const sql = assertReadOnlySelect(`
    WITH x AS (SELECT 1 AS n FROM DUAL)
    SELECT n FROM x
  `);
  assert.match(sql, /^WITH/i);
});

test("rejects insert", () => {
  assert.throws(() => assertReadOnlySelect("INSERT INTO TGFPAR (NOMEPARC) VALUES ('x')"), SqlGuardError);
});

test("rejects delete hidden after a comment", () => {
  assert.throws(() => assertReadOnlySelect("SELECT 1; DELETE FROM TGFPAR"), SqlGuardError);
});

test("rejects empty", () => {
  assert.throws(() => assertReadOnlySelect("   -- nada"), SqlGuardError);
});
