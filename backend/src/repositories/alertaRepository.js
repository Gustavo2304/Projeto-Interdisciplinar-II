// Alertas de estoque baixo (RF10, RN07).
const db = require('../config/db');

// Gera alerta para os produtos que chegaram ao mínimo e ainda não têm alerta em aberto.
async function gerarSeNecessario(ids, cx = db) {
  const { rows } = await cx.query(
    `INSERT INTO alerta_estoque (id_produto, quantidade_no_momento)
     SELECT p.id_produto, p.quantidade_estoque
       FROM produto p
      WHERE p.id_produto = ANY($1::int[])
        AND p.ativo
        AND p.quantidade_estoque <= p.estoque_minimo
        AND NOT EXISTS (SELECT 1 FROM alerta_estoque a WHERE a.id_produto = p.id_produto AND NOT a.resolvido)
     RETURNING id_produto`, [ids]);
  return rows.map((r) => r.id_produto);
}

// Encerra os alertas dos produtos que voltaram acima do mínimo (ou foram inativados).
async function resolverSeNecessario(ids, cx = db) {
  const { rows } = await cx.query(
    `UPDATE alerta_estoque a
        SET resolvido = TRUE, resolvido_em = CURRENT_TIMESTAMP
       FROM produto p
      WHERE a.id_produto = p.id_produto
        AND p.id_produto = ANY($1::int[])
        AND NOT a.resolvido
        AND (p.quantidade_estoque > p.estoque_minimo OR NOT p.ativo)
     RETURNING a.id_produto`, [ids]);
  return rows.map((r) => r.id_produto);
}

async function listarAbertos() {
  const { rows } = await db.query(
    `SELECT a.id_alerta_estoque, p.id_produto, p.codigo, p.nome, p.quantidade_estoque, p.estoque_minimo,
            TO_CHAR(a.data_hora, 'YYYY-MM-DD HH24:MI') AS desde
       FROM alerta_estoque a
       JOIN produto p ON p.id_produto = a.id_produto
      WHERE NOT a.resolvido
      ORDER BY (p.quantidade_estoque - p.estoque_minimo), p.nome`);
  return rows;
}

module.exports = { gerarSeNecessario, resolverSeNecessario, listarAbertos };
