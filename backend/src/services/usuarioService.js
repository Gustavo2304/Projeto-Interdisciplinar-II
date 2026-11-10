// Regras do cadastro de usuários (UC04, RF03, RN04, RNF02).
const repo = require('../repositories/usuarioRepository');
const { ErroApi } = require('../middlewares/erros');
const v = require('../utils/validacao');

const PERFIS = ['ADMINISTRADOR', 'GERENTE', 'ATENDENTE'];

function validarSenha(senha) {
  if (String(senha).length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    throw new ErroApi(400, 'A senha deve ter ao menos 8 caracteres, com letras e números.');
  }
}

function validar(d, novo) {
  const u = {
    nome: v.texto(d.nome, 'Nome', { min: 3, max: 100 }),
    login: String(d.login || '').trim().toLowerCase(),
    perfil: d.perfil,
    ativo: d.ativo === undefined ? true : Boolean(d.ativo),
    senha: d.senha ? String(d.senha) : null,
  };
  if (!/^[a-z0-9._-]{3,30}$/.test(u.login)) {
    throw new ErroApi(400, 'Login deve ter de 3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou underline.');
  }
  if (!PERFIS.includes(u.perfil)) throw new ErroApi(400, 'Selecione um perfil válido.');
  if (novo && !u.senha) throw new ErroApi(400, 'Informe a senha inicial do usuário.');
  if (u.senha) validarSenha(u.senha);
  return u;
}

const listar = (q) => repo.listar({ busca: q.busca ? String(q.busca).trim().slice(0, 60) : null });

async function buscar(id) {
  const u = await repo.buscarPorId(v.id(id));
  if (!u) throw new ErroApi(404, 'Usuário não encontrado.');
  return u;
}

const criar = (dados) => repo.criar(validar(dados, true));

async function atualizar(id, dados, logado) {
  const n = v.id(id);
  const u = validar(dados, false);
  if (n === logado.id_usuario && (u.perfil !== logado.perfil || !u.ativo)) {
    throw new ErroApi(400, 'Você não pode alterar o próprio perfil nem inativar a si mesmo.');
  }
  const salvo = await repo.atualizar(n, u);
  if (!salvo) throw new ErroApi(404, 'Usuário não encontrado.');
  return salvo;
}

// Usuário que já registrou ou cancelou vendas é inativado, para preservar o histórico.
async function excluir(id, logado) {
  const n = v.id(id);
  if (n === logado.id_usuario) throw new ErroApi(400, 'Você não pode excluir o próprio usuário.');
  if (!(await repo.buscarPorId(n))) throw new ErroApi(404, 'Usuário não encontrado.');
  if (await repo.possuiVendas(n)) {
    await repo.inativar(n);
    return { acao: 'inativado', mensagem: 'O usuário tem vendas registradas e foi inativado.' };
  }
  await repo.excluir(n);
  return { acao: 'excluido', mensagem: 'Usuário excluído.' };
}

module.exports = { listar, buscar, criar, atualizar, excluir, PERFIS };
