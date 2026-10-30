// Repository: único lugar que escreve SQL da tabela produto.
// Sempre com parâmetros ($1, $2...) para evitar SQL injection.
const db = require('../config/db');

const CAMPOS = `p.id_produto, p.codigo, p.nome, p.id_categoria, c.nome AS categoria,
                p.preco_custo, p.preco_venda, p.quantidade_estoque, p.estoque_minimo, p.ativo`;

async function listar({ busca, incluirInativos }) {
  const sql = `
    SELECT ${CAMPOS}
      FROM produto p
      JOIN categoria c ON c.id_categoria = p.id_categoria
     WHERE ($1::text IS NULL OR p.nome ILIKE '%' || $1 || '%' OR p.codigo = $1)
       AND ($2::boolean OR p.ativo)
     ORDER BY p.nome`;
  const { rows } = await db.query(sql, [busca || null, Boolean(incluirInativos)]);
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM produto p JOIN categoria c ON c.id_categoria = p.id_categoria
      WHERE p.id_produto = $1`, [id]);
  return rows[0] || null;
}

async function criar(p) {
  const { rows } = await db.query(
    `INSERT INTO produto (codigo, nome, id_categoria, preco_custo, preco_venda,
                          quantidade_estoque, estoque_minimo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id_produto`,
    [p.codigo, p.nome, p.id_categoria, p.preco_custo, p.preco_venda,
     p.quantidade_estoque, p.estoque_minimo]);
  return buscarPorId(rows[0].id_produto);
}

async function atualizar(id, p) {
  const { rowCount } = await db.query(
    `UPDATE produto
        SET codigo = $1, nome = $2, id_categoria = $3, preco_custo = $4, preco_venda = $5,
            quantidade_estoque = $6, estoque_minimo = $7, ativo = $8
      WHERE id_produto = $9`,
    [p.codigo, p.nome, p.id_categoria, p.preco_custo, p.preco_venda,
     p.quantidade_estoque, p.estoque_minimo, p.ativo, id]);
  return rowCount ? buscarPorId(id) : null;
}

async function possuiVendas(id) {
  const { rows } = await db.query(
    'SELECT EXISTS (SELECT 1 FROM item_venda WHERE id_produto = $1) AS possui', [id]);
  return rows[0].possui;
}

async function inativar(id) {
  const { rowCount } = await db.query('UPDATE produto SET ativo = FALSE WHERE id_produto = $1', [id]);
  return rowCount > 0;
}

async function excluir(id) {
  const { rowCount } = await db.query('DELETE FROM produto WHERE id_produto = $1', [id]);
  return rowCount > 0;
}

module.exports = { listar, buscarPorId, criar, atualizar, possuiVendas, inativar, excluir };
