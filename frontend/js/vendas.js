// Consulta de vendas (RF11) e cancelamento (RF12, RN03, RN08).
(async () => {
  await App.iniciar();
  const { $, escapar: e } = App;
  const form = $('#filtros');
  const q = new URLSearchParams(location.search);
  if (q.get('cliente')) form.cliente.value = q.get('cliente');

  async function carregar() {
    const p = new URLSearchParams();
    for (const campo of ['inicio', 'fim', 'status', 'numero', 'cliente', 'produto']) {
      if (form[campo].value.trim()) p.set(campo, form[campo].value.trim());
    }
    try {
      const vendas = await App.api('/vendas?' + p);
      $('#lista').innerHTML = vendas.map((v) => `
        <tr class="${v.status === 'CANCELADA' ? 'inativo' : ''}">
          <td>${v.id_venda}</td>
          <td class="nw">${App.data(v.data_hora)}</td>
          <td class="esconde-celular nw">${e(v.atendente)}</td>
          <td>${v.cliente ? e(v.cliente) : '<span class="rodape">não identificado</span>'}</td>
          <td class="num esconde-celular">${v.qtd_itens}</td>
          <td class="num">${App.moeda(v.valor_total)}</td>
          <td><span class="selo ${v.status === 'CONCLUIDA' ? 'ok' : 'erro'}">${v.status === 'CONCLUIDA' ? 'Concluída' : 'Cancelada'}</span></td>
          <td class="acoes">
            <a class="btn mini" href="comprovante.html?id=${v.id_venda}">Comprovante</a>
            ${App.pode('ATENDENTE') && v.status === 'CONCLUIDA'
              ? `<button class="btn mini contorno-perigo" data-cancelar="${v.id_venda}" data-total="${v.valor_total}">Cancelar</button>` : ''}
          </td>
        </tr>`).join('') || '<tr><td colspan="8" class="vazio">Nenhuma venda encontrada com esses filtros.</td></tr>';
      const concluidas = vendas.filter((v) => v.status === 'CONCLUIDA');
      $('#resumo').textContent = `${vendas.length} venda(s) listada(s)${vendas.length === 200 ? ' (limite de 200; refine os filtros)' : ''} · `
        + `${concluidas.length} concluída(s) somando ${App.moeda(concluidas.reduce((s, v) => s + Number(v.valor_total), 0))}`;
    } catch (err) {
      App.aviso(err.message, 'erro');
    }
  }

  $('#lista').addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-cancelar]');
    if (!b) return;
    const id = b.dataset.cancelar;
    const { ok, valor } = await App.confirmar({
      titulo: `Cancelar a venda nº ${id}?`,
      texto: `Valor: ${App.moeda(b.dataset.total)}. Os itens voltam para o estoque e a venda fica no histórico como cancelada. Devolva o valor ao cliente pelo mesmo meio de pagamento.`,
      botao: 'Cancelar venda', perigo: true, campo: 'Motivo',
    });
    if (!ok) return;
    try {
      const r = await App.api(`/vendas/${id}/cancelar`, { method: 'POST', body: { motivo: valor } });
      App.aviso(r.mensagem);
      carregar();
    } catch (err) {
      App.aviso(err.message, 'erro');
    }
  });

  form.addEventListener('submit', (ev) => { ev.preventDefault(); carregar(); });
  form.addEventListener('reset', () => setTimeout(carregar, 0));
  carregar();
})();
