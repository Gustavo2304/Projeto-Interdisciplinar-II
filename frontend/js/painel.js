// Painel: atalhos para o atendente; dashboard gerencial (indicadores da Aula 3) para gerente e administrador.
(async () => {
  const u = await App.iniciar();
  const { $ } = App;
  $('#saudacao').textContent = `Olá, ${u.nome.split(' ')[0]}`;

  async function carregarAlertas() {
    const lista = await App.api('/alertas');
    $('#qtdAlertas').textContent = lista.length;
    $('#alertas').innerHTML = lista.length ? lista.map((a) => `
      <li>
        <div><strong>${App.escapar(a.nome)}</strong>
          <small>Saldo ${a.quantidade_estoque} · mínimo ${a.estoque_minimo} · desde ${App.data(a.desde)}</small></div>
        ${App.pode('ADMINISTRADOR') ? `<a class="btn mini" href="produtos.html?baixo=1">Repor</a>` : ''}
      </li>`).join('') : '<li class="vazio">Nenhum produto com estoque baixo.</li>';
  }

  if (u.perfil === 'ATENDENTE') {
    $('#areaAtendente').hidden = false;
    $('#subtitulo').textContent = 'O que você quer fazer agora?';
    carregarAlertas().catch((e) => App.aviso(e.message, 'erro'));
    return;
  }

  $('#areaGestao').hidden = false;
  const form = $('#formPeriodo');

  function kpi(rotulo, valor, det = '', classe = '') {
    return `<div class="kpi ${classe}"><div class="rotulo">${rotulo}</div><div class="valor">${valor}</div><div class="det">${det}</div></div>`;
  }

  // gráfico de colunas em SVG, sem bibliotecas externas
  function graficoDias(dias) {
    const W = 960, H = 250, M = { t: 14, r: 10, b: 30, l: 78 };
    const max = Math.max(...dias.map((d) => Number(d.total)), 1);
    const passo = (W - M.l - M.r) / dias.length;
    const larg = Math.max(passo * 0.7, 2);
    const y = (v) => M.t + (H - M.t - M.b) * (1 - v / max);
    const linhasGrade = [0, 0.5, 1].map((f) => {
      const v = max * f;
      return `<line x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e3e8ef"/>
              <text x="${M.l - 6}" y="${y(v) + 4}" font-size="13" text-anchor="end" fill="#5b6576">R$ ${App.numero(v, 0)}</text>`;
    }).join('');
    const rotular = Math.ceil(dias.length / 15);
    const barras = dias.map((d, i) => {
      const x = M.l + i * passo + (passo - larg) / 2;
      const v = Number(d.total);
      return `<rect x="${x}" y="${y(v)}" width="${larg}" height="${H - M.b - y(v)}" rx="2" fill="#2f5a96">
                <title>${App.data(d.dia)}: ${App.moeda(v)} em ${d.qtd_vendas} venda(s)</title></rect>
              ${i % rotular === 0 ? `<text x="${x + larg / 2}" y="${H - M.b + 16}" font-size="13" text-anchor="middle" fill="#5b6576">${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}</text>` : ''}`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Faturamento por dia">${linhasGrade}${barras}</svg>`;
  }

  function barrasH(itens, rotulo, valor, formato) {
    if (!itens.length) return '<p class="vazio">Sem vendas no período.</p>';
    const max = Math.max(...itens.map((i) => Number(valor(i))), 1);
    return itens.map((i) => `
      <div class="linha"><span title="${App.escapar(rotulo(i))}">${App.escapar(rotulo(i))}</span>
        <div class="trilho"><div class="barra" style="width:${(100 * Number(valor(i))) / max}%"></div></div>
        <span class="val">${formato(i)}</span></div>`).join('');
  }

  async function carregar(params = '') {
    try {
      const d = await App.api('/dashboard' + params);
      form.inicio.value = d.periodo.inicio;
      form.fim.value = d.periodo.fim;
      $('#subtitulo').textContent = `Período: ${App.data(d.periodo.inicio)} a ${App.data(d.periodo.fim)} (${d.periodo.dias} dias)`;
      const k = d.indicadores;
      $('#kpis').innerHTML = [
        kpi('Faturamento', App.moeda(k.faturamento), `${k.itens_vendidos} itens vendidos`),
        kpi('Vendas concluídas', k.qtd_vendas, `${k.qtd_canceladas} cancelada(s): ${App.moeda(k.valor_cancelado)}`),
        kpi('Ticket médio', App.moeda(k.ticket_medio), `descontos: ${App.moeda(k.descontos)}`),
        kpi('Tempo médio de atendimento', App.duracao(k.tempo_medio_seg), 'do 1º item até finalizar', 'aula3'),
        kpi('Alertas de estoque atendidos', k.pct_alertas_resolvidos == null ? '—' : `${k.pct_alertas_resolvidos}%`,
          `${k.alertas_resolvidos} de ${k.alertas_gerados} gerados no período`, 'aula3'),
        kpi('Tempo médio de reposição', k.reposicao_media_horas == null ? '—' : `${App.numero(k.reposicao_media_horas, 1)} h`,
          'do alerta até o estoque repor', 'aula3'),
      ].join('');
      $('#grafDias').innerHTML = graficoDias(d.por_dia);
      const totalFormas = d.por_forma.reduce((s, f) => s + Number(f.total), 0) || 1;
      $('#grafFormas').innerHTML = barrasH(d.por_forma, (f) => f.forma, (f) => f.total,
        (f) => `${App.moeda(f.total)} · ${Math.round((100 * f.total) / totalFormas)}%`);
      $('#grafTop').innerHTML = barrasH(d.top_produtos, (p) => p.nome, (p) => p.unidades, (p) => `${p.unidades} un.`);
    } catch (e) {
      App.aviso(e.message, 'erro');
    }
  }

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    carregar(`?inicio=${form.inicio.value}&fim=${form.fim.value}`);
  });
  $('#btnPadrao').addEventListener('click', () => carregar());
  carregar();
  carregarAlertas().catch((e) => App.aviso(e.message, 'erro'));
})();
