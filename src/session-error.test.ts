import assert from "node:assert/strict";
import { test } from "node:test";
import { isSessionExpiredError } from "./session-error.js";

test("detects Sankhya session errors in Portuguese", () => {
  assert.equal(
    isSessionExpiredError(new Error("DbExplorerSP.executeQuery status=0: Usuario nao autenticado")),
    true,
  );
  assert.equal(
    isSessionExpiredError(new Error("DbExplorerSP.executeQuery status=0: Sessao expirada")),
    true,
  );
  assert.equal(isSessionExpiredError(new Error("HTTP 401 em http://cliente/mge/service.sbr")), true);
});

test("does not treat invalid credentials as session expiry", () => {
  assert.equal(
    isSessionExpiredError(new Error("MobileLoginSP.login status=0: Usuario/Senha invalido")),
    false,
  );
  assert.equal(
    isSessionExpiredError(new Error("MobileLoginSP.login status=0: Usuario bloqueado")),
    false,
  );
});

test("detects common English session markers", () => {
  assert.equal(isSessionExpiredError(new Error("HTTP 403 unauthorized")), true);
  assert.equal(isSessionExpiredError(new Error("JSESSIONID missing")), true);
});
