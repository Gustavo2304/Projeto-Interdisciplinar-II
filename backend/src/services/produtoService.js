// Service: regras de negócio do cadastro de produtos (UC02, RF01, RN05).
const repo = require('../repositories/produtoRepository');
const { ErroApi } = require('../middlewares/erros');

function numero(valor) {
  if (valor === '' || valor === null || valor === undefined) return NaN;
  return Number(String(valor).replace(',', '.'));
}

function validar(dados) {
  const p = {
    codigo: String(dados.codigo || '').trim(),
    nome: String(dados.nome || '').trim(),
    id_categoria: Number(dados.id_categoria),
    preco_custo: numero(dados.preco_custo ?? 0),
    preco_venda: numero(dados.preco_venda),
    quantidade_estoque: numero(dados.quantidade_estoque ?? 0),
    estoque_minimo: numero(dados.estoque_minimo ?? 0),
    ativo: dados.ativo === undefined ? true : Boolean(dados.ativo),
  };
  const erros = [];
  if (!p.codigo || p.codigo.length > 20) erros.push('Código é obrigatório (até 20 caracteres).');
  if (!p.nome || p.nome.length > 120) erros.push('Nome é obrigatório (até 120 caracteres).');
  if (!Number.isInteger(p.id_categoria) || p.id_categoria <= 0) erros.push('Selecione uma categoria.');
  if (!(p.preco_venda > 0)) erros.push('Preço de venda deve ser maior que zero.');
  if (!(p.preco_custo >= 0)) erros.push('Preço de custo não pode ser negativo.');
  if (!Number.isInteger(p.quantidade_estoque) || p.quantidade_estoque < 0) erros.push('Quantidade em estoque deve ser um inteiro maior ou igual a zero.');
  if (!Number.isInteger(p.estoque_minimo) || p.estoque_minimo < 0) erros.push('Estoque mínimo deve ser um inteiro maior ou igual a zero.');
  if (erros.length) throw new ErroApi(400, erros.join(' '));
  return p;
}

function idValido(id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new ErroApi(400, 'Identificador inválido.');
  return n;
}

async function listar(filtros) {
  return repo.listar(filtros);
}

async function buscar(id) {
  const produto = await repo.buscarPorId(idValido(id));
  if (!produto) throw new ErroApi(404, 'Produto não encontrado.');
  return produto;
}

async function criar(dados) {
  return repo.criar(validar(dados));
}

async function atualizar(id, dados) {
  const produto = await repo.atualizar(idValido(id), validar(dados));
  if (!produto) throw new ErroApi(404, 'Produto não encontrado.');
  return produto;
}

// RN05: produto que já aparece em alguma venda nunca é apagado, apenas inativado.
async function excluir(id) {
  const n = idValido(id);
  if (!(await repo.buscarPorId(n))) throw new ErroApi(404, 'Produto não encontrado.');
  if (await repo.possuiVendas(n)) {
    await repo.inativar(n);
    return { acao: 'inativado', mensagem: 'O produto tem vendas registradas e foi inativado (RN05).' };
  }
  await repo.excluir(n);
  return { acao: 'excluido', mensagem: 'Produto excluído.' };
}

module.exports = { listar, buscar, criar, atualizar, excluir };
