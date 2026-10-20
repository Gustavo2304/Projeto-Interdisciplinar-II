// Proxy OPCIONAL (Cloudflare Workers, plano gratuito) que guarda a chave do Gemini no servidor.
// Com ele, quem visita o site não precisa de chave própria e a sua nunca chega ao navegador.
//
// Variáveis no painel do Cloudflare (Settings -> Variables and Secrets):
//   GEMINI_API_KEY  (Secret)  a sua chave
//   ALLOWED_ORIGIN  (Text)    ex.: https://seu-usuario.github.io   (sem barra no final e sem /repositorio)
//   MODEL           (Text, opcional)  padrão: gemini-flash-latest
//
// Limitação honesta: o cabeçalho Origin só impede OUTROS SITES de usarem o proxy via navegador.
// Quem chamar o Worker por script (curl) consegue forjá-lo. Ative também um limite de taxa
// (Cloudflare -> Security -> WAF -> Rate limiting rules) e acompanhe o uso no Google AI Studio.

const MAX_BODY_BYTES = 300 * 1024;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
const FORWARDED_FIELDS = ["systemInstruction", "contents", "generationConfig"];

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

export default {
  async fetch(request, env) {
    if (!env.GEMINI_API_KEY || !env.ALLOWED_ORIGIN) {
      return json({ error: { message: "Proxy mal configurado: defina GEMINI_API_KEY e ALLOWED_ORIGIN." } }, 500);
    }

    const origin = request.headers.get("Origin") ?? "";
    const originAllowed = origin === env.ALLOWED_ORIGIN;
    const cors = originAllowed
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          Vary: "Origin",
        }
      : { Vary: "Origin" };

    if (request.method === "OPTIONS") {
      return originAllowed ? new Response(null, { status: 204, headers: cors }) : json({ error: { message: "Origem não permitida." } }, 403, cors);
    }
    if (request.method !== "POST") return json({ error: { message: "Use POST." } }, 405, { ...cors, Allow: "POST, OPTIONS" });
    if (!originAllowed) return json({ error: { message: "Origem não permitida." } }, 403, cors);

    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return json({ error: { message: "Log grande demais (limite de 300 KB)." } }, 413, cors);
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      return json({ error: { message: "JSON inválido." } }, 400, cors);
    }
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.contents)) {
      return json({ error: { message: "Corpo inválido: 'contents' é obrigatório." } }, 400, cors);
    }

    // Só repassa campos conhecidos: o proxy não pode virar um Gemini aberto com ferramentas.
    const body = {};
    for (const field of FORWARDED_FIELDS) if (field in payload) body[field] = payload[field];

    const model = /^gemini-[\w.-]+$/.test(env.MODEL ?? "") ? env.MODEL : "gemini-flash-latest";

    let upstream;
    try {
      upstream = await fetch(`${GEMINI_BASE}${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify(body),
      });
    } catch {
      return json({ error: { message: "Falha ao contatar o Gemini." } }, 502, cors);
    }

    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/json; charset=utf-8", ...cors },
    });
  },
};
