// Relatório gerencial de vendas com totalizadores (RF14, RF15, RF16), exportável em CSV e PDF.
(async () => {
  await App.iniciar(['GERENTE', 'ADMINISTRADOR']);
  const { $, escapar: e, moeda } = App;
  const form = $('#filtros');
  const kpi = (r, v, d = '') => `<div class="kpi"><div class="rotulo">${r}</div><div class="valor">${v}</div><div class="det">${d}</div></div>`;

  async function carregar(params = '') {
    try {
      const r = await App.api('/relatorios/vendas' + params);
      const t = r.totais;
      form.inicio.value = r.periodo.inicio;
      form.fim.value = r.periodo.fim;
      $('#periodoTexto').textContent = `Período: ${App.data(r.periodo.inicio)} a ${App.data(r.periodo.fim)}`;
      $('#btnCsv').href = `/api/relatorios/vendas.csv?inicio=${r.periodo.inicio}&fim=${r.periodo.fim}`;
      $('#totais').innerHTML = [
        kpi('Faturamento líquido', moeda(t.faturamento), `bruto ${moeda(t.bruto)} − descontos ${moeda(t.descontos)}`),
        kpi('Vendas concluídas', t.qtd_vendas, `${t.itens_vendidos} itens vendidos`),
        kpi('Ticket médio', moeda(t.ticket_medio)),
        kpi('Canceladas', t.qtd_canceladas, `${moeda(t.valor_cancelado)} estornados`),
      ].join('');
      $('#porDia').innerHTML = r.por_dia.map((d) => `<tr><td>${App.data(d.dia)}</td><td class="num">${d.qtd_vendas}</td>
        <td class="num">${moeda(d.total)}</td><td class="num">${moeda(d.ticket_medio)}</td></tr>`).join('');
      $('#porDiaTotal').innerHTML = `<tr><td>Total</td><td class="num">${t.qtd_vendas}</td><td class="num">${moeda(t.faturamento)}</td><td class="num">${moeda(t.ticket_medio)}</td></tr>`;
      const totalFormas = r.por_forma.reduce((s, f) => s + Number(f.total), 0);
      $('#porForma').innerHTML = r.por_forma.map((f) => `<tr><td>${e(f.forma)}</td><td class="num">${f.qtd_pagamentos}</td>
        <td class="num">${moeda(f.total)}</td><td class="num">${App.numero((100 * f.total) / (totalFormas || 1), 1)}%</td></tr>`).join('')
        || '<tr><td colspan="4" class="vazio">Sem pagamentos no período.</td></tr>';
      $('#porFormaTotal').innerHTML = `<tr><td>Total</td><td class="num">${r.por_forma.reduce((s, f) => s + f.qtd_pagamentos, 0)}</td><td class="num">${moeda(totalFormas)}</td><td class="num">100%</td></tr>`;
      $('#maisVendidos').innerHTML = r.mais_vendidos.map((p) => `<tr><td>${e(p.nome)}<br><small class="rodape">${e(p.codigo)}</small></td>
        <td class="num">${p.unidades}</td><td class="num">${moeda(p.faturamento)}</td></tr>`).join('')
        || '<tr><td colspan="3" class="vazio">Sem vendas no período.</td></tr>';
    } catch (err) { App.aviso(err.message, 'erro'); }
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    carregar(`?inicio=${form.inicio.value}&fim=${form.fim.value}`);
  });
  $('#btnPdf').addEventListener('click', () => window.print());
  carregar();
})();
