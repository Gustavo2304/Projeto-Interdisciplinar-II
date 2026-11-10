// Token de sessão no formato JWT (HS256), assinado com HMAC-SHA256 usando o módulo crypto do Node.
const crypto = require('crypto');

let SEGREDO = process.env.SESSAO_SEGREDO;
if (!SEGREDO) {
  SEGREDO = crypto.randomBytes(32).toString('hex');
  console.warn('[aviso] SESSAO_SEGREDO não definido no .env: as sessões serão perdidas a cada reinício.');
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const assinar = (texto) => crypto.createHmac('sha256', SEGREDO).update(texto).digest('base64url');
const CABECALHO = b64({ alg: 'HS256', typ: 'JWT' });

function gerar(dados, horas = 8) {
  const agora = Math.floor(Date.now() / 1000);
  const corpo = b64({ ...dados, iat: agora, exp: agora + horas * 3600 });
  return `${CABECALHO}.${corpo}.${assinar(`${CABECALHO}.${corpo}`)}`;
}

function verificar(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  const esperada = Buffer.from(assinar(`${partes[0]}.${partes[1]}`));
  const recebida = Buffer.from(partes[2]);
  if (esperada.length !== recebida.length || !crypto.timingSafeEqual(esperada, recebida)) return null;
  try {
    const dados = JSON.parse(Buffer.from(partes[1], 'base64url').toString());
    return dados.exp > Math.floor(Date.now() / 1000) ? dados : null;
  } catch {
    return null;
  }
}

module.exports = { gerar, verificar };
