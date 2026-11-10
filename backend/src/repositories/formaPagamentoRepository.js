const db = require('../config/db');

async function listarAtivas(cx = db) {
  const { rows } = await cx.query(
    'SELECT id_forma_pagamento, nome, permite_troco FROM forma_pagamento WHERE ativo ORDER BY id_forma_pagamento');
  return rows;
}

module.exports = { listarAtivas };
