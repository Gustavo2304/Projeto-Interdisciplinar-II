// SQL da tabela cliente.
const db = require('../config/db');

const CAMPOS = `c.id_cliente, c.nome, c.cpf_cnpj, c.email, c.telefone,
                TO_CHAR(c.criado_em, 'YYYY-MM-DD HH24:MI') AS criado_em`;

async function listar({ busca }) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS},
            (SELECT COUNT(*) FROM venda v WHERE v.id_cliente = c.id_cliente AND v.status = 'CONCLUIDA')::int AS qtd_compras
       FROM cliente c
      WHERE ($1::text IS NULL OR c.nome ILIKE '%' || $1 || '%' OR c.cpf_cnpj LIKE $2 || '%')
      ORDER BY c.nome
      LIMIT 200`, [busca || null, (busca || '').replace(/\D/g, '') || '#']);
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM cliente c WHERE c.id_cliente = $1`, [id]);
  return rows[0] || null;
}

async function criar(c) {
  const { rows } = await db.query(
    `INSERT INTO cliente (nome, cpf_cnpj, email, telefone) VALUES ($1, $2, $3, $4) RETURNING id_cliente`,
    [c.nome, c.cpf_cnpj, c.email, c.telefone]);
  return buscarPorId(rows[0].id_cliente);
}

async function atualizar(id, c) {
  const { rowCount } = await db.query(
    'UPDATE cliente SET nome = $1, cpf_cnpj = $2, email = $3, telefone = $4 WHERE id_cliente = $5',
    [c.nome, c.cpf_cnpj, c.email, c.telefone, id]);
  return rowCount ? buscarPorId(id) : null;
}

async function possuiVendas(id) {
  const { rows } = await db.query('SELECT EXISTS (SELECT 1 FROM venda WHERE id_cliente = $1) AS possui', [id]);
  return rows[0].possui;
}

async function excluir(id) {
  await db.query('DELETE FROM cliente WHERE id_cliente = $1', [id]);
}

module.exports = { listar, buscarPorId, criar, atualizar, possuiVendas, excluir };
