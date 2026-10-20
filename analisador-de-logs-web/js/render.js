// Renderização do relatório. Todo texto vindo do modelo entra via textContent
// (nunca innerHTML), então um log malicioso não consegue injetar HTML/JS na página.

import { SEVERITIES } from "./gemini.js";

export const SEVERITY_LABEL = { critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa" };

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function field(doc, label, value, { code = false } = {}) {
  if (!value) return null;
  const wrap = el(doc, "div", "field");
  wrap.append(el(doc, "h4", "", label));
  wrap.append(code ? el(doc, "pre", "evidence", value) : el(doc, "p", "", value));
  return wrap;
}

export function renderResult(container, data, doc = container.ownerDocument) {
  container.replaceChildren();

  const summary = el(doc, "section", "summary");
  summary.append(el(doc, "h2", "", "Resumo geral"));
  summary.append(el(doc, "p", "summary-text", data.resumo || "Sem resumo."));
  container.append(summary);

  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0]));
  data.problemas.forEach((p) => {
    counts[p.severidade] += 1;
  });

  const problemsHead = el(doc, "div", "problems-head");
  problemsHead.append(el(doc, "h2", "", `Problemas encontrados (${data.problemas.length})`));
  const chips = el(doc, "div", "chips");
  for (const sev of SEVERITIES) {
    if (counts[sev] === 0) continue;
    chips.append(el(doc, "span", `chip sev-${sev}`, `${SEVERITY_LABEL[sev]}: ${counts[sev]}`));
  }
  problemsHead.append(chips);
  container.append(problemsHead);

  if (data.problemas.length === 0) {
    container.append(el(doc, "p", "empty", "Nenhum problema relevante encontrado neste log."));
  }

  for (const problem of data.problemas) {
    const card = el(doc, "article", `problem sev-${problem.severidade}`);
    const head = el(doc, "header", "problem-head");
    head.append(el(doc, "span", `badge sev-${problem.severidade}`, SEVERITY_LABEL[problem.severidade]));
    head.append(el(doc, "h3", "", problem.titulo));
    card.append(head);
    for (const f of [
      field(doc, "Causa provável", problem.causa_provavel),
      field(doc, "Correção sugerida", problem.correcao_sugerida),
      field(doc, "Evidência no log", problem.evidencia, { code: true }),
    ]) {
      if (f) card.append(f);
    }
    container.append(card);
  }

  if (data.recomendacoes_preventivas.length > 0) {
    const prevent = el(doc, "section", "prevent");
    prevent.append(el(doc, "h2", "", "Recomendações preventivas"));
    const list = el(doc, "ul");
    data.recomendacoes_preventivas.forEach((r) => list.append(el(doc, "li", "", r)));
    prevent.append(list);
    container.append(prevent);
  }
}

export function toMarkdown(data, now = new Date()) {
  const out = ["# Análise de log", "", `_Gerado em ${now.toISOString()}_`, "", "## Resumo geral", "", data.resumo || "Sem resumo.", ""];
  out.push(`## Problemas encontrados (${data.problemas.length})`, "");
  if (data.problemas.length === 0) out.push("Nenhum problema relevante encontrado.", "");
  data.problemas.forEach((p, i) => {
    out.push(`### ${i + 1}. [${SEVERITY_LABEL[p.severidade].toUpperCase()}] ${p.titulo}`, "");
    if (p.causa_provavel) out.push(`**Causa provável:** ${p.causa_provavel}`, "");
    if (p.correcao_sugerida) out.push(`**Correção sugerida:** ${p.correcao_sugerida}`, "");
    if (p.evidencia) out.push("**Evidência:**", "", "```", p.evidencia, "```", "");
  });
  if (data.recomendacoes_preventivas.length > 0) {
    out.push("## Recomendações preventivas", "");
    data.recomendacoes_preventivas.forEach((r) => out.push(`- ${r}`));
    out.push("");
  }
  return out.join("\n");
}
