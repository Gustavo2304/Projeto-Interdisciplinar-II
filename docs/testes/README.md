# Testes do HermesPDV (Aula 7)

Três frentes de teste:

1. **Plano de testes funcionais**: 27 casos (abaixo), executados pela interface com um roteiro automatizado (Playwright), recarregando a base de teste antes de cada caso.
2. **Testes automáticos da API**: 18 testes em `backend/tests/api.test.js` (`npm test`), incluindo a regressão dos defeitos D03, D04 e D05.
3. **Testes exploratórios** e **teste de aceitação** com uma pessoa de fora da equipe (registro na documentação final, seção 8.7).

## Resumo das rodadas

| Rodada | Casos | Passaram | Falharam |
|---|---|---|---|
| Rodada 1 — código da Aula 6 | 27 | 23 | 4 |
| Rodada 2 — código final, após as correções | 27 | 27 | 0 |

A rodada 1 foi executada sobre o código entregue na Aula 6; a rodada 2, sobre o código final (v1.0.0).

## Casos de teste

| ID | Cenário (tipo) | Pré-condição | Passos | Resultado esperado | Resultado obtido (rodada 2) | Rodada 1 | Rodada 2 |
|---|---|---|---|---|---|---|---|
| CT01 | Login com usuário e senha válidos (Caminho feliz) | Usuário bianca.caixa ativo | Abrir o sistema; informar bianca.caixa / Hermes@2026; clicar Entrar | Abre o painel com “Olá, Bianca” e menu de atendente | Painel aberto: “Olá, Bianca”; menu: Painel, Nova venda, Vendas, Produtos, Clientes | Passou | Passou |
| CT02 | Login com senha errada (Exceção — dado inválido) | Usuário diego.caixa ativo | Informar diego.caixa / senha errada; clicar Entrar | Mensagem “Usuário ou senha inválidos.”; continua no login | Mensagem: “Usuário ou senha inválidos.” | Passou | Passou |
| CT03 | Login com campos vazios (Exceção — campo vazio) | Tela de login aberta | Clicar Entrar sem preencher | Mensagem “Informe usuário e senha.” | Mensagem: “Informe usuário e senha.” | Passou | Passou |
| CT04 | Login de usuário inativo (Exceção — acesso sem permissão) | Usuário otavio.caixa inativo | Informar otavio.caixa / Hermes@2026; clicar Entrar | Mensagem de usuário inativo; acesso negado | Mensagem: “Usuário inativo. Procure o administrador.” | Passou | Passou |
| CT05 | Abrir tela interna sem estar logado (Exceção — acesso sem permissão) | Navegador sem sessão | Digitar o endereço /pages/vendas.html | Volta para o login pedindo usuário e senha | Endereço final: login.html?expirou=1; mensagem: “Entre com seu usuário e senha para continuar.” | Passou | Passou |
| CT06 | Atendente tenta abrir a tela de usuários (Exceção — acesso sem permissão) | Logado como atendente | Digitar o endereço /pages/usuarios.html | Volta ao painel com aviso “Seu perfil não tem acesso…” | Endereço final: painel.html?negado=1; aviso: “Seu perfil não tem acesso àquela tela.” | Passou | Passou |
| CT07 | Cadastrar produto válido (Caminho feliz) | Logado como administrador | Produtos › Novo produto; preencher código, categoria, nome, preços, estoque; Salvar | Aviso de sucesso e produto na lista | Aviso: “Produto "Granola tradicional 800g" cadastrado.”; banco: Granola tradicional 800g / 22.90 | Passou | Passou |
| CT08 | Cadastrar produto sem os campos obrigatórios (Exceção — campo vazio) | Logado como administrador | Novo produto; preencher só o nome; Salvar | Mensagem pedindo os campos obrigatórios; nada é gravado | Mensagem: “Preencha os campos obrigatórios (*).”; produtos antes/depois: 30/30 | Passou | Passou |
| CT09 | Cadastrar produto com código já existente (Exceção — duplicidade) | Produto 7891000100103 já cadastrado | Novo produto com o código 7891000100103; Salvar | Mensagem “Já existe um produto com este código.” | Mensagem: “Já existe um produto com este código.” | Passou | Passou |
| CT10 | Editar o preço de um produto (Caminho feliz) | Produto “Feijão carioca 1kg” cadastrado | Buscar “feijão”; Editar; preço de venda 8,99; Salvar | Aviso de atualização; novo preço no banco | Aviso: “Produto "Feijão carioca 1kg" atualizado. \| "Feijão carioca 1kg" está com estoque no mínimo: alerta gerado (RN07).”; preço no banco: 8.99 | Passou | Passou |
| CT11 | Excluir produto que já foi vendido (Regra de negócio (RN05)) | Café (id 3) com vendas | Buscar “café”; Excluir; confirmar | Produto apenas inativado, com aviso citando a RN05 | Aviso: “O produto tem vendas registradas e foi inativado (RN05).”; ativo no banco: f | Passou | Passou |
| CT12 | Cadastrar cliente com CPF inválido (Exceção — dado inválido) | Logado como administrador | Clientes › Novo; nome “Marina Lopes”; CPF 111.222.333-44; Salvar | Mensagem de CPF/CNPJ inválido; nada é gravado | Mensagem: “CPF ou CNPJ inválido. Confira os números digitados.” | Passou | Passou |
| CT13 | Cadastrar cliente com CPF já cadastrado (Exceção — duplicidade (RN06)) | Cliente 1 cadastrado | Novo cliente com o CPF da cliente Ana Beatriz Souza; Salvar | Mensagem de CPF/CNPJ já cadastrado (RN06) | Mensagem: “Já existe um cliente com este CPF/CNPJ (RN06).” | Passou | Passou |
| CT14 | Cadastrar usuário com senha fraca (Exceção — dado inválido) | Logado como administrador | Usuários › Novo; nome, login, perfil Atendente, senha “1234”; Salvar | Mensagem exigindo 8 caracteres com letras e números | Mensagem: “A senha deve ter ao menos 8 caracteres, com letras e números.” | Passou | Passou |
| CT15 | Registrar venda com pagamento dividido e troco (Caminho feliz (transação principal)) | Logado como atendente; arroz com estoque 66 | Lançar 2 arroz (R$ 55,80); pagar R$ 30,00 em dinheiro recebendo R$ 50,00 e o restante no PIX; Finalizar | Comprovante com troco de R$ 20,00; estoque do arroz cai para 64 | Comprovante com troco de R$ 20,00; estoque do arroz: 64 | Passou | Passou |
| CT16 | Vender quantidade maior que o estoque (Exceção — regra de negócio (RN02)) | Queijo muçarela com 2 em estoque | Quantidade 5; buscar “queijo”; escolher o produto | Aviso de estoque insuficiente; item não entra no carrinho | Aviso: “Estoque insuficiente: "Queijo muçarela fatiado (kg)" tem 2 em estoque.”; itens no carrinho: 0 | Passou | Passou |
| CT17 | Finalizar com pagamento incompleto (Exceção — regra de negócio (RN01)) | Venda de R$ 27,90 em andamento | Ir para pagamento; lançar R$ 10,00 no PIX | “Finalizar venda” continua desabilitado; restante R$ 17,90 | Finalizar habilitado: não; restante: R$ 17,90 | Passou | Passou |
| CT18 | Alterar itens durante a etapa de pagamento (Exceção — consistência da tela) | Venda de R$ 27,90 com PIX lançado | Na etapa de pagamento, clicar em “+” no item do carrinho | Carrinho travado: quantidade não muda e o total pago continua coerente | Quantidade no carrinho: 1; total do pagamento: R$ 27,90; Finalizar habilitado: sim | Falhou | Passou |
| CT19 | Digitar desconto inválido (Exceção — dado inválido) | Venda de R$ 27,90 em andamento | Digitar “abc” no desconto | Campo destacado com mensagem; “Ir para pagamento” bloqueado | “Ir para pagamento” habilitado: não; mensagem: “Desconto inválido: use um valor entre 0 e o subtotal (ex.: 2,50).” | Falhou | Passou |
| CT20 | Cancelar venda (sem motivo e com motivo) (Caminho feliz + exceção (RN03, RN08)) | Venda 84 concluída | Vendas › Cancelar na venda 84; confirmar sem motivo; depois informar o motivo e confirmar | Sem motivo: bloqueado. Com motivo: venda CANCELADA e estoque reposto | Sem motivo bloqueado: sim; status: CANCELADA; estoque 12,75,5,62,58 → 15,78,6,63,60 | Passou | Passou |
| CT21 | Consultar vendas por período e status (Caminho feliz (RF11)) | Vendas de outubro carregadas | Vendas; período 01/10 a 31/10; status Cancelada; Buscar | Somente as 2 vendas canceladas de outubro | 2 venda(s) listada(s) | Passou | Passou |
| CT22 | Filtro com data inexistente (31/02) (Exceção — dado inválido) | Logado como gerente | Chamar GET /api/vendas?inicio=2026-02-31 | Erro 400 “Data inicial inválida.” (sem erro interno) | HTTP 400: “Data inicial inválida.” | Falhou | Passou |
| CT23 | Buscar cliente digitando “%” (Exceção — dado inválido) | Logado como administrador | Clientes; buscar “%” | Nenhum cliente encontrado (o % é texto comum) | 0 cliente(s) listado(s) | Falhou | Passou |
| CT24 | Exportar relatório de vendas em CSV (Caminho feliz (RF14–RF16)) | Logado como gerente | Relatórios; período outubro; Gerar; Exportar CSV | Arquivo CSV com totalizadores e faturamento de R$ 3.811,82 | Arquivo relatorio_vendas_2026-10-01_a_2026-10-31.csv; linha: “Faturamento líquido (R$);3811,82” | Passou | Passou |
| CT25 | Dashboard com os indicadores da Aula 3 (Caminho feliz (integração)) | Logado como gerente | Painel; período outubro; Atualizar | Cartões de tempo de atendimento, alertas atendidos e reposição preenchidos | TEMPO MÉDIO DE ATENDIMENTO 2 min 01 s do 1º item até finalizar; ALERTAS DE ESTOQUE ATENDIDOS 60% 6 de 10 gerados no período; TEMPO MÉDIO DE REPOSIÇÃO 15,0 h do alerta até o estoque repor | Passou | Passou |
| CT26 | Repor estoque de produto em alerta (Caminho feliz (RN07)) | Pão de forma abaixo do mínimo, com alerta aberto | Produtos; só estoque baixo; Repor no pão de forma; 24 unidades | Saldo somado e alerta encerrado | Aviso: “Estoque de "Pão de forma tradicional 500g" agora é 29. Alerta encerrado.”; alertas abertos do produto: 0 | Passou | Passou |
| CT27 | Usar o sistema no celular (Não funcional (RNF01)) | Tela de 360 px de largura | Entrar como administrador e abrir cada tela | Nenhuma tela com rolagem horizontal; menu vira botão | Larguras: [360] px; botão de menu visível: sim | Passou | Passou |

## Defeitos encontrados e corrigidos

| ID | Defeito | Severidade | Onde | Encontrado em | Responsável (frente) | Correção | Status |
|---|---|---|---|---|---|---|---|
| D01 | Na etapa de pagamento, o carrinho continuava editável: o total do pagamento ficava desatualizado e “Finalizar venda” seguia liberado (o servidor recusava a venda pela RN01). | Alta | PDV (pdv.js) | CT18 | feature/venda | Carrinho travado durante o pagamento; volta a ser editável em “Voltar aos itens”. | Corrigido |
| D02 | Desconto inválido (“abc”, negativo ou maior que o subtotal) era ignorado: a venda seguia sem desconto, só com um aviso passageiro. | Média | PDV (pdv.js) | CT19 | feature/venda | Campo destacado com mensagem fixa; “Ir para pagamento” bloqueado até corrigir. | Corrigido |
| D03 | Data inexistente (31/02) nos filtros gerava erro interno (HTTP 500) em vez de mensagem de validação. | Média | API (validacao.js) | CT22 | feature/gestao | Validação confere se a data existe no calendário; responde 400 “Data inicial inválida.”. | Corrigido |
| D04 | Mensagens com concordância errada: “Venda inválido.”, “Categoria inválido.”. | Baixa | API (services) | Exploratório | feature/cadastros | Mensagens reescritas por contexto (ex.: “Número de venda inválido.”). | Corrigido |
| D05 | Os caracteres % e _ na busca funcionavam como curingas do SQL: buscar “%” listava todos os clientes. | Baixa | API (repositórios) | CT23 | feature/cadastros | Termos escapados antes do ILIKE; % e _ viram texto comum. | Corrigido |
| D06 | “Exportar CSV” clicado antes de o relatório carregar não fazia nada (link vazio). | Baixa | Relatórios | Exploratório | feature/gestao | Link já aponta para o período padrão desde o carregamento. | Corrigido |
| D07 | Quem abria uma tela sem ter entrado via a mensagem “Sua sessão terminou”, mesmo sem sessão anterior. | Baixa | Login | CT05 | feature/autenticacao | Mensagem trocada por “Entre com seu usuário e senha para continuar.”. | Corrigido |

Evidências de antes e depois em [`evidencias/`](evidencias/) (ex.: `D01_pagamento_antes.png` × `D01_pagamento_depois.png`). Saída do `npm test` na versão final: [`npm_test.png`](npm_test.png).
