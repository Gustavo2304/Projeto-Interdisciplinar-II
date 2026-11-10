# HermesPDV

Sistema de Ponto de Venda (PDV) web para pequenos comércios: vendas com várias formas de pagamento,
baixa automática de estoque com alerta de estoque baixo, cadastros, consultas, relatório gerencial
e dashboard com indicadores. Projeto da disciplina **Projeto Interdisciplinar II** (Prof. Rafael Gross).

## O que já funciona (MVP — Aula 6)

| Área | Funcionalidades |
|---|---|
| Autenticação | Login com senha em hash bcrypt, sessão por cookie HttpOnly (token JWT, 8 h), bloqueio após 5 tentativas erradas, três perfis de acesso |
| Cadastros | Produtos (com reposição de estoque), clientes (CPF/CNPJ validado) e usuários — criar, listar, editar, excluir |
| Venda (PDV) | Busca por nome ou código, carrinho, cliente opcional, desconto, pagamento dividido com troco, comprovante para impressão |
| Regras de negócio | RN01 a RN09 aplicadas no servidor (ver tabela abaixo) |
| Consultas | Vendas por período, status, número, cliente ou produto; cancelamento com motivo |
| Gestão | Relatório de vendas com totalizadores (exporta CSV e imprime/salva PDF), dashboard com os indicadores da Aula 3, API de integração em JSON |
| Interface | Layout responsivo (celular e computador), mensagens de sucesso e de erro em português |

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | HTML, CSS e JavaScript (sem frameworks) |
| Back-end | Node.js 20+ com Express (API REST) |
| Banco de dados | PostgreSQL 14+ com a extensão pgcrypto (hash bcrypt) |
| Testes | `node:test`, nativo do Node (sem dependências extras) |

## Como instalar e executar

Pré-requisitos: [Node.js](https://nodejs.org) 20.6 ou superior e [PostgreSQL](https://www.postgresql.org) 14 ou superior.

```bash
# 1. banco de dados (cria o banco hermespdv e carrega os dados de teste)
cd banco
psql -U postgres -f script_criacao.sql
psql -U postgres -d hermespdv -f script_carga.sql

# 2. aplicação
cd ../backend
npm install
cp .env.example .env        # no Windows: copy .env.example .env
#   abra o .env e coloque a senha do seu PostgreSQL e um SESSAO_SEGREDO
npm start                   # abra http://localhost:3000
```

Já tem o banco da Aula 5? Em vez de recriar, rode `psql -U postgres -d hermespdv -f migracao_aula6.sql`
e depois o `script_carga.sql` de novo.

### Usuários de teste

Senha de todos: **`Hermes@2026`**

| Login | Perfil | O que pode fazer |
|---|---|---|
| `helena.adm` | Administrador | Tudo do gerente + cadastros de produtos, clientes e usuários |
| `rafael.gerente` | Gerente | Dashboard, relatórios, consultas, API de integração |
| `bianca.caixa` | Atendente | Registrar e cancelar vendas, consultar estoque e vendas |
| `otavio.caixa` | Atendente inativo | Não consegue entrar (teste) |

Os dados de teste são fictícios (vendas de outubro/2026). O dashboard abre nos últimos 30 dias com movimento.

### Testes automáticos

Com o servidor rodando e os dados de teste carregados:

```bash
cd backend
npm test        # 15 testes: login, perfis, venda, cancelamento, regras, CRUDs, relatório e API
```

## Regras de negócio no código

| Regra | Onde |
|---|---|
| RN01 — soma dos pagamentos = total da venda | `services/vendaService.js` |
| RN02 — não vender acima do estoque | `vendaService.js` + restrição CHECK no banco |
| RN03 — cancelar repõe o estoque | `vendaService.js` (mesma transação) |
| RN04 — perfis de acesso | `middlewares/auth.js` + `routes/index.js` |
| RN05 — produto com venda é inativado, não excluído | `services/produtoService.js` |
| RN06 — CPF/CNPJ válido e único | `services/clienteService.js` + UNIQUE no banco |
| RN07 — alerta de estoque baixo | `repositories/alertaRepository.js` |
| RN08 — cancelamento exige motivo | `vendaService.js` |
| RN09 — troco em pagamento em dinheiro | `vendaService.js` |

## API (resumo)

Todas as rotas ficam em `/api` e, exceto o login, exigem sessão.

| Método e rota | Perfis | Descrição |
|---|---|---|
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/sessao` | todos | Sessão |
| `GET /produtos`, `GET /produtos/:id` | todos | Busca (`?busca=`, `?baixo=true`, `?inativos=true`) |
| `POST /produtos`, `PUT /produtos/:id`, `PATCH /produtos/:id/estoque`, `DELETE /produtos/:id` | administrador | Cadastro e reposição |
| `GET /clientes` · `POST`, `PUT`, `DELETE /clientes/:id` | todos · administrador | Clientes |
| `GET`, `POST`, `PUT`, `DELETE /usuarios` | administrador | Usuários |
| `GET /vendas`, `GET /vendas/:id` | todos | Consulta (`?inicio=&fim=&status=&numero=&cliente=&produto=`) |
| `POST /vendas`, `POST /vendas/:id/cancelar` | atendente | Registrar e cancelar |
| `GET /relatorios/vendas`, `GET /relatorios/vendas.csv`, `GET /dashboard` | gerente, administrador | Gestão |
| `GET /integracao/vendas?inicio=&fim=` | gerente, administrador | Vendas com itens e pagamentos em JSON |

## Estrutura do repositório

```
backend/
  src/
    config/         conexão com o banco e transações
    routes/         rotas da API e permissões por perfil
    controllers/    HTTP <-> serviços
    services/       regras de negócio
    repositories/   SQL (sempre parametrizado)
    middlewares/    autenticação, erros, cabeçalhos de segurança
    utils/          token de sessão e validações
  tests/            testes automáticos da API
frontend/
  pages/            telas (login, painel, PDV, comprovante, vendas, produtos, clientes, usuários, relatórios)
  js/               um script por tela + app.js (funções comuns)
  css/              estilo único, responsivo e com layout de impressão
banco/              scripts SQL, migração, consultas, dicionário de dados e diagramas
docs/               documentação das aulas
```

## Publicar na nuvem (opcional)

Qualquer serviço que rode Node.js e ofereça PostgreSQL serve (por exemplo Render ou Railway; confira as condições
do plano gratuito no momento da publicação).

1. Crie o banco PostgreSQL no serviço e execute nele a **PARTE 2** de `banco/script_criacao.sql` e o `script_carga.sql`.
2. Crie o serviço web apontando para este repositório: diretório `backend`, comando de instalação `npm install`
   e comando de início `node src/server.js`.
3. Configure as variáveis de ambiente: `DATABASE_URL` (URL de conexão do banco), `PGSSL=true`,
   `SESSAO_SEGREDO` (texto longo e aleatório) e `NODE_ENV=production`.

## Equipe

| Integrante | Papel | GitHub |
|---|---|---|
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |

## Como trabalhamos

- `main` guarda a versão estável; cada funcionalidade é feita numa branch `feature/<nome>` e entra por pull request,
  revisado por outro integrante.
- Commits pequenos, com mensagem no imperativo explicando o que mudou (ex.: `Adiciona filtro por status na consulta de vendas`).
- Antes de abrir o pull request: `npm test` passando.
