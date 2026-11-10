// Regras do cadastro de clientes (UC03, RF02, RN06).
const repo = require('../repositories/clienteRepository');
const { ErroApi } = require('../middlewares/erros');
const v = require('../utils/validacao');

function validar(d) {
  const doc = v.soDigitos(d.cpf_cnpj);
  const c = {
    nome: v.texto(d.nome, 'Nome', { min: 3, max: 120 }),
    cpf_cnpj: doc,
    email: v.texto(d.email, 'E-mail', { max: 120, obrigatorio: false }),
    telefone: v.soDigitos(d.telefone) || null,
  };
  if (!(doc.length === 11 ? v.cpfValido(doc) : doc.length === 14 && v.cnpjValido(doc))) {
    throw new ErroApi(400, 'CPF ou CNPJ inválido. Confira os números digitados.');
  }
  if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) throw new ErroApi(400, 'E-mail inválido.');
  if (c.telefone && !/^\d{10,11}$/.test(c.telefone)) throw new ErroApi(400, 'Telefone deve ter DDD e 8 ou 9 dígitos.');
  return c;
}

const listar = (q) => repo.listar({ busca: q.busca ? String(q.busca).trim().slice(0, 60) : null });

async function buscar(id) {
  const c = await repo.buscarPorId(v.id(id));
  if (!c) throw new ErroApi(404, 'Cliente não encontrado.');
  return c;
}

const criar = (dados) => repo.criar(validar(dados));

async function atualizar(id, dados) {
  const c = await repo.atualizar(v.id(id), validar(dados));
  if (!c) throw new ErroApi(404, 'Cliente não encontrado.');
  return c;
}

async function excluir(id) {
  const n = v.id(id);
  if (!(await repo.buscarPorId(n))) throw new ErroApi(404, 'Cliente não encontrado.');
  if (await repo.possuiVendas(n)) {
    throw new ErroApi(409, 'Este cliente tem vendas registradas e não pode ser excluído: o histórico precisa ser mantido (RNF05).');
  }
  await repo.excluir(n);
  return { mensagem: 'Cliente excluído.' };
}

module.exports = { listar, buscar, criar, atualizar, excluir };
