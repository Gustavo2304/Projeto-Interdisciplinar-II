// Teste de interface de ponta a ponta, em um Chromium de verdade, com a API do Gemini SIMULADA
// (nenhuma chamada real é feita e nenhuma chave real é usada).
//
// Uso (opcional):
//   npm i -D playwright && npx playwright install chromium
//   npm run test:e2e
//
// Variáveis: SHOTS_DIR=pasta  -> salva capturas de tela ali.

import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const SHOTS = process.env.SHOTS_DIR;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".log": "text/plain; charset=utf-8" };
const FAKE_KEY = "AIza-chave-FALSA-para-teste";
const GEMINI = "https://generativelanguage.googleapis.com/**";

// --- servidor estático mínimo ------------------------------------------------
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = join(ROOT, path === "/" || path === "\\" ? "index.html" : path);
  if (!file.startsWith(ROOT)) return void res.writeHead(403).end();
  try {
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(await readFile(file));
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// --- resposta simulada do Gemini ---------------------------------------------
const report = {
  resumo: "A aplicação está instável: o banco de dados perde conexões e pedidos são cobrados sem confirmação.",
  problemas: [
    { titulo: "Pool de conexões esgotado", severidade: "media", causa_provavel: "Consultas lentas retêm conexões.", correcao_sugerida: "Indexar orders.customer_id.", evidencia: "Connection pool exhausted: 0 of 20" },
    { titulo: "Cliente cobrado sem pedido confirmado", severidade: "critica", causa_provavel: "NullReference em calculateShipping.", correcao_sugerida: "Validar o endereço antes de cobrar.", evidencia: "order_processor.js:245" },
    { titulo: "Memória perto do limite", severidade: "alta", causa_provavel: "Possível vazamento.", correcao_sugerida: "Perfilar o heap." },
  ],
  recomendacoes_preventivas: ["Alertar quando o pool passar de 80%.", "Teste automatizado para endereço nulo."],
};
const okBody = (r = report) => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(r) }] } }] });

// --- mini runner -------------------------------------------------------------
const results = [];
async function scenario(name, fn) {
  try {
    await fn();
    results.push([name, true]);
    console.log(`  ok   ${name}`);
  } catch (err) {
    results.push([name, false]);
    console.log(`  FAIL ${name}\n       ${String(err.message).split("\n").join("\n       ")}`);
  }
}

const browser = await chromium.launch();

async function openPage({ viewport = { width: 1100, height: 900 }, gemini } = {}) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const problems = [];
  const requests = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type())) problems.push(`console.${m.type()}: ${m.text()}`);
  });
  await page.route(GEMINI, async (route) => {
    const req = route.request();
    requests.push({ url: req.url(), headers: req.headers(), body: req.postData() });
    await (gemini ? gemini(route) : route.fulfill({ status: 200, contentType: "application/json", body: okBody() }));
  });
  await page.goto(BASE);
  return { context, page, problems, requests };
}

console.log(`E2E em ${BASE}`);

await scenario("carrega sem erros de console nem violações de CSP", async () => {
  const { context, page, problems } = await openPage();
  assert.equal(await page.title(), "Analisador de Logs com IA");
  assert.equal(await page.locator("#result").isHidden(), true);
  assert.equal(await page.locator("#status").isHidden(), true);
  await page.waitForTimeout(200);
  assert.deepEqual(problems, []);
  await context.close();
});

await scenario("valida entradas: sem log e sem chave", async () => {
  const { context, page, requests } = await openPage();
  await page.click("#analyze-btn");
  assert.match(await page.locator("#status").innerText(), /Cole ou carregue um log/);
  await page.fill("#log-input", "ERROR algo");
  await page.click("#analyze-btn");
  assert.match(await page.locator("#status").innerText(), /chave da API Gemini/);
  assert.equal(await page.evaluate(() => document.activeElement.id), "key-input");
  assert.equal(requests.length, 0);
  await context.close();
});

await scenario("fluxo completo: exemplo -> mascara -> chama o Gemini -> renderiza ordenado", async () => {
  const { context, page, problems, requests } = await openPage();
  await page.click("#sample-btn");
  await page.waitForFunction(() => document.getElementById("log-input").value.length > 0);
  const lines = (await page.inputValue("#log-input")).trimEnd().split("\n").length;
  assert.equal(lines, 37);
  await page.fill("#log-input", `${await page.inputValue("#log-input")}\n2026-09-08 10:50:00 ERROR login falhou para maria@empresa.com de 10.20.30.40 password=abc123`);
  await page.fill("#key-input", FAKE_KEY);
  await page.click("#analyze-btn");
  await page.locator("#result").waitFor({ state: "visible" });

  // requisição: chave no cabeçalho (nunca na URL), log colapsado e sem dados sensíveis
  assert.equal(requests.length, 1);
  const req = requests[0];
  assert.equal(req.headers["x-goog-api-key"], FAKE_KEY);
  assert.ok(!req.url.includes(FAKE_KEY));
  const sent = JSON.parse(req.body).contents[0].parts[0].text;
  assert.match(sent, /\[repetida 8x/);
  for (const leaked of ["maria@empresa.com", "10.20.30.40", "abc123"]) assert.ok(!sent.includes(leaked), `vazou ${leaked}`);
  assert.match(sent, /\[EMAIL\]/);

  // resultado
  assert.match(await page.locator(".summary-text").innerText(), /instável/);
  const titles = await page.locator(".problem h3").allInnerTexts();
  assert.deepEqual(titles, ["Cliente cobrado sem pedido confirmado", "Memória perto do limite", "Pool de conexões esgotado"]);
  assert.deepEqual(await page.locator(".problem .badge").allInnerTexts(), ["Crítica", "Alta", "Média"]);
  assert.equal(await page.locator(".prevent li").count(), 2);
  assert.match(await page.locator("#result-stats").innerText(), /Enviadas \d+ de 38 linhas.*mascarado/);
  assert.match(await page.locator("#status").innerText(), /Análise concluída/);
  assert.equal(await page.locator("#analyze-btn").isEnabled(), true);
  assert.deepEqual(problems, []);
  if (SHOTS) {
    await mkdir(SHOTS, { recursive: true });
    await page.screenshot({ path: join(SHOTS, "desktop-resultado.png"), fullPage: true });
  }
  await context.close();
});

await scenario("segurança: HTML vindo do modelo vira texto, nunca é executado", async () => {
  const evil = {
    resumo: '<img src=x onerror="window.__xss=1"> resumo',
    problemas: [{ titulo: '<script>window.__xss=2</script><b>negrito</b>', severidade: "alta", causa_provavel: '<img src=x onerror="window.__xss=3">', correcao_sugerida: "ok", evidencia: "<svg onload=window.__xss=4>" }],
    recomendacoes_preventivas: ['<a href="javascript:window.__xss=5">x</a>'],
  };
  const { context, page } = await openPage({ gemini: (route) => route.fulfill({ status: 200, contentType: "application/json", body: okBody(evil) }) });
  await page.fill("#key-input", FAKE_KEY);
  await page.fill("#log-input", "ERROR x");
  await page.click("#analyze-btn");
  await page.locator("#result").waitFor({ state: "visible" });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator("#result-body img, #result-body script, #result-body svg, #result-body b, #result-body a").count(), 0);
  assert.match(await page.locator(".problem h3").innerText(), /<script>window\.__xss=2<\/script><b>negrito<\/b>/);
  await context.close();
});

await scenario("erros da API aparecem em português e liberam o botão", async () => {
  const cases = [
    [429, { error: { message: "quota" } }, /Limite gratuito/],
    [400, { error: { message: "API key not valid.", details: [{ reason: "API_KEY_INVALID" }] } }, /recusou a chave/],
    [503, { error: { message: "overloaded" } }, /instável/],
  ];
  for (const [status, body, expected] of cases) {
    const { context, page } = await openPage({ gemini: (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }) });
    await page.fill("#key-input", FAKE_KEY);
    await page.fill("#log-input", "ERROR x");
    await page.click("#analyze-btn");
    await page.locator('#status[data-kind="error"]').waitFor();
    assert.match(await page.locator("#status").innerText(), expected);
    assert.equal(await page.locator("#result").isHidden(), true);
    assert.equal(await page.locator("#analyze-btn").isEnabled(), true);
    await context.close();
  }
});

await scenario("falha de rede e botão desabilitado durante a análise", async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const { context, page } = await openPage({
    gemini: async (route) => {
      await gate;
      await route.abort("failed");
    },
  });
  await page.fill("#key-input", FAKE_KEY);
  await page.fill("#log-input", "ERROR x");
  await page.click("#analyze-btn");
  await page.locator('#status[data-kind="loading"]').waitFor();
  assert.equal(await page.locator("#analyze-btn").isDisabled(), true);
  assert.equal(await page.locator("#analyze-btn").innerText(), "Analisando…");
  release();
  await page.locator('#status[data-kind="error"]').waitFor();
  assert.match(await page.locator("#status").innerText(), /conectar à API/);
  assert.equal(await page.locator("#analyze-btn").isEnabled(), true);
  await context.close();
});

await scenario("upload de arquivo: aceita .log e rejeita acima de 5 MB", async () => {
  const { context, page } = await openPage();
  await page.setInputFiles("#file-input", { name: "app.log", mimeType: "text/plain", buffer: Buffer.from("ERROR do arquivo\nINFO ok\n") });
  await page.waitForFunction(() => document.getElementById("log-input").value.includes("do arquivo"));
  assert.match(await page.locator("#status").innerText(), /Arquivo "app\.log" carregado/);
  await page.fill("#log-input", "");
  await page.setInputFiles("#file-input", { name: "grande.log", mimeType: "text/plain", buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 97) });
  await page.locator('#status[data-kind="error"]').waitFor();
  assert.match(await page.locator("#status").innerText(), /mais de 5 MB/);
  assert.equal(await page.inputValue("#log-input"), "");
  await context.close();
});

await scenario("lembrar chave: só na aba (sessionStorage) e some ao desmarcar", async () => {
  const { context, page } = await openPage();
  await page.fill("#key-input", FAKE_KEY);
  await page.fill("#log-input", "ERROR x");
  await page.click("#analyze-btn");
  await page.locator("#result").waitFor({ state: "visible" });
  assert.equal(await page.evaluate(() => sessionStorage.getItem("log-analyzer:gemini-key")), null);
  assert.equal(await page.evaluate(() => localStorage.length), 0);

  await page.check("#key-remember");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("log-analyzer:gemini-key")), FAKE_KEY);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  await page.reload();
  assert.equal(await page.inputValue("#key-input"), FAKE_KEY);
  assert.equal(await page.isChecked("#key-remember"), true);

  await page.uncheck("#key-remember");
  assert.equal(await page.evaluate(() => sessionStorage.getItem("log-analyzer:gemini-key")), null);
  await context.close();
});

await scenario("mostrar/ocultar chave, limpar e baixar o relatório", async () => {
  const { context, page } = await openPage();
  await page.fill("#key-input", FAKE_KEY);
  assert.equal(await page.getAttribute("#key-input", "type"), "password");
  await page.click("#key-toggle");
  assert.equal(await page.getAttribute("#key-input", "type"), "text");
  await page.click("#key-toggle");
  assert.equal(await page.getAttribute("#key-input", "type"), "password");

  await page.fill("#log-input", "ERROR x");
  await page.click("#analyze-btn");
  await page.locator("#result").waitFor({ state: "visible" });
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#download-btn")]);
  assert.equal(download.suggestedFilename(), "analise-de-log.md");
  const { createReadStream } = await import("node:fs");
  const chunks = [];
  for await (const c of createReadStream(await download.path())) chunks.push(c);
  const md = Buffer.concat(chunks).toString("utf8");
  assert.match(md, /^# Análise de log/);
  assert.match(md, /### 1\. \[CRÍTICA\] Cliente cobrado sem pedido confirmado/);

  await page.click("#clear-btn");
  assert.equal(await page.inputValue("#log-input"), "");
  assert.equal(await page.locator("#result").isHidden(), true);
  await context.close();
});

await scenario("CSP bloqueia conexões para domínios não previstos", async () => {
  const { context, page } = await openPage();
  const outcome = await page.evaluate(() => fetch("https://exemplo-malicioso.test/steal").then(() => "permitido", () => "bloqueado"));
  assert.equal(outcome, "bloqueado");
  await context.close();
});

await scenario("layout de celular (375px) sem rolagem horizontal", async () => {
  const { context, page } = await openPage({ viewport: { width: 375, height: 800 } });
  await page.fill("#key-input", FAKE_KEY);
  await page.click("#sample-btn");
  await page.waitForFunction(() => document.getElementById("log-input").value.length > 0);
  await page.click("#analyze-btn");
  await page.locator("#result").waitFor({ state: "visible" });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `rolagem horizontal de ${overflow}px`);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, "mobile-resultado.png"), fullPage: true });
  await context.close();
});

await browser.close();
server.close();

const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} cenários passaram`);
process.exit(failed ? 1 : 0);
