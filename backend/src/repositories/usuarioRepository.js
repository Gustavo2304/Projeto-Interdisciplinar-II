// SQL da tabela usuario. Hash e conferência de senha feitos pelo PostgreSQL (pgcrypto, bcrypt) — RNF02.
const db = require('../config/db');

const CAMPOS = `id_usuario, nome, login, perfil, ativo, TO_CHAR(criado_em, 'YYYY-MM-DD HH24:MI') AS criado_em`;

async function autenticar(login, senha) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM usuario WHERE login = $1 AND senha_hash = crypt($2, senha_hash)`, [login, senha]);
  return rows[0] || null;
}

async function buscarPorId(id) {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM usuario WHERE id_usuario = $1`, [id]);
  return rows[0] || null;
}

async function listar({ busca }) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS},
            (SELECT COUNT(*) FROM venda v WHERE v.id_usuario = u.id_usuario)::int AS qtd_vendas
       FROM usuario u
      WHERE ($1::text IS NULL OR u.nome ILIKE '%' || $1 || '%' OR u.login ILIKE '%' || $1 || '%')
      ORDER BY u.ativo DESC, u.nome`, [busca || null]);
  return rows;
}

async function criar(u) {
  const { rows } = await db.query(
    `INSERT INTO usuario (nome, login, senha_hash, perfil, ativo)
     VALUES ($1, $2, crypt($3, gen_salt('bf', 10)), $4, $5) RETURNING id_usuario`,
    [u.nome, u.login, u.senha, u.perfil, u.ativo]);
  return buscarPorId(rows[0].id_usuario);
}

async function atualizar(id, u) {
  const { rowCount } = await db.query(
    `UPDATE usuario SET nome = $1, login = $2, perfil = $3, ativo = $4,
            senha_hash = CASE WHEN $5::text IS NULL THEN senha_hash ELSE crypt($5, gen_salt('bf', 10)) END
      WHERE id_usuario = $6`,
    [u.nome, u.login, u.perfil, u.ativo, u.senha || null, id]);
  return rowCount ? buscarPorId(id) : null;
}

async function possuiVendas(id) {
  const { rows } = await db.query(
    'SELECT EXISTS (SELECT 1 FROM venda WHERE id_usuario = $1 OR id_usuario_cancelamento = $1) AS possui', [id]);
  return rows[0].possui;
}

async function inativar(id) {
  await db.query('UPDATE usuario SET ativo = FALSE WHERE id_usuario = $1', [id]);
}

async function excluir(id) {
  await db.query('DELETE FROM usuario WHERE id_usuario = $1', [id]);
}

module.exports = { autenticar, buscarPorId, listar, criar, atualizar, possuiVendas, inativar, excluir };
