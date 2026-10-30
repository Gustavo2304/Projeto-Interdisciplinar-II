// Erros conhecidos viram respostas HTTP com mensagem em português.
class ErroApi extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// códigos de erro do PostgreSQL: https://www.postgresql.org/docs/current/errcodes-appendix.html
const ERROS_PG = {
  '23505': [409, 'Já existe um registro com este valor (campo único).'],
  '23503': [409, 'Operação viola a integridade referencial.'],
  '23514': [400, 'Valor fora das regras do banco de dados.'],
  '22P02': [400, 'Valor em formato inválido.'],
};

function tratarErros(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ErroApi) return res.status(err.status).json({ erro: err.message });
  if (err.code === '23505' && err.constraint === 'uq_produto_codigo') {
    return res.status(409).json({ erro: 'Já existe um produto com este código.' });
  }
  if (ERROS_PG[err.code]) {
    const [status, msg] = ERROS_PG[err.code];
    return res.status(status).json({ erro: msg });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno no servidor.' });
}

module.exports = { ErroApi, tratarErros };
