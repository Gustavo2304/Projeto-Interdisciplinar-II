// Erros conhecidos viram respostas HTTP com mensagem em português.
// O usuário nunca vê a mensagem técnica do banco; ela fica só no log do servidor.
class ErroApi extends Error {
  constructor(status, mensagem, extra) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

const UNICOS = {
  uq_produto_codigo: 'Já existe um produto com este código.',
  uq_cliente_cpf_cnpj: 'Já existe um cliente com este CPF/CNPJ (RN06).',
  uq_usuario_login: 'Este login já está em uso.',
  uq_categoria_nome: 'Já existe uma categoria com este nome.',
};
const CHECKS = {
  ck_produto_quantidade: 'Estoque insuficiente para concluir a operação (RN02).',
  ck_venda_total: 'Total da venda inconsistente.',
  ck_venda_valores: 'Desconto inválido: deve ficar entre zero e o subtotal.',
};

function tratarErros(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ErroApi) return res.status(err.status).json({ erro: err.message, ...(err.extra || {}) });
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ erro: 'Dados enviados em formato inválido.' });
  }
  if (err.code === '23505') return res.status(409).json({ erro: UNICOS[err.constraint] || 'Registro duplicado.' });
  if (err.code === '23514') return res.status(400).json({ erro: CHECKS[err.constraint] || 'Valor fora das regras do banco de dados.' });
  if (err.code === '23503') return res.status(409).json({ erro: 'Operação não permitida: o registro está ligado a outros dados.' });
  if (err.code === '22P02' || err.code === '22003') return res.status(400).json({ erro: 'Valor em formato inválido.' });
  if (err.code === 'ECONNREFUSED' || err.code === '3D000' || err.code === '28P01') {
    console.error('[banco]', err.message);
    return res.status(503).json({ erro: 'Banco de dados indisponível. Tente novamente em instantes.' });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno no servidor. Tente novamente.' });
}

// repassa erros de funções assíncronas para o middleware de erros (Express 4)
const tratar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ErroApi, tratarErros, tratar };
