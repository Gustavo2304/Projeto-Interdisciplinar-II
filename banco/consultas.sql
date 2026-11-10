-- =============================================================================
-- HermesPDV — consultas.sql
-- Consultas que atendem aos relatórios e telas previstos nos requisitos.
-- Executar conectado ao banco hermespdv, depois da carga de teste:
--   psql -U postgres -d hermespdv -f consultas.sql
-- Datas e ids fixos (outubro/2026, venda 58) servem para os dados de teste;
-- na aplicação, eles chegam como parâmetros ($1, $2...).
-- =============================================================================

SET client_encoding = 'UTF8';

-- -----------------------------------------------------------------------------
-- Consulta 1 — Vendas por dia no período (RF14: relatório de vendas por período)
-- Técnica: agregação (COUNT, SUM, AVG) com GROUP BY.
-- Vendas canceladas não entram no faturamento.
-- -----------------------------------------------------------------------------
SELECT CAST(v.data_hora AS DATE)       AS dia,
       COUNT(*)                        AS qtd_vendas,
       SUM(v.valor_total)              AS total_vendido,
       ROUND(AVG(v.valor_total), 2)    AS ticket_medio
FROM venda v
WHERE v.status = 'CONCLUIDA'
  AND v.data_hora >= '2026-10-01' AND v.data_hora < '2026-11-01'
GROUP BY CAST(v.data_hora AS DATE)
ORDER BY dia;

-- -----------------------------------------------------------------------------
-- Consulta 2 — Os 10 produtos mais vendidos no período (RF15)
-- Técnica: JOIN de três tabelas + SUM com GROUP BY.
-- -----------------------------------------------------------------------------
SELECT p.codigo,
       p.nome                                   AS produto,
       SUM(i.quantidade)                        AS unidades_vendidas,
       SUM(i.quantidade * i.preco_unitario)     AS faturamento
FROM item_venda i
JOIN venda v   ON v.id_venda = i.id_venda
JOIN produto p ON p.id_produto = i.id_produto
WHERE v.status = 'CONCLUIDA'
  AND v.data_hora >= '2026-10-01' AND v.data_hora < '2026-11-01'
GROUP BY p.id_produto, p.codigo, p.nome
ORDER BY unidades_vendidas DESC, faturamento DESC
LIMIT 10;

-- -----------------------------------------------------------------------------
-- Consulta 3 — Total recebido por forma de pagamento (RF16)
-- Técnica: JOIN + COUNT e SUM com GROUP BY; percentual com função de janela.
-- -----------------------------------------------------------------------------
SELECT f.nome                                   AS forma_pagamento,
       COUNT(*)                                 AS qtd_pagamentos,
       SUM(pg.valor)                            AS total_recebido,
       ROUND(100 * SUM(pg.valor) / SUM(SUM(pg.valor)) OVER (), 1) AS percentual
FROM pagamento pg
JOIN forma_pagamento f ON f.id_forma_pagamento = pg.id_forma_pagamento
JOIN venda v           ON v.id_venda = pg.id_venda
WHERE v.status = 'CONCLUIDA'
  AND v.data_hora >= '2026-10-01' AND v.data_hora < '2026-11-01'
GROUP BY f.nome
ORDER BY total_recebido DESC;

-- -----------------------------------------------------------------------------
-- Consulta 4 — Produtos com estoque baixo e alerta em aberto (RF10, RN07)
-- Técnica: JOIN com categoria e LEFT JOIN com alerta_estoque.
-- -----------------------------------------------------------------------------
SELECT p.codigo,
       p.nome               AS produto,
       c.nome               AS categoria,
       p.quantidade_estoque AS saldo,
       p.estoque_minimo     AS minimo,
       a.data_hora          AS alerta_desde
FROM produto p
JOIN categoria c           ON c.id_categoria = p.id_categoria
LEFT JOIN alerta_estoque a ON a.id_produto = p.id_produto AND a.resolvido = FALSE
WHERE p.ativo = TRUE
  AND p.quantidade_estoque <= p.estoque_minimo
ORDER BY (p.quantidade_estoque - p.estoque_minimo), p.nome;

-- -----------------------------------------------------------------------------
-- Consulta 5 — Consulta de vendas com atendente e cliente (RF11, tela 8)
-- Técnica: JOIN com usuario e LEFT JOIN com cliente (o cliente é opcional).
-- -----------------------------------------------------------------------------
SELECT v.id_venda,
       TO_CHAR(v.data_hora, 'DD/MM/YYYY HH24:MI') AS data_hora,
       u.nome                                     AS atendente,
       COALESCE(c.nome, '(não identificado)')     AS cliente,
       v.valor_total,
       v.status
FROM venda v
JOIN usuario u      ON u.id_usuario = v.id_usuario
LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
WHERE v.data_hora >= '2026-10-20' AND v.data_hora < '2026-10-23'
ORDER BY v.data_hora;

-- -----------------------------------------------------------------------------
-- Consulta 6 — Itens do comprovante de uma venda (RF13, tela 7)
-- Técnica: JOIN; o subtotal do item é calculado, não armazenado.
-- -----------------------------------------------------------------------------
SELECT p.codigo,
       p.nome                          AS produto,
       i.quantidade,
       i.preco_unitario,
       i.quantidade * i.preco_unitario AS subtotal_item
FROM item_venda i
JOIN produto p ON p.id_produto = i.id_produto
WHERE i.id_venda = 58
ORDER BY i.id_item_venda;

-- -----------------------------------------------------------------------------
-- Consulta 7 — Desempenho por atendente (relatório gerencial)
-- Técnica: JOIN + COUNT, SUM e AVG com GROUP BY e HAVING.
-- -----------------------------------------------------------------------------
SELECT u.nome                                   AS atendente,
       COUNT(*)                                 AS qtd_vendas,
       SUM(v.valor_total)                       AS total_vendido,
       ROUND(AVG(v.valor_total), 2)             AS ticket_medio,
       SUM(v.desconto)                          AS descontos_concedidos
FROM venda v
JOIN usuario u ON u.id_usuario = v.id_usuario
WHERE v.status = 'CONCLUIDA'
GROUP BY u.id_usuario, u.nome
HAVING COUNT(*) >= 1
ORDER BY total_vendido DESC;

-- -----------------------------------------------------------------------------
-- Consulta 8 — As 10 maiores vendas acima do ticket médio (análise gerencial)
-- Técnica: subconsulta escalar no WHERE.
-- -----------------------------------------------------------------------------
SELECT v.id_venda,
       TO_CHAR(v.data_hora, 'DD/MM/YYYY') AS dia,
       v.valor_total,
       (SELECT ROUND(AVG(valor_total), 2)
          FROM venda
         WHERE status = 'CONCLUIDA') AS ticket_medio
FROM venda v
WHERE v.status = 'CONCLUIDA'
  AND v.valor_total > (SELECT AVG(valor_total)
                         FROM venda
                        WHERE status = 'CONCLUIDA')
ORDER BY v.valor_total DESC
LIMIT 10;

-- -----------------------------------------------------------------------------
-- Consulta 9 — Produtos ativos que nunca foram vendidos (revisão de mix)
-- Técnica: subconsulta correlacionada com NOT EXISTS.
-- -----------------------------------------------------------------------------
SELECT p.codigo,
       p.nome AS produto,
       p.quantidade_estoque AS saldo
FROM produto p
WHERE p.ativo = TRUE
  AND NOT EXISTS (SELECT 1
                    FROM item_venda i
                    JOIN venda v ON v.id_venda = i.id_venda
                   WHERE i.id_produto = p.id_produto
                     AND v.status = 'CONCLUIDA')
ORDER BY p.nome;

-- -----------------------------------------------------------------------------
-- Consulta 10 — Faturamento e margem bruta por categoria (relatório gerencial)
-- Técnica: JOIN de quatro tabelas + SUM com GROUP BY.
-- A margem usa o preço de custo atual do produto (aproximação).
-- -----------------------------------------------------------------------------
SELECT c.nome                                                   AS categoria,
       SUM(i.quantidade)                                        AS unidades,
       SUM(i.quantidade * i.preco_unitario)                     AS faturamento,
       SUM(i.quantidade * (i.preco_unitario - p.preco_custo))   AS margem_bruta
FROM item_venda i
JOIN venda v     ON v.id_venda = i.id_venda
JOIN produto p   ON p.id_produto = i.id_produto
JOIN categoria c ON c.id_categoria = p.id_categoria
WHERE v.status = 'CONCLUIDA'
GROUP BY c.nome
ORDER BY faturamento DESC;

-- -----------------------------------------------------------------------------
-- Consulta 11 — Auditoria de vendas canceladas (RF12, RN03, RNF05)
-- Técnica: JOIN com a tabela usuario duas vezes (quem vendeu e quem cancelou).
-- -----------------------------------------------------------------------------
SELECT v.id_venda,
       TO_CHAR(v.data_hora, 'DD/MM/YYYY HH24:MI')    AS vendida_em,
       uv.nome                                        AS vendida_por,
       TO_CHAR(v.cancelada_em, 'DD/MM/YYYY HH24:MI') AS cancelada_em,
       uc.nome                                        AS cancelada_por,
       v.valor_total,
       v.motivo_cancelamento
FROM venda v
JOIN usuario uv ON uv.id_usuario = v.id_usuario
JOIN usuario uc ON uc.id_usuario = v.id_usuario_cancelamento
WHERE v.status = 'CANCELADA'
ORDER BY v.cancelada_em;

-- -----------------------------------------------------------------------------
-- Consulta 12 — Verificação da regra RN01 (soma dos pagamentos = total da venda)
-- Técnica: subconsulta no FROM + GROUP BY/HAVING. Resultado esperado: nenhuma linha.
-- -----------------------------------------------------------------------------
SELECT v.id_venda, v.valor_total, pg.total_pago
FROM venda v
JOIN (SELECT id_venda, SUM(valor) AS total_pago
        FROM pagamento
       GROUP BY id_venda) pg ON pg.id_venda = v.id_venda
WHERE pg.total_pago <> v.valor_total;
