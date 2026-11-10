// Regras do cadastro de produtos (UC02, RF01, RF10, RF17, RN05, RN07).
const repo = require('../repositories/produtoRepository');
const alertas = require('../repositories/alertaRepository');
const { transacao } = require('../config/db');
const { ErroApi } = require('../middlewares/erros');
const v = require('../utils/validacao');

function validar(d) {
  const p = {
    codigo: v.texto(d.codigo, 'Código', { max: 20 }),
    nome: v.texto(d.nome, 'Nome', { min: 2, max: 120 }),
    id_categoria: v.id(d.id_categoria, 'Categoria'),
    preco_custo: v.centavos(d.preco_custo ?? 0),
    preco_venda: v.centavos(d.preco_venda),
    quantidade_estoque: Number(d.quantidade_estoque ?? 0),
    estoque_minimo: Number(d.estoque_minimo ?? 0),
    ativo: d.ativo === undefined ? true : Boolean(d.ativo),
  };
  const erros = [];
  if (!(p.preco_venda > 0)) erros.push('Preço de venda deve ser maior que zero.');
  if (!(p.preco_custo >= 0)) erros.push('Preço de custo não pode ser negativo.');
  if (p.preco_venda > 99999999 || p.preco_custo > 99999999) erros.push('Preço acima do limite permitido.');
  if (!Number.isInteger(p.quantidade_estoque) || p.quantidade_estoque < 0) erros.push('Quantidade em estoque deve ser um número inteiro maior ou igual a zero.');
  if (!Number.isInteger(p.estoque_minimo) || p.estoque_minimo < 0) erros.push('Estoque mínimo deve ser um número inteiro maior ou igual a zero.');
  if (erros.length) throw new ErroApi(400, erros.join(' '));
  return { ...p, preco_custo: v.reais(p.preco_custo), preco_venda: v.reais(p.preco_venda) };
}

async function listar(q) {
  return repo.listar({
    busca: q.busca ? String(q.busca).trim().slice(0, 60) : null,
    incluirInativos: q.inativos === 'true',
    somenteBaixo: q.baixo === 'true',
    limite: q.limite ? Math.min(Number(q.limite) || 20, 500) : 500,
  });
}

async function buscar(id) {
  const produto = await repo.buscarPorId(v.id(id));
  if (!produto) throw new ErroApi(404, 'Produto não encontrado.');
  return produto;
}

// depois de qualquer mudança de saldo ou mínimo: gera ou encerra o alerta de estoque baixo (RN07)
async function conferirAlerta(id, cx) {
  await alertas.gerarSeNecessario([id], cx);
  await alertas.resolverSeNecessario([id], cx);
}

async function criar(dados) {
  const p = validar(dados);
  const id = await transacao(async (cx) => {
    const novo = await repo.criar(p, cx);
    await conferirAlerta(novo, cx);
    return novo;
  });
  return repo.buscarPorId(id);
}

async function atualizar(id, dados) {
  const n = v.id(id);
  const p = validar(dados);
  await transacao(async (cx) => {
    if (!(await repo.atualizar(n, p, cx))) throw new ErroApi(404, 'Produto não encontrado.');
    await conferirAlerta(n, cx);
  });
  return repo.buscarPorId(n);
}

// Entrada de mercadoria: soma ao saldo e encerra o alerta se o produto voltou acima do mínimo.
async function repor(id, dados) {
  const n = v.id(id);
  const qtd = Number(dados.quantidade);
  if (!Number.isInteger(qtd) || qtd <= 0 || qtd > 100000) {
    throw new ErroApi(400, 'Informe uma quantidade inteira maior que zero.');
  }
  await transacao(async (cx) => {
    if (!(await repo.movimentarEstoque(n, qtd, cx))) throw new ErroApi(404, 'Produto não encontrado.');
    await conferirAlerta(n, cx);
  });
  return repo.buscarPorId(n);
}

// RN05: produto que já aparece em alguma venda nunca é apagado, apenas inativado.
async function excluir(id) {
  const n = v.id(id);
  if (!(await repo.buscarPorId(n))) throw new ErroApi(404, 'Produto não encontrado.');
  if (await repo.possuiVendas(n)) {
    await transacao(async (cx) => {
      await repo.inativar(n, cx);
      await alertas.resolverSeNecessario([n], cx);
    });
    return { acao: 'inativado', mensagem: 'O produto tem vendas registradas e foi inativado (RN05).' };
  }
  await repo.excluir(n);
  return { acao: 'excluido', mensagem: 'Produto excluído.' };
}

module.exports = { listar, buscar, criar, atualizar, repor, excluir };
