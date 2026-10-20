import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/worker.js";

const ORIGIN = "https://usuario.github.io";
const env = { GEMINI_API_KEY: "segredo-do-servidor", ALLOWED_ORIGIN: ORIGIN };

let realFetch;
let upstreamCalls;

beforeEach(() => {
  realFetch = globalThis.fetch;
  upstreamCalls = [];
  globalThis.fetch = async (url, init) => {
    upstreamCalls.push({ url, init });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 });
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const post = (body, headers = {}) =>
  new Request("https://proxy.exemplo.workers.dev/", {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const validBody = { contents: [{ role: "user", parts: [{ text: "<log>x</log>" }] }], generationConfig: { temperature: 0.2 } };

test("encaminha ao Gemini com a chave do servidor e devolve CORS para a origem permitida", async () => {
  const res = await worker.fetch(post(validBody), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(upstreamCalls.length, 1);
  const { url, init } = upstreamCalls[0];
  assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent");
  assert.equal(init.headers["x-goog-api-key"], "segredo-do-servidor");
  assert.ok(!(await res.text()).includes("segredo-do-servidor"));
});

test("repassa só os campos conhecidos (sem ferramentas nem configurações de segurança)", async () => {
  await worker.fetch(post({ ...validBody, tools: [{ googleSearch: {} }], safetySettings: [], cachedContent: "x" }), env);
  const sent = JSON.parse(upstreamCalls[0].init.body);
  assert.deepEqual(Object.keys(sent).sort(), ["contents", "generationConfig"]);
});

test("o modelo vem do servidor, não do cliente, e MODEL inválido volta ao padrão", async () => {
  await worker.fetch(post({ ...validBody, model: "gemini-pro-caro" }), { ...env, MODEL: "gemini-2.5-flash" });
  assert.match(upstreamCalls[0].url, /models\/gemini-2\.5-flash:generateContent$/);
  await worker.fetch(post(validBody), { ...env, MODEL: "../../outra-coisa" });
  assert.match(upstreamCalls[1].url, /models\/gemini-flash-latest:generateContent$/);
});

test("rejeita origem não permitida e não chama o Gemini", async () => {
  for (const origin of ["https://malicioso.example", "", "https://usuario.github.io.malicioso.example"]) {
    const res = await worker.fetch(post(validBody, { Origin: origin }), env);
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  }
  assert.equal(upstreamCalls.length, 0);
});

test("responde ao preflight CORS só para a origem permitida", async () => {
  const ok = await worker.fetch(new Request("https://p/", { method: "OPTIONS", headers: { Origin: ORIGIN } }), env);
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  const bad = await worker.fetch(new Request("https://p/", { method: "OPTIONS", headers: { Origin: "https://x.example" } }), env);
  assert.equal(bad.status, 403);
});

test("só aceita POST", async () => {
  const res = await worker.fetch(new Request("https://p/", { method: "GET", headers: { Origin: ORIGIN } }), env);
  assert.equal(res.status, 405);
});

test("valida corpo: JSON inválido, sem contents e acima do limite", async () => {
  assert.equal((await worker.fetch(post("{nao-json"), env)).status, 400);
  assert.equal((await worker.fetch(post({ foo: 1 }), env)).status, 400);
  const huge = { contents: [{ parts: [{ text: "x".repeat(301 * 1024) }] }] };
  assert.equal((await worker.fetch(post(huge), env)).status, 413);
  assert.equal(upstreamCalls.length, 0);
});

test("falha de forma clara quando o proxy está mal configurado", async () => {
  const res = await worker.fetch(post(validBody), { ALLOWED_ORIGIN: ORIGIN });
  assert.equal(res.status, 500);
  assert.equal(upstreamCalls.length, 0);
});

test("propaga o status do Gemini (ex.: 429) mantendo o CORS", async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "quota" } }), { status: 429 });
  const res = await worker.fetch(post(validBody), env);
  assert.equal(res.status, 429);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

test("devolve 502 quando o Gemini está inalcançável", async () => {
  globalThis.fetch = async () => {
    throw new TypeError("network");
  };
  const res = await worker.fetch(post(validBody), env);
  assert.equal(res.status, 502);
});
