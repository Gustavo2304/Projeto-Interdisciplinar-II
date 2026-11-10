// SQL das vendas, itens e pagamentos.
const db = require('../config/db');

// Consulta de vendas com filtros (RF11): período, status, número, cliente e produto.
async function listar(f) {
  const cond = [];
  const params = [];
  const p = (v) => { params.push(v); return `$${params.length}`; };
  if (f.inicio) cond.push(`v.data_hora >= ${p(f.inicio)}::date`);
  if (f.fim) cond.push(`v.data_hora < ${p(f.fim)}::date + 1`);
  if (f.status) cond.push(`v.status = ${p(f.status)}`);
  if (f.numero) cond.push(`v.id_venda = ${p(f.numero)}`);
  if (f.cliente) {
    const d = f.cliente.replace(/\D/g, '');
    cond.push(`(c.nome ILIKE '%' || ${p(f.cliente)} || '%'${d ? ` OR c.cpf_cnpj LIKE ${p(d)} || '%'` : ''})`);
  }
  if (f.produto) {
    cond.push(`EXISTS (SELECT 1 FROM item_venda i JOIN produto pr ON pr.id_produto = i.id_produto
                        WHERE i.id_venda = v.id_venda
                          AND (pr.nome ILIKE '%' || ${p(f.produto)} || '%' OR pr.codigo = ${p(f.produto)}))`);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const sql = `
    SELECT v.id_venda, TO_CHAR(v.data_hora, 'YYYY-MM-DD HH24:MI') AS data_hora,
           u.nome AS atendente, c.nome AS cliente, v.valor_total, v.status,
           (SELECT COUNT(*) FROM item_venda i WHERE i.id_venda = v.id_venda)::int AS qtd_itens
      FROM venda v
      JOIN usuario u      ON u.id_usuario = v.id_usuario
      LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
      ${where}
     ORDER BY v.data_hora DESC
     LIMIT ${p(f.limite || 200)}`;
  const { rows } = await db.query(sql, params);
  return rows;
}

async function buscarCompleta(id, cx = db) {
  const { rows } = await cx.query(
    `SELECT v.id_venda, TO_CHAR(v.data_hora, 'YYYY-MM-DD HH24:MI:SS') AS data_hora,
            v.subtotal, v.desconto, v.valor_total, v.status,
            TO_CHAR(v.cancelada_em, 'YYYY-MM-DD HH24:MI') AS cancelada_em, v.motivo_cancelamento,
            u.nome AS atendente, uc.nome AS cancelada_por,
            c.id_cliente, c.nome AS cliente, c.cpf_cnpj AS cliente_documento
       FROM venda v
       JOIN usuario u       ON u.id_usuario = v.id_usuario
       LEFT JOIN usuario uc ON uc.id_usuario = v.id_usuario_cancelamento
       LEFT JOIN cliente c  ON c.id_cliente = v.id_cliente
      WHERE v.id_venda = $1`, [id]);
  if (!rows[0]) return null;
  const venda = rows[0];
  const itens = await cx.query(
    `SELECT i.id_produto, p.codigo, p.nome, i.quantidade, i.preco_unitario,
            (i.quantidade * i.preco_unitario) AS subtotal
       FROM item_venda i JOIN produto p ON p.id_produto = i.id_produto
      WHERE i.id_venda = $1 ORDER BY i.id_item_venda`, [id]);
  const pags = await cx.query(
    `SELECT f.nome AS forma, pg.valor, pg.valor_recebido,
            (pg.valor_recebido - pg.valor) AS troco
       FROM pagamento pg JOIN forma_pagamento f ON f.id_forma_pagamento = pg.id_forma_pagamento
      WHERE pg.id_venda = $1 ORDER BY pg.id_pagamento`, [id]);
  venda.itens = itens.rows;
  venda.pagamentos = pags.rows;
  return venda;
}

async function inserirVenda(v, cx) {
  const { rows } = await cx.query(
    `INSERT INTO venda (iniciada_em, id_usuario, id_cliente, subtotal, desconto, valor_total)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_venda`,
    [v.iniciada_em, v.id_usuario, v.id_cliente, v.subtotal, v.desconto, v.valor_total]);
  return rows[0].id_venda;
}

async function inserirItem(idVenda, it, cx) {
  await cx.query(
    'INSERT INTO item_venda (id_venda, id_produto, quantidade, preco_unitario) VALUES ($1, $2, $3, $4)',
    [idVenda, it.id_produto, it.quantidade, it.preco_unitario]);
}

async function inserirPagamento(idVenda, pg, cx) {
  await cx.query(
    'INSERT INTO pagamento (id_venda, id_forma_pagamento, valor, valor_recebido) VALUES ($1, $2, $3, $4)',
    [idVenda, pg.id_forma_pagamento, pg.valor, pg.valor_recebido]);
}

async function travar(id, cx) {
  const { rows } = await cx.query('SELECT id_venda, status FROM venda WHERE id_venda = $1 FOR UPDATE', [id]);
  return rows[0] || null;
}

async function itensDaVenda(id, cx) {
  const { rows } = await cx.query('SELECT id_produto, quantidade FROM item_venda WHERE id_venda = $1', [id]);
  return rows;
}

async function marcarCancelada(id, idUsuario, motivo, cx) {
  await cx.query(
    `UPDATE venda SET status = 'CANCELADA', cancelada_em = CURRENT_TIMESTAMP,
            id_usuario_cancelamento = $1, motivo_cancelamento = $2
      WHERE id_venda = $3`, [idUsuario, motivo, id]);
}

module.exports = { listar, buscarCompleta, inserirVenda, inserirItem, inserirPagamento, travar, itensDaVenda, marcarCancelada };
