const db = require('../config/db');

async function listar() {
  const { rows } = await db.query('SELECT id_categoria, nome FROM categoria ORDER BY nome');
  return rows;
}

module.exports = { listar };
