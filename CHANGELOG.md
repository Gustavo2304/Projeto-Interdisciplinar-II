# Histórico de versões

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o
[Versionamento Semântico](https://semver.org/lang/pt-BR/).

Equipe: Gustavo Pinheiro Correia, Gustavo Cena Viana e Matheus Alvez — Fatec Jundiaí, Gestão da Tecnologia da Informação.

## [1.0.0] — 2026-11-29 — entrega final (Aula 7)

### Corrigido
- **D01 (alta):** o carrinho podia ser alterado na etapa de pagamento, deixando o total desatualizado; agora fica travado até "Voltar aos itens".
- **D02 (média):** desconto inválido era ignorado em silêncio; agora o campo é destacado e o pagamento fica bloqueado até corrigir.
- **D03 (média):** datas inexistentes (ex.: 31/02) nos filtros geravam erro interno; agora respondem 400 com mensagem.
- **D04 (baixa):** mensagens de identificador inválido com concordância errada.
- **D05 (baixa):** `%` e `_` na busca funcionavam como curingas do SQL.
- **D06 (baixa):** "Exportar CSV" não funcionava antes de o relatório carregar.
- **D07 (baixa):** a mensagem "Sua sessão terminou" aparecia para quem nunca tinha entrado.

### Adicionado
- Testes automáticos de regressão dos defeitos D03, D04 e D05 (total: 18 testes).
- Plano de testes funcionais com 27 casos, defeitos e evidências (`docs/testes`).
- Documentação final consolidada em PDF (`docs/documentacao`).

### Alterado
- Diagramas BPMN, UML e de banco atualizados para refletir o sistema entregue.

## [0.6.0] — 2026-11-15 — MVP (Aula 6)

### Adicionado
- Aplicação web completa: login com perfis, cadastros, PDV com pagamento dividido e troco, comprovante,
  consulta e cancelamento de vendas, relatório (CSV e PDF), dashboard com indicadores e API de integração.
- Coluna `venda.iniciada_em`, extensão pgcrypto e fuso de Brasília (`banco/migracao_aula6.sql`).
- 15 testes automáticos da API.

## [0.5.0] — 2026-11-01 — banco de dados (Aula 5)

### Adicionado
- Modelo conceitual, modelo lógico, scripts de criação e carga, consultas e primeiro CRUD (produtos).

## [0.4.0] — 2026-10-18 — modelagem (Aula 4)

### Adicionado
- Casos de uso, classes, sequência, arquitetura e protótipo das telas.
