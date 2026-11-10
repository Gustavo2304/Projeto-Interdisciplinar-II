// SQL da tabela produto. Sempre com parâmetros ($1, $2...) para evitar SQL injection.
const db = require('../config/db');

const CAMPOS = `p.id_produto, p.codigo, p.nome, p.id_categoria, c.nome AS categoria,
                p.preco_custo, p.preco_venda, p.quantidade_estoque, p.estoque_minimo, p.ativo,
                (p.quantidade_estoque <= p.estoque_minimo) AS estoque_baixo`;

async function listar({ busca, incluirInativos, somenteBaixo, limite = 500 }) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS}
       FROM produto p
       JOIN categoria c ON c.id_categoria = p.id_categoria
      WHERE ($1::text IS NULL OR p.nome ILIKE '%' || $1 || '%' OR p.codigo = $1)
        AND ($2::boolean OR p.ativo)
        AND (NOT $3::boolean OR p.quantidade_estoque <= p.estoque_minimo)
      ORDER BY p.nome
      LIMIT $4`, [busca || null, Boolean(incluirInativos), Boolean(somenteBaixo), limite]);
  return rows;
}

async function buscarPorId(id, cx = db) {
  const { rows } = await cx.query(
    `SELECT ${CAMPOS} FROM produto p JOIN categoria c ON c.id_categoria = p.id_categoria
      WHERE p.id_produto = $1`, [id]);
  return rows[0] || null;
}

// Trava as linhas dos produtos até o fim da transação (evita vender o mesmo saldo duas vezes).
async function travarParaVenda(ids, cx) {
  const { rows } = await cx.query(
    `SELECT id_produto, codigo, nome, preco_venda, quantidade_estoque, estoque_minimo, ativo
       FROM produto WHERE id_produto = ANY($1::int[]) FOR UPDATE`, [ids]);
  return rows;
}

async function criar(p, cx = db) {
  const { rows } = await cx.query(
    `INSERT INTO produto (codigo, nome, id_categoria, preco_custo, preco_venda,
                          quantidade_estoque, estoque_minimo, ativo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_produto`,
    [p.codigo, p.nome, p.id_categoria, p.preco_custo, p.preco_venda,
     p.quantidade_estoque, p.estoque_minimo, p.ativo]);
  return rows[0].id_produto;
}

async function atualizar(id, p, cx = db) {
  const { rowCount } = await cx.query(
    `UPDATE produto
        SET codigo = $1, nome = $2, id_categoria = $3, preco_custo = $4, preco_venda = $5,
            quantidade_estoque = $6, estoque_minimo = $7, ativo = $8
      WHERE id_produto = $9`,
    [p.codigo, p.nome, p.id_categoria, p.preco_custo, p.preco_venda,
     p.quantidade_estoque, p.estoque_minimo, p.ativo, id]);
  return rowCount > 0;
}

// Soma (ou subtrai, com valor negativo) uma quantidade ao saldo. A restrição CHECK do banco
// impede saldo negativo (RN02).
async function movimentarEstoque(id, quantidade, cx) {
  const { rowCount } = await cx.query(
    'UPDATE produto SET quantidade_estoque = quantidade_estoque + $1 WHERE id_produto = $2', [quantidade, id]);
  return rowCount > 0;
}

async function possuiVendas(id) {
  const { rows } = await db.query('SELECT EXISTS (SELECT 1 FROM item_venda WHERE id_produto = $1) AS possui', [id]);
  return rows[0].possui;
}

async function inativar(id, cx = db) {
  await cx.query('UPDATE produto SET ativo = FALSE WHERE id_produto = $1', [id]);
}

async function excluir(id) {
  await db.query('DELETE FROM produto WHERE id_produto = $1', [id]);
}

module.exports = { listar, buscarPorId, travarParaVenda, criar, atualizar, movimentarEstoque, possuiVendas, inativar, excluir };
