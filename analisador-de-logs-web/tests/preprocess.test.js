import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanLog, redact } from "../js/preprocess.js";

const sample = readFileSync(new URL("../sample/teste.log", import.meta.url), "utf8");

test("cleanLog colapsa linhas repetidas ignorando o timestamp", () => {
  const { text, stats } = cleanLog(sample);
  assert.equal(stats.originalLines, 37);
  assert.equal(stats.uniqueLines, 29);
  assert.equal(stats.truncated, false);
  const timeoutLines = text.split("\n").filter((l) => l.includes("Database connection timeout"));
  assert.equal(timeoutLines.length, 1);
  assert.match(timeoutLines[0], /\[repetida 8x, última em 2026-09-08 10:28:34\]$/);
  assert.match(text, /NullReferenceException  \[repetida 2x, última em 2026-09-08 10:35:02\]/);
});

test("cleanLog não colapsa linhas que diferem em dados relevantes", () => {
  const { text } = cleanLog("2026-01-01 10:00:00 ERROR order 1 failed\n2026-01-01 10:00:01 ERROR order 2 failed");
  assert.equal(text.split("\n").length, 2);
  assert.doesNotMatch(text, /repetida/);
});

test("cleanLog colapsa timestamps no formato syslog e ISO com timezone", () => {
  const a = cleanLog("Sep  8 10:12:03 host app: disk full\nSep  8 10:12:09 host app: disk full");
  assert.match(a.text, /disk full {2}\[repetida 2x, última em Sep {2}8 10:12:09\]/);
  const b = cleanLog("2026-09-08T10:12:03.123Z WARN slow\n2026-09-08T10:12:04.456Z WARN slow");
  assert.match(b.text, /\[repetida 2x/);
});

test("cleanLog aceita CRLF, linhas vazias e entrada vazia", () => {
  assert.equal(cleanLog("a\r\n\r\nb\r\n").stats.originalLines, 2);
  const empty = cleanLog("");
  assert.deepEqual(empty.stats, { originalLines: 0, uniqueLines: 0, sentLines: 0, truncated: false });
  assert.equal(cleanLog(null).text, "");
});

test("cleanLog respeita maxLines e prioriza erros, avisos e os logs mais recentes", () => {
  const lines = [];
  for (let i = 0; i < 2000; i++) lines.push(`2026-01-01 10:00:00 INFO request ${i} ok`);
  lines.splice(500, 0, "2026-01-01 10:00:00 ERROR falha-um");
  lines.splice(900, 0, "2026-01-01 10:00:00 WARNING aviso-dois");
  const { text, stats } = cleanLog(lines.join("\n"), { maxLines: 50 });
  assert.equal(stats.truncated, true);
  assert.ok(stats.sentLines <= 50);
  assert.match(text, /falha-um/);
  assert.match(text, /aviso-dois/);
  assert.match(text, /request 1999 ok/);
  assert.doesNotMatch(text, /request 3 ok/);
  // ordem original preservada
  assert.ok(text.indexOf("falha-um") < text.indexOf("aviso-dois"));
});

test("cleanLog mantém o stack trace logo abaixo do erro", () => {
  const lines = ["2026-01-01 10:00:00 ERROR boom", "    at a (x.js:1)", "    at b (x.js:2)"];
  for (let i = 0; i < 100; i++) lines.push(`2026-01-01 10:00:00 INFO ok ${i}`);
  const { text } = cleanLog(lines.join("\n"), { maxLines: 10 });
  assert.match(text, /boom/);
  assert.match(text, /at a \(x\.js:1\)/);
  assert.match(text, /at b \(x\.js:2\)/);
});

test("cleanLog respeita maxChars e corta linhas gigantes", () => {
  const lines = [];
  for (let i = 0; i < 200; i++) lines.push(`INFO linha numero ${i} ${"x".repeat(100)}`);
  lines.push(`ERROR final ${"y".repeat(5000)}`);
  const { text, stats } = cleanLog(lines.join("\n"), { maxChars: 3000 });
  assert.ok(text.length <= 3000);
  assert.equal(stats.truncated, true);
  assert.match(text, /ERROR final/);
  const big = cleanLog(`ERROR ${"z".repeat(10000)}`);
  assert.match(big.text, /\[linha truncada\]/);
});

test("redact mascara dados sensíveis e conta as ocorrências", () => {
  const fakeGoogleKey = `AIza${"a".repeat(35)}`;
  const input = [
    "user joao.silva@empresa.com.br logged in from 192.168.10.25",
    "Authorization: Bearer abc.def-123_xyz",
    "password=hunter2 senha: \"minha senha\" api_key=SEGREDO123",
    `jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk1234`,
    `key ${fakeGoogleKey}`,
    "cpf 123.456.789-09 cartao 4111 1111 1111 1111",
  ].join("\n");
  const { text, count } = redact(input);
  for (const leaked of ["joao.silva", "192.168.10.25", "abc.def-123_xyz", "hunter2", "minha senha", "SEGREDO123", "eyJhbGci", fakeGoogleKey, "123.456.789-09", "4111 1111"]) {
    assert.ok(!text.includes(leaked), `vazou: ${leaked}`);
  }
  assert.match(text, /\[EMAIL\]/);
  assert.match(text, /\[IP\]/);
  assert.match(text, /Bearer \[TOKEN\]/);
  assert.match(text, /password=\[REDACTED\]/);
  assert.match(text, /\[JWT\]/);
  assert.match(text, /\[CHAVE\]/);
  assert.match(text, /\[CPF\]/);
  assert.match(text, /\[CARTAO\]/);
  assert.ok(count >= 9);
});

test("redact preserva o que importa para o diagnóstico", () => {
  const input = "2026-09-08 10:12:03 ERROR timeout host db-prod-01:5432 after 30000ms (order 88213) epoch 1700000000000";
  const { text, count } = redact(input);
  assert.equal(text, input);
  assert.equal(count, 0);
});
