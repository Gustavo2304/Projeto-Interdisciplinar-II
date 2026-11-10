// Login (RF04). Bloqueia por 1 minuto após 5 tentativas erradas seguidas no mesmo login.
const repo = require('../repositories/usuarioRepository');
const { ErroApi } = require('../middlewares/erros');

const tentativas = new Map();
const LIMITE = 5;
const BLOQUEIO_MS = 60 * 1000;

async function login(loginInformado, senha) {
  const login = String(loginInformado || '').trim().toLowerCase();
  if (!login || !senha) throw new ErroApi(400, 'Informe usuário e senha.');
  const t = tentativas.get(login);
  if (t && t.bloqueadoAte > Date.now()) {
    throw new ErroApi(429, 'Muitas tentativas sem sucesso. Aguarde 1 minuto e tente de novo.');
  }
  const usuario = await repo.autenticar(login, String(senha));
  if (!usuario) {
    const falhas = (t && !t.bloqueadoAte ? t.falhas : 0) + 1;   // depois de um bloqueio, recomeça a contagem
    tentativas.set(login, { falhas, bloqueadoAte: falhas >= LIMITE ? Date.now() + BLOQUEIO_MS : 0 });
    throw new ErroApi(401, 'Usuário ou senha inválidos.');
  }
  if (!usuario.ativo) throw new ErroApi(403, 'Usuário inativo. Procure o administrador.');
  tentativas.delete(login);
  return usuario;
}

module.exports = { login };
