// Relatório gerencial de vendas (RF14, RF15, RF16), dashboard com os indicadores da Aula 3
// e dados para a API de integração.
const repo = require('../repositories/relatorioRepository');
const alertas = require('../repositories/alertaRepository');
const { ErroApi } = require('../middlewares/erros');
const v = require('../utils/validacao');

async function resolverPeriodo(q) {
  let { inicio, fim } = v.periodo(q.inicio, q.fim);
  if (!inicio || !fim) {
    const padrao = await repo.periodoPadrao();
    inicio = inicio || (fim ? fim.slice(0, 8) + '01' : padrao.inicio);
    fim = fim || padrao.fim;
    if (inicio > fim) inicio = fim;
  }
  const dias = (Date.parse(fim) - Date.parse(inicio)) / 86400000 + 1;
  if (dias > 366) throw new ErroApi(400, 'Escolha um período de até 1 ano.');
  return { inicio, fim, dias };
}

async function vendas(q) {
  const periodo = await resolverPeriodo(q);
  const [totais, porDia, porForma, maisVendidos] = await Promise.all([
    repo.totais(periodo.inicio, periodo.fim),
    repo.porDia(periodo.inicio, periodo.fim),
    repo.porFormaPagamento(periodo.inicio, periodo.fim),
    repo.maisVendidos(periodo.inicio, periodo.fim, 10),
  ]);
  return { periodo, totais, por_dia: porDia, por_forma: porForma, mais_vendidos: maisVendidos };
}

// ---------- exportação CSV (abre direto no Excel: separador ; e vírgula decimal) ----------
const num = (x) => Number(x).toFixed(2).replace('.', ',');
const br = (d) => d.split('-').reverse().join('/');
const campo = (s) => (/[;"\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const linha = (...c) => c.map(campo).join(';');

async function vendasCsv(q) {
  const r = await vendas(q);
  const t = r.totais;
  const L = [
    linha('Relatório de vendas — HermesPDV'),
    linha('Período', br(r.periodo.inicio), br(r.periodo.fim)),
    '',
    linha('Totalizadores'),
    linha('Vendas concluídas', t.qtd_vendas),
    linha('Itens vendidos', t.itens_vendidos),
    linha('Valor bruto (R$)', num(t.bruto)),
    linha('Descontos (R$)', num(t.descontos)),
    linha('Faturamento líquido (R$)', num(t.faturamento)),
    linha('Ticket médio (R$)', num(t.ticket_medio)),
    linha('Vendas canceladas', t.qtd_canceladas),
    linha('Valor cancelado (R$)', num(t.valor_cancelado)),
    '',
    linha('Vendas por dia'),
    linha('Dia', 'Vendas', 'Total (R$)', 'Ticket médio (R$)'),
    ...r.por_dia.map((d) => linha(br(d.dia), d.qtd_vendas, num(d.total), num(d.ticket_medio))),
    linha('Total', t.qtd_vendas, num(t.faturamento), num(t.ticket_medio)),
    '',
    linha('Total por forma de pagamento'),
    linha('Forma', 'Pagamentos', 'Total (R$)'),
    ...r.por_forma.map((f) => linha(f.forma, f.qtd_pagamentos, num(f.total))),
    '',
    linha('Produtos mais vendidos'),
    linha('Código', 'Produto', 'Unidades', 'Faturamento (R$)'),
    ...r.mais_vendidos.map((p) => linha(p.codigo, p.nome, p.unidades, num(p.faturamento))),
  ];
  return { nome: `relatorio_vendas_${r.periodo.inicio}_a_${r.periodo.fim}.csv`, conteudo: '﻿' + L.join('\r\n') + '\r\n' };
}

// ---------- dashboard gerencial (indicadores definidos na Aula 3) ----------
async function dashboard(q) {
  const periodo = await resolverPeriodo(q);
  const [totais, estoque, porDia, porForma, top, abertos] = await Promise.all([
    repo.totais(periodo.inicio, periodo.fim),
    repo.indicadoresEstoque(periodo.inicio, periodo.fim),
    repo.porDia(periodo.inicio, periodo.fim),
    repo.porFormaPagamento(periodo.inicio, periodo.fim),
    repo.maisVendidos(periodo.inicio, periodo.fim, 5),
    alertas.listarAbertos(),
  ]);
  const pct = estoque.alertas_gerados ? Math.round((100 * estoque.alertas_resolvidos) / estoque.alertas_gerados) : null;
  return {
    periodo,
    indicadores: { ...totais, ...estoque, pct_alertas_resolvidos: pct },
    por_dia: porDia, por_forma: porForma, top_produtos: top, alertas_abertos: abertos,
  };
}

// ---------- API de integração ----------
async function integracaoVendas(q) {
  const periodo = await resolverPeriodo(q);
  const lista = await repo.vendasParaIntegracao(periodo.inicio, periodo.fim);
  return {
    sistema: 'HermesPDV', versao_layout: '1.0', gerado_em: new Date().toISOString(),
    periodo: { inicio: periodo.inicio, fim: periodo.fim }, quantidade: lista.length,
    total: lista.reduce((s, x) => s + Math.round(x.total * 100), 0) / 100,
    vendas: lista,
  };
}

module.exports = { vendas, vendasCsv, dashboard, integracaoVendas };
