// Transação principal do sistema: registrar venda (UC05) e cancelar venda (UC09).
// Regras: RN01 (pagamentos = total), RN02 (estoque), RN03 (cancelar repõe estoque),
// RN07 (alerta de estoque baixo), RN08 (motivo do cancelamento), RN09 (troco).
const { transacao } = require('../config/db');
const vendas = require('../repositories/vendaRepository');
const produtos = require('../repositories/produtoRepository');
const clientes = require('../repositories/clienteRepository');
const formas = require('../repositories/formaPagamentoRepository');
const alertas = require('../repositories/alertaRepository');
const { ErroApi } = require('../middlewares/erros');
const v = require('../utils/validacao');

const dinheiro = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const doisDigitos = (n) => String(n).padStart(2, '0');
const dataLocal = (d) => `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())} `
  + `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}:${doisDigitos(d.getSeconds())}`;

// Momento em que o atendente começou a venda (indicador "tempo médio de atendimento").
function inicioDaVenda(valor) {
  const d = new Date(valor);
  const agora = Date.now();
  if (Number.isNaN(d.getTime()) || d.getTime() > agora || d.getTime() < agora - 12 * 3600 * 1000) return null;
  return dataLocal(d);
}

function lerItens(lista) {
  if (!Array.isArray(lista) || lista.length === 0) throw new ErroApi(400, 'Adicione ao menos um produto à venda.');
  const porProduto = new Map();
  for (const it of lista) {
    const id = v.id(it.id_produto, 'Produto');
    const qtd = Number(it.quantidade);
    if (!Number.isInteger(qtd) || qtd <= 0 || qtd > 9999) throw new ErroApi(400, 'Quantidade inválida em um dos itens.');
    porProduto.set(id, (porProduto.get(id) || 0) + qtd);
  }
  return [...porProduto].map(([id_produto, quantidade]) => ({ id_produto, quantidade }));
}

async function registrar(dados, usuario) {
  const itens = lerItens(dados.itens);
  const desconto = dados.desconto ? v.centavos(dados.desconto) : 0;
  if (!(desconto >= 0)) throw new ErroApi(400, 'Desconto inválido.');
  if (!Array.isArray(dados.pagamentos) || dados.pagamentos.length === 0) {
    throw new ErroApi(400, 'Informe ao menos uma forma de pagamento.');
  }
  const idCliente = dados.id_cliente ? v.id(dados.id_cliente, 'Cliente') : null;
  if (idCliente && !(await clientes.buscarPorId(idCliente))) throw new ErroApi(400, 'Cliente não encontrado.');

  return transacao(async (cx) => {
    // trava os produtos: duas vendas simultâneas não usam o mesmo saldo
    const mapa = new Map((await produtos.travarParaVenda(itens.map((i) => i.id_produto), cx))
      .map((p) => [p.id_produto, p]));
    let subtotal = 0;
    for (const it of itens) {
      const p = mapa.get(it.id_produto);
      if (!p || !p.ativo) throw new ErroApi(400, 'Um dos produtos não está mais disponível para venda.');
      if (it.quantidade > p.quantidade_estoque) {           // RN02
        throw new ErroApi(409, `Estoque insuficiente para "${p.nome}": disponível ${p.quantidade_estoque}, pedido ${it.quantidade} (RN02).`);
      }
      it.preco_unitario = v.reais(v.centavos(p.preco_venda)); // preço vem do banco, nunca da tela
      subtotal += it.quantidade * v.centavos(p.preco_venda);
    }
    if (desconto > subtotal) throw new ErroApi(400, 'O desconto não pode ser maior que o subtotal.');
    const total = subtotal - desconto;

    const aceitas = new Map((await formas.listarAtivas(cx)).map((f) => [f.id_forma_pagamento, f]));
    let pago = 0;
    const pagamentos = dados.pagamentos.map((pg) => {
      const forma = aceitas.get(Number(pg.id_forma_pagamento));
      if (!forma) throw new ErroApi(400, 'Forma de pagamento inválida.');
      const valor = v.centavos(pg.valor);
      if (!(valor > 0)) throw new ErroApi(400, `Valor inválido no pagamento em ${forma.nome}.`);
      let recebido = null;
      if (forma.permite_troco && pg.valor_recebido !== undefined && pg.valor_recebido !== null && pg.valor_recebido !== '') {
        recebido = v.centavos(pg.valor_recebido);                // RN09: troco = recebido - valor
        if (!(recebido >= valor)) throw new ErroApi(400, 'O valor recebido em dinheiro não pode ser menor que o valor pago.');
      }
      pago += valor;
      return { id_forma_pagamento: forma.id_forma_pagamento, valor: v.reais(valor), valor_recebido: recebido === null ? null : v.reais(recebido) };
    });
    if (pago !== total) {                                     // RN01
      throw new ErroApi(400, `A soma dos pagamentos (${dinheiro(pago)}) deve ser igual ao total da venda (${dinheiro(total)}) — RN01.`);
    }

    const idVenda = await vendas.inserirVenda({
      iniciada_em: inicioDaVenda(dados.iniciada_em), id_usuario: usuario.id_usuario, id_cliente: idCliente,
      subtotal: v.reais(subtotal), desconto: v.reais(desconto), valor_total: v.reais(total),
    }, cx);
    for (const it of itens) {
      await vendas.inserirItem(idVenda, it, cx);
      await produtos.movimentarEstoque(it.id_produto, -it.quantidade, cx);   // RF09: baixa automática
    }
    for (const pg of pagamentos) await vendas.inserirPagamento(idVenda, pg, cx);
    const novosAlertas = await alertas.gerarSeNecessario(itens.map((i) => i.id_produto), cx);   // RN07
    return {
      id_venda: idVenda,
      alertas: novosAlertas.map((id) => mapa.get(id).nome),
      mensagem: `Venda nº ${idVenda} registrada.`,
    };
  });
}

async function cancelar(id, dados, usuario) {
  const n = v.id(id, 'Venda');
  const motivo = String(dados.motivo || '').trim();
  if (motivo.length < 5 || motivo.length > 200) {                // RN08
    throw new ErroApi(400, 'Informe o motivo do cancelamento (de 5 a 200 caracteres).');
  }
  await transacao(async (cx) => {
    const venda = await vendas.travar(n, cx);
    if (!venda) throw new ErroApi(404, 'Venda não encontrada.');
    if (venda.status === 'CANCELADA') throw new ErroApi(409, 'Esta venda já está cancelada.');
    const itens = await vendas.itensDaVenda(n, cx);
    await vendas.marcarCancelada(n, usuario.id_usuario, motivo, cx);   // RNF05: nada é apagado
    for (const it of itens) await produtos.movimentarEstoque(it.id_produto, it.quantidade, cx);   // RN03
    await alertas.resolverSeNecessario(itens.map((i) => i.id_produto), cx);
  });
  return { mensagem: `Venda nº ${n} cancelada e estoque reposto.`, venda: await vendas.buscarCompleta(n) };
}

function listar(q) {
  const { inicio, fim } = v.periodo(q.inicio, q.fim);
  const status = q.status ? String(q.status).toUpperCase() : null;
  if (status && !['CONCLUIDA', 'CANCELADA'].includes(status)) throw new ErroApi(400, 'Status inválido.');
  return vendas.listar({
    inicio, fim, status,
    numero: q.numero ? v.id(q.numero, 'Número da venda') : null,
    cliente: q.cliente ? String(q.cliente).trim().slice(0, 60) : null,
    produto: q.produto ? String(q.produto).trim().slice(0, 60) : null,
  });
}

async function buscar(id) {
  const venda = await vendas.buscarCompleta(v.id(id, 'Venda'));
  if (!venda) throw new ErroApi(404, 'Venda não encontrada.');
  return venda;
}

module.exports = { registrar, cancelar, listar, buscar };
