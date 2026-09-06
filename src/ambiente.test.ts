import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyAmbiente, parseAmbiente, pickAmbiente } from "./ambiente.js";
import { secretsForAmbiente, type OpItem } from "./item-env.js";

test("classifies portuguese aliases", () => {
  assert.equal(classifyAmbiente("PRODUÇÃO"), "producao");
  assert.equal(classifyAmbiente("Prod"), "producao");
  assert.equal(classifyAmbiente("Testes"), "teste");
  assert.equal(classifyAmbiente("TREINAMENTO"), "treinamento");
});

test("rejects unknown ambiente", () => {
  assert.throws(() => parseAmbiente("staging"), /Ambiente inválido/);
});

test("RHB-style websites: Prod primary and Teste labeled", () => {
  const item: OpItem = {
    title: "RHB Import",
    urls: [
      { href: "http://vri.fwc.cloud:8180/mge", label: "Prod", primary: true },
      { href: "http://vri.fwc.cloud:8280/mge", label: "Teste" },
    ],
    fields: [
      { label: "username", purpose: "USERNAME", value: "INTG.DTFT" },
      { label: "password", purpose: "PASSWORD", value: "secret" },
    ],
  };
  const teste = secretsForAmbiente(item, "teste");
  assert.equal(teste.baseUrl, "http://vri.fwc.cloud:8280");
  assert.equal(teste.username, "INTG.DTFT");
  assert.deepEqual(teste.available, ["producao", "teste"]);

  const def = secretsForAmbiente(item);
  assert.equal(def.ambiente, "producao");
  assert.equal(def.baseUrl, "http://vri.fwc.cloud:8180");
});

test("Facilita-style sections with Senha SUP", () => {
  const item: OpItem = {
    title: "Facilita Telecom",
    fields: [
      { section: { label: "PRODUÇÃO" }, label: "url", value: "http://erp.example:8180" },
      { section: { label: "PRODUÇÃO" }, label: "Senha SUP", value: "prod-pass" },
      { section: { label: "TESTES" }, label: "url", value: "http://erp.example:8280" },
      { section: { label: "TESTES" }, label: "Senha SUP", value: "test-pass" },
      { section: { label: "TREINAMENTO" }, label: "url", value: "http://erp.example:8380" },
      { section: { label: "TREINAMENTO" }, label: "Senha SUP", value: "train-pass" },
    ],
  };
  const teste = secretsForAmbiente(item, "teste");
  assert.equal(teste.ambiente, "teste");
  assert.equal(teste.baseUrl, "http://erp.example:8280");
  assert.equal(teste.username, "SUP");
  assert.equal(teste.password, "test-pass");
});

test("missing ambiente lists only what the item has", () => {
  assert.throws(
    () => pickAmbiente(["producao"], "treinamento"),
    /não tem a base "treinamento"/,
  );
});
