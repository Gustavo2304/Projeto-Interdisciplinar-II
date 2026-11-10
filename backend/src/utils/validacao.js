// Funções de validação e conversão usadas pelos services.
const { ErroApi } = require('../middlewares/erros');

const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

// Converte "1.234,56", "1234.56" ou 12.5 em centavos (inteiro). Evita erro de arredondamento.
function centavos(valor) {
  if (valor === null || valor === undefined || valor === '') return NaN;
  if (typeof valor === 'number') return Math.round(valor * 100);
  let s = String(valor).trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}
const reais = (c) => (c / 100).toFixed(2);

function cpfValido(cpf) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const k of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < k; i++) soma += Number(cpf[i]) * (k + 1 - i);
    const dv = (soma * 10) % 11 % 10;
    if (dv !== Number(cpf[k])) return false;
  }
  return true;
}

function cnpjValido(cnpj) {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const pesos = [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]];
  for (const [n, p] of [[12, pesos[0]], [13, pesos[1]]]) {
    const soma = p.reduce((s, w, i) => s + Number(cnpj[i]) * w, 0);
    const r = soma % 11;
    if ((r < 2 ? 0 : 11 - r) !== Number(cnpj[n])) return false;
  }
  return true;
}

function texto(valor, campo, { min = 1, max = 255, obrigatorio = true } = {}) {
  const s = String(valor ?? '').trim();
  if (!s && !obrigatorio) return null;
  if (s.length < min || s.length > max) {
    throw new ErroApi(400, min > 1 ? `${campo} deve ter entre ${min} e ${max} caracteres.` : `${campo} é obrigatório (até ${max} caracteres).`);
  }
  return s;
}

function id(valor, nome = 'Identificador') {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) throw new ErroApi(400, `${nome} inválido.`);
  return n;
}

const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00`));

// Período de consulta: valida datas no formato AAAA-MM-DD (as duas opcionais).
function periodo(inicio, fim) {
  if (inicio && !dataValida(inicio)) throw new ErroApi(400, 'Data inicial inválida.');
  if (fim && !dataValida(fim)) throw new ErroApi(400, 'Data final inválida.');
  if (inicio && fim && inicio > fim) throw new ErroApi(400, 'A data inicial deve ser anterior ou igual à data final.');
  return { inicio: inicio || null, fim: fim || null };
}

module.exports = { soDigitos, centavos, reais, cpfValido, cnpjValido, texto, id, periodo, dataValida };
