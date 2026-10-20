// Pré-processamento do log, executado no navegador antes de enviar ao modelo:
//   1. cleanLog  -> remove ruído, colapsa linhas repetidas e limita o tamanho
//   2. redact    -> mascara e-mails, IPs, tokens, senhas, CPF e cartões

const TS_SOURCES = [
  String.raw`\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?`, // 2026-09-08 10:12:03
  String.raw`\d{2}/\d{2}/\d{4}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?`, // 08/09/2026 10:12:03
  String.raw`\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}(?: [+-]\d{4})?`, // 08/Sep/2026:10:12:03 +0000
  String.raw`[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}`, // Sep  8 10:12:03 (syslog)
  String.raw`\d{2}:\d{2}:\d{2}(?:[.,]\d+)?`, // 10:12:03
];
const TS_FIRST = new RegExp(TS_SOURCES.join("|"));
const TS_ALL = new RegExp(TS_SOURCES.join("|"), "g");

const HIGH_RE = /\b(CRITICAL|FATAL|SEVERE|EMERG(?:ENCY)?|PANIC|ERROR|ERR|EXCEPTION|FAILED|FAILURE)\b/i;
const WARN_RE = /\bWARN(?:ING)?\b/i;
const CONTINUATION_RE = /^\s+\S|^(?:at\s|Caused by:|Traceback|File ")/;

const MAX_LINE_CHARS = 2000;

function severityOf(line) {
  if (HIGH_RE.test(line)) return 2;
  if (WARN_RE.test(line)) return 1;
  return 0;
}

function formatEntry(entry) {
  let line = entry.line;
  if (line.length > MAX_LINE_CHARS) line = `${line.slice(0, MAX_LINE_CHARS)}…[linha truncada]`;
  if (entry.count > 1) {
    const last = entry.lastTs && entry.lastTs !== entry.firstTs ? `, última em ${entry.lastTs}` : "";
    line += `  [repetida ${entry.count}x${last}]`;
  }
  return line;
}

function pickEntries(entries, maxLines) {
  if (entries.length <= maxLines) return { picked: entries, truncated: false };

  const important = entries.filter((e) => e.important);
  const normal = entries.filter((e) => !e.important);

  let keptImportant = important;
  if (important.length > maxLines) {
    // Muitos erros: mantém o começo (causa raiz costuma estar lá) e o fim (estado atual).
    const head = Math.floor(maxLines * 0.25);
    keptImportant = [...important.slice(0, head), ...important.slice(important.length - (maxLines - head))];
  }
  const room = maxLines - keptImportant.length;
  const keptNormal = room > 0 ? normal.slice(-room) : [];

  const picked = [...keptImportant, ...keptNormal].sort((a, b) => a.idx - b.idx);
  return { picked, truncated: true };
}

/**
 * @param {string} raw
 * @param {{maxLines?: number, maxChars?: number}} [opts]
 * @returns {{text: string, stats: {originalLines: number, uniqueLines: number, sentLines: number, truncated: boolean}}}
 */
export function cleanLog(raw, { maxLines = 800, maxChars = 120000 } = {}) {
  const lines = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() !== "");

  // Colapsa linhas iguais, ignorando o timestamp (a primeira ocorrência fica no lugar).
  const entries = [];
  const byKey = new Map();
  for (const line of lines) {
    const key = line.replace(TS_ALL, "<ts>");
    const ts = line.match(TS_FIRST)?.[0] ?? "";
    const found = byKey.get(key);
    if (found) {
      found.count += 1;
      if (ts) found.lastTs = ts;
      continue;
    }
    const entry = {
      line,
      count: 1,
      firstTs: ts,
      lastTs: ts,
      idx: entries.length,
      level: severityOf(line),
      important: false,
    };
    byKey.set(key, entry);
    entries.push(entry);
  }

  // Importante = erro/aviso, ou continuação (stack trace) logo após algo importante.
  entries.forEach((entry, i) => {
    const continuation = CONTINUATION_RE.test(entry.line) && i > 0 && entries[i - 1].important;
    entry.important = entry.level >= 1 || continuation;
  });

  const { picked, truncated: byLines } = pickEntries(entries, maxLines);

  // Orçamento de caracteres: descarta primeiro as linhas comuns mais antigas.
  let kept = picked.map((entry) => ({ entry, text: formatEntry(entry) }));
  let total = kept.reduce((sum, k) => sum + k.text.length + 1, 0);
  let byChars = false;
  while (total > maxChars && kept.length > 1) {
    let drop = kept.findIndex((k) => !k.entry.important);
    if (drop === -1) drop = 0;
    total -= kept[drop].text.length + 1;
    kept.splice(drop, 1);
    byChars = true;
  }

  let text = kept.map((k) => k.text).join("\n");
  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
    byChars = true;
  }

  return {
    text,
    stats: {
      originalLines: lines.length,
      uniqueLines: entries.length,
      sentLines: kept.length,
      truncated: byLines || byChars,
    },
  };
}

const REDACTIONS = [
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g, "[JWT]"],
  [/\bBearer\s+[\w.~+/-]+=*/gi, "Bearer [TOKEN]"],
  [/\b(?:AIza[\w-]{20,}|sk-[\w-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16})\b/g, "[CHAVE]"],
  [
    /\b(password|passwd|pwd|senha|secret|token|api[_-]?key|apikey|access[_-]?key)\b(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)/gi,
    "$1$2[REDACTED]",
  ],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL]"],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF]"],
  [/\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,4}\b/g, "[CARTAO]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP]"],
];

/**
 * Mascara dados sensíveis comuns. Não é garantia de anonimização: revise o log.
 * @param {string} text
 * @returns {{text: string, count: number}}
 */
export function redact(text) {
  let count = 0;
  let out = String(text ?? "");
  for (const [pattern, replacement] of REDACTIONS) {
    out = out.replace(pattern, (...args) => {
      count += 1;
      // Reaproveita grupos de captura ($1, $2) quando o padrão os usa.
      return replacement.replace(/\$(\d)/g, (_, n) => (typeof args[Number(n)] === "string" ? args[Number(n)] : ""));
    });
  }
  return { text: out, count };
}
