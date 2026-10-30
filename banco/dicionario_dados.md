# Dicionário de dados — HermesPDV

Banco: PostgreSQL. Nomenclatura: minúsculo, sem acento, com underscore, no singular.

## usuario

Pessoas que acessam o sistema e seu perfil de acesso (RF03, RF04, RN04).

| Coluna | Tipo | Tamanho | Obrigatório | Chave / restrição / padrão | Descrição | Exemplo |
|---|---|---|---|---|---|---|
| id_usuario | INTEGER | 4 bytes | Sim | PK, identity | Identificador do usuário | 3 |
| nome | VARCHAR | 100 | Sim |  | Nome completo | Bianca Rocha |
| login | VARCHAR | 30 | Sim | UNIQUE | Nome de acesso ao sistema | bianca.caixa |
| senha_hash | VARCHAR | 60 | Sim |  | Hash bcrypt da senha; a senha nunca é gravada (RNF02) | $2a$10$QTz2xP… |
| perfil | VARCHAR | 13 | Sim | CHECK: ADMINISTRADOR, GERENTE ou ATENDENTE | Perfil de acesso (RN04) | ATENDENTE |
| ativo | BOOLEAN | 1 byte | Sim | padrão TRUE | Usuário desligado fica inativo, preservando suas vendas | true |
| criado_em | TIMESTAMP | 8 bytes | Sim | padrão data/hora atual | Data e hora do cadastro | 2026-09-02 08:00:00 |

## cliente

Clientes identificados na venda; identificação é opcional (RF02, RN06).

| Coluna | Tipo | Tamanho | Obrigatório | Chave / restrição / padrão | Descrição | Exemplo |
|---|---|---|---|---|---|---|
| id_cliente | INTEGER | 4 bytes | Sim | PK, identity | Identificador do cliente | 1 |
| nome | VARCHAR | 120 | Sim |  | Nome da pessoa ou razão social | Ana Beatriz Souza |
| cpf_cnpj | VARCHAR | 14 | Sim | UNIQUE; CHECK: 11 ou 14 dígitos | CPF ou CNPJ só com números (RN06) | 88139986941 |
| email | VARCHAR | 120 | Não |  | E-mail de contato | ana.souza@example.com |
| telefone | VARCHAR | 15 | Não |  | Telefone com DDD, só números | 11929516234 |
| criado_em | TIMESTAMP | 8 bytes | Sim | padrão data/hora atual | Data e hora do cadastro | 2026-09-06 10:00:00 |

## categoria

Agrupamento dos produtos (RF01).

| Coluna | Tipo | Tamanho | Obrigatório | Chave / restrição / padrão | Descrição | Exemplo |
|---|---|---|---|---|---|---|
| id_categoria | INTEGER | 4 bytes | Sim | PK, identity | Identificador da categoria | 1 |
| nome | VARCHAR | 60 | Sim | UNIQUE | Nome da categoria | Mercearia |
| descricao | VARCHAR | 200 | Não |  | Descrição do que a categoria abrange | Grãos, massas, óleos e enlatados |

## produto

Itens vendidos e saldo atual em estoque (RF01, RF09, RF17, RN05, RN07).

| Coluna | Tipo | Tamanho | Obrigatório | Chave / restrição / padrão | Descrição | Exemplo |
|---|---|---|---|---|---|---|
| id_produto | INTEGER | 4 bytes | Sim | PK, identity | Identificador do produto | 3 |
| codigo | VARCHAR | 20 | Sim | UNIQUE | Código de barras ou SKU | 7891000300305 |
| nome | VARCHAR | 120 | Sim | índice em LOWER(nome) | Nome exibido na venda e no comprovante | Café torrado e moído 500g |
| id_categoria | INTEGER | 4 bytes | Sim | FK → categoria | Categoria do produto | 1 |
| preco_custo | NUMERIC | 10,2 | Sim | padrão 0; CHECK ≥ 0 | Preço de compra do produto, em reais | 12.40 |
| preco_venda | NUMERIC | 10,2 | Sim | CHECK > 0 | Preço de venda atual, em reais | 18.90 |
| quantidade_estoque | INTEGER | 4 bytes | Sim | padrão 0; CHECK ≥ 0 (RN02) | Saldo atual em estoque | 67 |
| estoque_minimo | INTEGER | 4 bytes | Sim | padrão 0; CHECK ≥ 0 | Saldo que dispara o alerta de estoque baixo (RN07) | 10 |
| ativo | BOOLEAN | 1 byte | Sim | padrão TRUE | Produto com vendas é inativado, não excluído (RN05) | true |
| criado_em | TIMESTAMP | 8 bytes | Sim | padrão data/hora atual | Data e hora do cadastro | 2026-09-25 08:00:00 |

## forma_pagamento

Formas de pagamento aceitas pela loja (RF07).

| Coluna | Tipo | Tamanho | Obrigatório | Chave / restrição / padrão | Descrição | Exemplo |
|---|---|---|---|---|---|---|
| id_forma_pagamento | SMALLINT | 2 bytes | Sim | PK, identity | Identificador da forma de pagamento | 4 |
| nome | VARCHAR | 30 | Sim | UNIQUE | Nome exibido na tela de pagamento | PIX |
| permite_troco | BOOLEAN | 1 byte | Sim | padrão FALSE | Indica se aceita valor recebido maior e calcula troco | false |
| ativo | BOOLEAN | 1 byte | Sim | padrão TRUE | Forma inativa não aparece na tela de pagamento | true |

## venda

Cabeçalho da venda; venda cancelada permanece no histórico (RF05, RF06, RF11, RF12, RN01, RN03, RNF05).

| Coluna | Tipo | Tamanho | Obrigatório | Chave / restrição / padrão | Descrição | Exemplo |
|---|---|---|---|---|---|---|
| id_venda | INTEGER | 4 bytes | Sim | PK, identity | Número da venda | 58 |
| data_hora | TIMESTAMP | 8 bytes | Sim | padrão data/hora atual; índice | Momento em que a venda foi finalizada | 2026-10-20 09:56:29 |
| id_usuario | INTEGER | 4 bytes | Sim | FK → usuario | Atendente que registrou a venda | 3 |
| id_cliente | INTEGER | 4 bytes | Não | FK → cliente | Cliente identificado (opcional) | 12 |
| subtotal | NUMERIC | 10,2 | Sim | CHECK ≥ 0 | Soma de quantidade × preço dos itens | 118.75 |
| desconto | NUMERIC | 10,2 | Sim | padrão 0; CHECK 0 ≤ desconto ≤ subtotal | Desconto concedido, em reais | 2.00 |
| valor_total | NUMERIC | 10,2 | Sim | CHECK = subtotal − desconto | Valor a pagar | 116.75 |
| status | VARCHAR | 9 | Sim | padrão CONCLUIDA; CHECK: CONCLUIDA ou CANCELADA | Situação da venda | CONCLUIDA |
| cancelada_em | TIMESTAMP | 8 bytes | Não | obrigatório se CANCELADA | Momento do cancelamento | 2026-10-18 10:21:01 |
| id_usuario_cancelamento | INTEGER | 4 bytes | Não | FK → usuario; obrigatório se CANCELADA | Quem cancelou a venda | 3 |
| motivo_cancelamento | VARCHAR | 200 | Não | obrigatório se CANCELADA | Motivo informado no cancelamento | Cliente desistiu da compra… |

## item_venda

Produtos de cada venda; entidade associativa entre venda e produto (RF05, RF06).

| Coluna | Tipo | Tamanho | Obrigatório | Chave / restrição / padrão | Descrição | Exemplo |
|---|---|---|---|---|---|---|
| id_item_venda | INTEGER | 4 bytes | Sim | PK, identity | Identificador do item | 158 |
| id_venda | INTEGER | 4 bytes | Sim | FK → venda (ON DELETE CASCADE); UNIQUE com id_produto | Venda a que o item pertence | 58 |
| id_produto | INTEGER | 4 bytes | Sim | FK → produto (ON DELETE RESTRICT) | Produto vendido | 3 |
| quantidade | INTEGER | 4 bytes | Sim | CHECK > 0 | Quantidade vendida | 2 |
| preco_unitario | NUMERIC | 10,2 | Sim | CHECK ≥ 0 | Preço praticado no momento da venda | 18.90 |

## pagamento

Pagamentos de cada venda; entidade associativa entre venda e forma_pagamento (RF07, RF08, RN01).

| Coluna | Tipo | Tamanho | Obrigatório | Chave / restrição / padrão | Descrição | Exemplo |
|---|---|---|---|---|---|---|
| id_pagamento | INTEGER | 4 bytes | Sim | PK, identity | Identificador do pagamento | 66 |
| id_venda | INTEGER | 4 bytes | Sim | FK → venda (ON DELETE CASCADE) | Venda paga | 58 |
| id_forma_pagamento | SMALLINT | 2 bytes | Sim | FK → forma_pagamento | Forma usada | 1 |
| valor | NUMERIC | 10,2 | Sim | CHECK > 0 | Valor aplicado à venda | 116.75 |
| valor_recebido | NUMERIC | 10,2 | Não | CHECK ≥ valor | Só em dinheiro: valor entregue; troco = valor_recebido − valor | 150.00 |

## alerta_estoque

Alertas de estoque baixo; no máximo um em aberto por produto (RF10, RN07).

| Coluna | Tipo | Tamanho | Obrigatório | Chave / restrição / padrão | Descrição | Exemplo |
|---|---|---|---|---|---|---|
| id_alerta_estoque | INTEGER | 4 bytes | Sim | PK, identity | Identificador do alerta | 2 |
| id_produto | INTEGER | 4 bytes | Sim | FK → produto; UNIQUE parcial onde resolvido = FALSE | Produto que chegou ao mínimo | 2 |
| data_hora | TIMESTAMP | 8 bytes | Sim | padrão data/hora atual | Momento em que o alerta foi gerado | 2026-10-21 08:35:47 |
| quantidade_no_momento | INTEGER | 4 bytes | Sim | CHECK ≥ 0 | Saldo do produto quando o alerta foi gerado | 12 |
| resolvido | BOOLEAN | 1 byte | Sim | padrão FALSE | Indica se o estoque já foi reposto | false |
| resolvido_em | TIMESTAMP | 8 bytes | Não | CHECK: preenchido se, e só se, resolvido | Momento da reposição | 2026-10-10 09:15:00 |
