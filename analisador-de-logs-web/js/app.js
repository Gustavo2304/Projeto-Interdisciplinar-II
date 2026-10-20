// Cola a interface: chave -> log -> pré-processamento -> Gemini -> resultado.
// init() recebe o document e as dependências, o que permite testá-lo com jsdom.

import { CONFIG } from "./config.js";
import { cleanLog, redact } from "./preprocess.js";
import { analyzeLog, GeminiError } from "./gemini.js";
import { renderResult, toMarkdown } from "./render.js";

const KEY_STORAGE = "log-analyzer:gemini-key";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 90_000;

function safeStorage(win) {
  // sessionStorage pode lançar exceção (modo privado, cookies bloqueados): cai para memória.
  try {
    const s = win.sessionStorage;
    s.setItem("__probe", "1");
    s.removeItem("__probe");
    return s;
  } catch {
    const mem = new Map();
    return {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => void mem.set(k, String(v)),
      removeItem: (k) => void mem.delete(k),
    };
  }
}

function readWithReader(win, file) {
  return new Promise((resolve, reject) => {
    const reader = new win.FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function saveText(doc, filename, text) {
  const win = doc.defaultView;
  const url = win.URL.createObjectURL(new win.Blob([text], { type: "text/markdown;charset=utf-8" }));
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  doc.body.append(a);
  a.click();
  a.remove();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
}

/**
 * @param {Document} doc
 * @param {{analyze?: Function, storage?: Storage, timeoutMs?: number, download?: Function,
 *          readFile?: Function, fetchSample?: Function, usesProxy?: boolean}} [deps]
 */
export function init(doc = document, deps = {}) {
  const win = doc.defaultView;
  const $ = (id) => doc.getElementById(id);

  const analyze = deps.analyze ?? analyzeLog;
  const storage = deps.storage ?? safeStorage(win);
  const timeoutMs = deps.timeoutMs ?? TIMEOUT_MS;
  const download = deps.download ?? ((name, text) => saveText(doc, name, text));
  const readFile = deps.readFile ?? ((file) => readWithReader(win, file));
  const usesProxy = deps.usesProxy ?? Boolean(CONFIG.PROXY_URL);
  const fetchSample =
    deps.fetchSample ??
    (async () => {
      const res = await win.fetch("sample/teste.log");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.text();
    });

  const keySection = $("key-section");
  const keyInput = $("key-input");
  const keyToggle = $("key-toggle");
  const keyRemember = $("key-remember");
  const dropzone = $("dropzone");
  const fileInput = $("file-input");
  const logInput = $("log-input");
  const redactBox = $("redact-box");
  const sampleBtn = $("sample-btn");
  const analyzeBtn = $("analyze-btn");
  const clearBtn = $("clear-btn");
  const statusEl = $("status");
  const resultSection = $("result");
  const resultBody = $("result-body");
  const resultStats = $("result-stats");
  const downloadBtn = $("download-btn");

  let busy = false;
  let lastReport = null;

  function setStatus(kind, message) {
    statusEl.dataset.kind = kind;
    statusEl.textContent = message;
    statusEl.hidden = !message;
  }

  function setBusy(value) {
    busy = value;
    analyzeBtn.disabled = value;
    analyzeBtn.textContent = value ? "Analisando…" : "Analisar log";
  }

  // --- chave da API -------------------------------------------------------
  if (usesProxy) {
    keySection.hidden = true;
  } else {
    const saved = storage.getItem(KEY_STORAGE);
    if (saved) {
      keyInput.value = saved;
      keyRemember.checked = true;
    }
  }

  function persistKey() {
    if (keyRemember.checked && keyInput.value.trim()) storage.setItem(KEY_STORAGE, keyInput.value.trim());
    else storage.removeItem(KEY_STORAGE);
  }
  keyRemember.addEventListener("change", persistKey);
  keyInput.addEventListener("change", persistKey);

  keyToggle.addEventListener("click", () => {
    const show = keyInput.type === "password";
    keyInput.type = show ? "text" : "password";
    keyToggle.textContent = show ? "Ocultar" : "Mostrar";
    keyToggle.setAttribute("aria-pressed", String(show));
  });

  // --- entrada do log -----------------------------------------------------
  async function loadFromFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setStatus("error", "O arquivo tem mais de 5 MB. Envie apenas o trecho relevante do log.");
      return;
    }
    try {
      logInput.value = await readFile(file);
      setStatus("idle", `Arquivo "${file.name}" carregado. Revise o conteúdo e clique em Analisar log.`);
    } catch {
      setStatus("error", "Não foi possível ler o arquivo. Tente colar o conteúdo na caixa de texto.");
    }
  }

  fileInput.addEventListener("change", async () => {
    await loadFromFile(fileInput.files?.[0]);
    fileInput.value = "";
  });
  for (const type of ["dragenter", "dragover"]) {
    dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      dropzone.classList.add("is-over");
    });
  }
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-over"));
  dropzone.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-over");
    await loadFromFile(e.dataTransfer?.files?.[0]);
  });

  sampleBtn.addEventListener("click", async () => {
    try {
      logInput.value = await fetchSample();
      setStatus("idle", "Log de exemplo carregado. Clique em Analisar log.");
    } catch {
      setStatus("error", "Não foi possível carregar o exemplo. Cole um log na caixa de texto.");
    }
  });

  clearBtn.addEventListener("click", () => {
    logInput.value = "";
    lastReport = null;
    resultBody.replaceChildren();
    resultSection.hidden = true;
    setStatus("idle", "");
  });

  // --- análise ------------------------------------------------------------
  analyzeBtn.addEventListener("click", async () => {
    if (busy) return;

    if (!logInput.value.trim()) {
      setStatus("error", "Cole ou carregue um log antes de analisar.");
      return;
    }
    const apiKey = keyInput.value.trim();
    if (!usesProxy && !apiKey) {
      setStatus("error", "Informe sua chave da API Gemini (passo 1) para continuar.");
      keyInput.focus();
      return;
    }
    persistKey();

    const { text: cleaned, stats } = cleanLog(logInput.value, {
      maxLines: CONFIG.MAX_LINES,
      maxChars: CONFIG.MAX_CHARS,
    });
    let payload = cleaned;
    let masked = 0;
    if (redactBox.checked) {
      const r = redact(cleaned);
      payload = r.text;
      masked = r.count;
    }

    setBusy(true);
    setStatus("loading", `Analisando ${stats.sentLines} linhas com o Gemini… isso leva alguns segundos.`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const report = await analyze(payload, { apiKey, signal: controller.signal });
      lastReport = report;
      renderResult(resultBody, report, doc);

      const parts = [`Enviadas ${stats.sentLines} de ${stats.originalLines} linhas (${stats.uniqueLines} únicas)`];
      if (stats.truncated) parts.push("log reduzido, priorizando erros e avisos");
      if (masked > 0) parts.push(`${masked} dado(s) sensível(is) mascarado(s)`);
      resultStats.textContent = parts.join(" · ");

      resultSection.hidden = false;
      setStatus("ok", "Análise concluída.");
      resultSection.scrollIntoView?.({ behavior: "smooth", block: "start" });
    } catch (err) {
      if (err instanceof GeminiError) setStatus("error", err.message);
      else setStatus("error", "Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  });

  downloadBtn.addEventListener("click", () => {
    if (lastReport) download("analise-de-log.md", toMarkdown(lastReport));
  });
}
