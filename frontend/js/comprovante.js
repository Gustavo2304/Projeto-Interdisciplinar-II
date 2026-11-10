// Comprovante da venda em tela e para impressão (RF13). Não é documento fiscal.
(async () => {
  await App.iniciar();
  const { $, escapar: e, moeda } = App;
  const params = new URLSearchParams(location.search);
  $('#btnNova').hidden = !App.pode('ATENDENTE');
  $('#btnImprimir').addEventListener('click', () => window.print());

  const nova = params.get('nova') && App.retirar('hermes_venda_nova');
  if (nova) {
    App.aviso(nova.mensagem);
    if (nova.alertas && nova.alertas.length) App.aviso(`Estoque baixo: ${nova.alertas.join(', ')} (RN07).`, 'alerta');
  }

  try {
    const v = await App.api(`/vendas/${encodeURIComponent(params.get('id'))}`);
    const linha = (a, b, cls = '') => `<div class="linha ${cls}"><span>${a}</span><span>${b}</span></div>`;
    $('#comprovante').innerHTML = `
      ${v.status === 'CANCELADA' ? '<div class="carimbo">CANCELADA</div>' : ''}
      <h2>HermesPDV</h2>
      <p class="centro">Comprovante de venda — não é documento fiscal</p>
      <hr>
      ${linha('Venda nº', v.id_venda)}
      ${linha('Data', App.data(v.data_hora))}
      ${linha('Atendente', e(v.atendente))}
      ${v.cliente ? linha('Cliente', e(v.cliente)) + linha('CPF/CNPJ', App.documento(v.cliente_documento)) : ''}
      <hr>
      <table>
        <thead><tr><th>Item</th><th class="num">Qtd</th><th class="num">Unit.</th><th class="num">Total</th></tr></thead>
        <tbody>${v.itens.map((i) => `<tr><td>${e(i.nome)}</td><td class="num">${i.quantidade}</td>
          <td class="num">${App.numero(i.preco_unitario)}</td><td class="num">${App.numero(i.subtotal)}</td></tr>`).join('')}</tbody>
      </table>
      <hr>
      ${linha('Subtotal', moeda(v.subtotal))}
      ${Number(v.desconto) > 0 ? linha('Desconto', '− ' + moeda(v.desconto)) : ''}
      ${linha('TOTAL', moeda(v.valor_total), 'grande')}
      <hr>
      ${v.pagamentos.map((p) => linha(e(p.forma), moeda(p.valor))
        + (p.valor_recebido ? linha('&nbsp;&nbsp;recebido', moeda(p.valor_recebido)) + linha('&nbsp;&nbsp;troco', moeda(p.troco)) : '')).join('')}
      ${v.status === 'CANCELADA' ? `<hr><p>Cancelada em ${App.data(v.cancelada_em)} por ${e(v.cancelada_por)}.<br>Motivo: ${e(v.motivo_cancelamento)}</p>` : ''}
      <hr><p class="centro">Obrigado pela preferência!</p>`;
  } catch (err) {
    $('#comprovante').innerHTML = `<p class="vazio">${e(err.message)}</p>`;
  }
})();
