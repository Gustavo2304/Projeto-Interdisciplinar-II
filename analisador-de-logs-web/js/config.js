// Configuração do site.
//
// NUNCA coloque uma chave de API neste arquivo: ele é público no GitHub Pages.
// A chave é digitada pelo usuário na página (modo padrão) ou fica guardada como
// segredo no proxy opcional (veja worker/worker.js e o README).

export const CONFIG = {
  // Alias que sempre aponta para o modelo Flash mais recente da camada gratuita.
  MODEL: "gemini-flash-latest",

  // Vazio = o navegador chama a API do Gemini direto, com a chave do usuário.
  // Preencha com a URL do seu Cloudflare Worker para esconder a chave no servidor,
  // por exemplo "https://analisador-logs.seu-usuario.workers.dev".
  PROXY_URL: "",

  // Limites do que é enviado ao modelo (depois de colapsar linhas repetidas).
  MAX_LINES: 800,
  MAX_CHARS: 120000,
};
