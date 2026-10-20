# Analisador de Logs com IA (versão Web)

Site estático (HTML + CSS + JavaScript puro, sem build) que recebe um log, pré-processa no navegador e pede um diagnóstico à API gratuita do **Google Gemini**: resumo geral, problemas por severidade (crítica, alta, média, baixa), causa provável, correção sugerida, evidência no log e recomendações preventivas.

Como é 100% estático, ele publica de graça no **GitHub Pages** (o "domínio" será `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`).

```
Navegador ──► limpa o log (colapsa repetições, limita tamanho)
          ──► mascara dados sensíveis (opcional, ligado por padrão)
          ──► Gemini API (JSON estruturado)  ──► relatório na tela / .md
```

## 1. Testar no seu computador

Os módulos ES (`import`) **não funcionam abrindo o `index.html` com duplo clique** (`file://`). Sirva a pasta por HTTP:

```bash
python -m http.server 8000      # Windows: py -m http.server 8000
```

Abra <http://localhost:8000>, cole sua chave (passo abaixo), clique em **Usar log de exemplo** e depois em **Analisar log**.

## 2. Criar a chave gratuita do Gemini

1. Entre em <https://aistudio.google.com/app/apikey> com sua conta Google.
2. Crie uma chave e copie (começa com `AIza…`).
3. Cole no campo do passo 1 do site. A chave fica **só no navegador** e é enviada apenas ao Google.

Os limites da camada gratuita mudam com o tempo; se aparecer "Limite gratuito de uso atingido", espere um minuto ou envie um log menor.

## 3. Publicar no GitHub Pages

**Pelo site do GitHub (sem instalar nada):**

1. Em <https://github.com/new> crie um repositório **público** (ex.: `analisador-de-logs`).
2. Clique em **uploading an existing file** e arraste **o conteúdo** desta pasta: `index.html`, `css/`, `js/`, `sample/`, `worker/`, `tests/`, `README.md`, `package.json`, `.nojekyll`.
   O `index.html` precisa ficar **na raiz** do repositório, não dentro de uma subpasta.
3. Clique em **Commit changes**.
4. Vá em **Settings → Pages**. Em *Build and deployment*, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)` e clique em **Save**.
5. Após 1 a 2 minutos o endereço aparece no topo da página de Pages.

**Pelo terminal:**

```bash
git init -b main
git add .
git commit -m "Analisador de logs com IA (web)"
git remote add origin https://github.com/SEU-USUARIO/analisador-de-logs.git
git push -u origin main
```

Depois faça o passo 4 acima. Para usar um domínio próprio (opcional), veja *Settings → Pages → Custom domain*.

> Pages gratuito exige repositório público. **Nunca** coloque chaves de API em arquivos do repositório.

## 4. Segurança e privacidade (leia)

| Assunto | Como está tratado |
|---|---|
| **Chave da API** | Cada pessoa usa a **própria chave** (BYOK). Ela não vai para o GitHub nem para este site; só para `generativelanguage.googleapis.com`, no cabeçalho `x-goog-api-key`. Opcionalmente fica em `sessionStorage` (some ao fechar a aba). O Google recomenda não expor chaves no cliente; por isso nada de chave fixa no código. |
| **Chave fixa para todos?** | Não faça isso em site estático: qualquer visitante a extrai. Se quiser que o site funcione sem pedir chave, use o proxy da seção 5. |
| **Privacidade do log** | Na camada **gratuita** do Gemini, prompts e respostas **podem ser usados pelo Google para melhorar produtos e lidos por revisores humanos**. Não envie logs com dados de clientes ou segredos. A opção "Mascarar…" ajuda (e-mail, IP, token, senha, CPF, cartão), mas **não é garantia**: revise o log. |
| **XSS** | Tudo que vem do modelo é exibido com `textContent`; nenhum `innerHTML`. |
| **Prompt injection** | O log vai delimitado por `<log>…</log>`, o prompt de sistema o declara "dado não confiável" e `</log>` dentro do log é neutralizado. Reduz o risco, não o elimina: trate o diagnóstico como sugestão. |
| **CSP** | `index.html` restringe scripts ao próprio site e conexões ao Gemini (e a `*.workers.dev`). |
| **Diagnóstico de IA** | Pode errar. Valide antes de aplicar qualquer correção em produção. |

## 5. Opcional: proxy que esconde a chave (Cloudflare Workers, plano gratuito)

Use se quiser que os visitantes **não precisem de chave**. A sua chave fica como segredo no servidor.

1. Em <https://dash.cloudflare.com> → **Workers & Pages → Create → Hello World**, dê um nome e **Deploy**.
2. **Edit code**, apague o exemplo, cole o conteúdo de `worker/worker.js` e **Deploy**.
3. Em **Settings → Variables and Secrets** adicione:
   - `GEMINI_API_KEY` (tipo **Secret**): sua chave;
   - `ALLOWED_ORIGIN` (tipo Text): `https://SEU-USUARIO.github.io` (sem barra final e sem o nome do repositório).
4. Copie a URL do Worker (`https://NOME.SEU-SUBDOMINIO.workers.dev`) para `PROXY_URL` em `js/config.js` e faça commit. O campo de chave some da página.
5. Se o Worker estiver em outro domínio que não `workers.dev`, adicione-o em `connect-src` na tag CSP do `index.html`.

**Limitações honestas:** a cota gratuita passa a ser **sua e compartilhada por todos os visitantes**. O Worker só aceita a sua origem, aceita no máximo 300 KB e repassa só os campos esperados, mas o cabeçalho `Origin` pode ser forjado por scripts fora do navegador. Ative uma regra de **Rate limiting** no Cloudflare e acompanhe o uso no Google AI Studio.

## 6. Estrutura

```
index.html            página (CSP, formulário, resultado)
css/style.css         tema escuro/claro, responsivo
js/config.js          modelo, limites e PROXY_URL
js/preprocess.js      cleanLog (colapsa/limita) e redact (mascara)
js/gemini.js          prompt, esquema JSON, chamada à API, erros
js/render.js          relatório na tela e exportação Markdown
js/app.js             interação da página
js/main.js            ponto de entrada
worker/worker.js      proxy opcional (Cloudflare)
sample/teste.log      log de exemplo
tests/                testes
```

## 7. Testes

```bash
npm test                # 33 testes, sem dependências (Node 20+): pré-processamento, cliente Gemini e proxy
```

Teste de interface opcional, em Chromium real com a API do Gemini **simulada** (nenhuma chamada real):

```bash
npm i -D playwright && npx playwright install chromium
npm run test:e2e        # 11 cenários: fluxo completo, erros, XSS, CSP, upload, download, celular
```

## 8. Limitações conhecidas

- Logs muito grandes são reduzidos (800 linhas / 120 mil caracteres): erros e avisos têm prioridade, e linhas repetidas viram uma só com contagem.
- Não lê código-fonte nem junta várias fontes de log (fases futuras do roadmap).
- Os testes simulam o Gemini; a chamada real depende da sua chave e da disponibilidade do modelo `gemini-flash-latest` (altere em `js/config.js` se necessário).
