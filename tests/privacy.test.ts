import test from "node:test";
import assert from "node:assert/strict";
import { redactSensitiveContent } from "@/services/privacy.service";

test("redactSensitiveContent removes CPF, email and card-like numbers", () => {
  const result = redactSensitiveContent("CPF 123.456.789-09, email cliente@exemplo.com, cartao 4111 1111 1111 1111");

  assert.equal(result.includes("123.456.789-09"), false);
  assert.equal(result.includes("cliente@exemplo.com"), false);
  assert.equal(result.includes("4111 1111 1111 1111"), false);
  assert.equal(result.includes("[CPF_REMOVIDO]"), true);
  assert.equal(result.includes("[EMAIL_REMOVIDO]"), true);
  assert.equal(result.includes("[CARTAO_REMOVIDO]"), true);
});

test("redactSensitiveContent keeps ordinary business text", () => {
  const text = "Quero reservar uma mesa para quatro pessoas hoje as 20h.";
  assert.equal(redactSensitiveContent(text), text);
});
