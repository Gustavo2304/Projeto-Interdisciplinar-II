// Autenticação (quem é o usuário) e autorização (o que o perfil pode fazer) — RF04, RN04.
const token = require('../utils/token');
const usuarioRepo = require('../repositories/usuarioRepository');
const { ErroApi } = require('./erros');

const COOKIE = 'hermes_sessao';

function lerCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((c) => c.trim().split('='))
    .filter(([k, v]) => k && v).map(([k, v]) => [k, decodeURIComponent(v)]));
}

async function autenticar(req, res, next) {
  try {
    const bearer = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const dados = token.verificar(lerCookies(req)[COOKIE] || bearer);
    if (!dados) throw new ErroApi(401, 'Sessão expirada ou inexistente. Entre novamente.');
    const usuario = await usuarioRepo.buscarPorId(dados.sub);
    if (!usuario || !usuario.ativo) throw new ErroApi(401, 'Usuário inativo. Procure o administrador.');
    req.usuario = usuario;
    next();
  } catch (e) {
    next(e);
  }
}

const autorizar = (...perfis) => (req, res, next) => (perfis.includes(req.usuario.perfil)
  ? next()
  : next(new ErroApi(403, 'Seu perfil não tem acesso a esta função.')));

function gravarSessao(res, usuario) {
  const t = token.gerar({ sub: usuario.id_usuario, perfil: usuario.perfil });
  const seguro = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${8 * 3600}${seguro}`);
}

function apagarSessao(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

module.exports = { autenticar, autorizar, gravarSessao, apagarSessao };
