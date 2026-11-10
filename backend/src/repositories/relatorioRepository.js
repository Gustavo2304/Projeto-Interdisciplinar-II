// Consultas gerenciais: relatório de vendas (RF14, RF15, RF16), dashboard (indicadores da Aula 3)
// e API de integração. Todas recebem um período [inicio, fim] em datas (AAAA-MM-DD).
const db = require('../config/db');

const NO_PERIODO = `v.data_hora >= $1::date AND v.data_hora < $2::date + 1`;

// Sem período informado: últimos 30 dias até a data da venda mais recente.
async function periodoPadrao() {
  const { rows } = await db.query(
    `SELECT TO_CHAR(fim - 29, 'YYYY-MM-DD') AS inicio, TO_CHAR(fim, 'YYYY-MM-DD') AS fim
       FROM (SELECT COALESCE(MAX(data_hora)::date, CURRENT_DATE) AS fim FROM venda) x`);
  return rows[0];
}

async function totais(inicio, fim) {
  const { rows } = await db.query(
    `SELECT COUNT(*) FILTER (WHERE v.status = 'CONCLUIDA')::int                       AS qtd_vendas,
            COALESCE(SUM(v.subtotal) FILTER (WHERE v.status = 'CONCLUIDA'), 0)       AS bruto,
            COALESCE(SUM(v.desconto) FILTER (WHERE v.status = 'CONCLUIDA'), 0)       AS descontos,
            COALESCE(SUM(v.valor_total) FILTER (WHERE v.status = 'CONCLUIDA'), 0)    AS faturamento,
            COALESCE(ROUND(AVG(v.valor_total) FILTER (WHERE v.status = 'CONCLUIDA'), 2), 0) AS ticket_medio,
            COUNT(*) FILTER (WHERE v.status = 'CANCELADA')::int                      AS qtd_canceladas,
            COALESCE(SUM(v.valor_total) FILTER (WHERE v.status = 'CANCELADA'), 0)    AS valor_cancelado,
            ROUND(AVG(EXTRACT(EPOCH FROM v.data_hora - v.iniciada_em))
                  FILTER (WHERE v.status = 'CONCLUIDA' AND v.iniciada_em IS NOT NULL))::int AS tempo_medio_seg,
            (SELECT COALESCE(SUM(i.quantidade), 0)::int FROM item_venda i JOIN venda v2 ON v2.id_venda = i.id_venda
              WHERE v2.status = 'CONCLUIDA' AND v2.data_hora >= $1::date AND v2.data_hora < $2::date + 1) AS itens_vendidos
       FROM venda v
      WHERE ${NO_PERIODO}`, [inicio, fim]);
  return rows[0];
}

// Uma linha por dia do período, inclusive os dias sem venda (valor zero).
async function porDia(inicio, fim) {
  const { rows } = await db.query(
    `SELECT TO_CHAR(d, 'YYYY-MM-DD') AS dia,
            COUNT(v.id_venda)::int AS qtd_vendas,
            COALESCE(SUM(v.valor_total), 0) AS total,
            COALESCE(ROUND(AVG(v.valor_total), 2), 0) AS ticket_medio
       FROM generate_series($1::date, $2::date, INTERVAL '1 day') d
       LEFT JOIN venda v ON v.data_hora::date = d::date AND v.status = 'CONCLUIDA'
      GROUP BY d ORDER BY d`, [inicio, fim]);
  return rows;
}

async function porFormaPagamento(inicio, fim) {
  const { rows } = await db.query(
    `SELECT f.nome AS forma, COUNT(*)::int AS qtd_pagamentos, SUM(pg.valor) AS total
       FROM pagamento pg
       JOIN forma_pagamento f ON f.id_forma_pagamento = pg.id_forma_pagamento
       JOIN venda v ON v.id_venda = pg.id_venda
      WHERE v.status = 'CONCLUIDA' AND ${NO_PERIODO}
      GROUP BY f.nome ORDER BY total DESC`, [inicio, fim]);
  return rows;
}

async function maisVendidos(inicio, fim, limite = 10) {
  const { rows } = await db.query(
    `SELECT p.codigo, p.nome, SUM(i.quantidade)::int AS unidades, SUM(i.quantidade * i.preco_unitario) AS faturamento
       FROM item_venda i
       JOIN venda v ON v.id_venda = i.id_venda
       JOIN produto p ON p.id_produto = i.id_produto
      WHERE v.status = 'CONCLUIDA' AND ${NO_PERIODO}
      GROUP BY p.id_produto, p.codigo, p.nome
      ORDER BY unidades DESC, faturamento DESC
      LIMIT $3`, [inicio, fim, limite]);
  return rows;
}

// Indicadores de estoque da Aula 3: alertas gerados no período, quantos já foram resolvidos
// e tempo médio entre o alerta e a reposição.
async function indicadoresEstoque(inicio, fim) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS alertas_gerados,
            COUNT(*) FILTER (WHERE resolvido)::int AS alertas_resolvidos,
            ROUND(AVG(EXTRACT(EPOCH FROM resolvido_em - data_hora) / 3600) FILTER (WHERE resolvido), 1) AS reposicao_media_horas
       FROM alerta_estoque
      WHERE data_hora >= $1::date AND data_hora < $2::date + 1`, [inicio, fim]);
  return rows[0];
}

// Vendas concluídas com itens e pagamentos, no formato da API de integração.
async function vendasParaIntegracao(inicio, fim) {
  const { rows } = await db.query(
    `SELECT v.id_venda AS numero,
            TO_CHAR(v.data_hora, 'YYYY-MM-DD"T"HH24:MI:SS') AS data_hora,
            CASE WHEN c.id_cliente IS NULL THEN NULL
                 ELSE json_build_object('nome', c.nome, 'documento', c.cpf_cnpj) END AS cliente,
            u.login AS atendente,
            v.subtotal::float8 AS subtotal, v.desconto::float8 AS desconto, v.valor_total::float8 AS total,
            (SELECT json_agg(json_build_object('codigo', p.codigo, 'descricao', p.nome,
                     'quantidade', i.quantidade, 'preco_unitario', i.preco_unitario::float8,
                     'total', (i.quantidade * i.preco_unitario)::float8) ORDER BY i.id_item_venda)
               FROM item_venda i JOIN produto p ON p.id_produto = i.id_produto
              WHERE i.id_venda = v.id_venda) AS itens,
            (SELECT json_agg(json_build_object('forma', f.nome, 'valor', pg.valor::float8) ORDER BY pg.id_pagamento)
               FROM pagamento pg JOIN forma_pagamento f ON f.id_forma_pagamento = pg.id_forma_pagamento
              WHERE pg.id_venda = v.id_venda) AS pagamentos
       FROM venda v
       JOIN usuario u ON u.id_usuario = v.id_usuario
       LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
      WHERE v.status = 'CONCLUIDA' AND ${NO_PERIODO}
      ORDER BY v.data_hora`, [inicio, fim]);
  return rows;
}

module.exports = { periodoPadrao, totais, porDia, porFormaPagamento, maisVendidos, indicadoresEstoque, vendasParaIntegracao };
