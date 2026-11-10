// PDV: registrar venda (UC05). As regras são validadas de novo no servidor;
// aqui elas servem para orientar o atendente antes de enviar.
(async () => {
  await App.iniciar(['ATENDENTE']);
  const { $ } = App;
  const carrinho = new Map();     // id_produto -> { produto, quantidade }
  let pagamentos = [];            // { id_forma_pagamento, nome, valor (centavos), recebido (centavos|null) }
  let cliente = null;
  let iniciadaEm = null;          // primeiro item lançado: mede o tempo de atendimento (indicador da Aula 3)
  let formas = [];
  let encontrados = [];
  let foco = -1;

  formas = await App.api('/formas-pagamento');
  $('#forma').innerHTML = formas.map((f) => `<option value="${f.id_forma_pagamento}">${App.escapar(f.nome)}</option>`).join('');

  // ---------- totais (em centavos, para não errar arredondamento) ----------
  const subtotal = () => [...carrinho.values()].reduce((s, i) => s + i.quantidade * App.centavos(i.produto.preco_venda), 0);
  const desconto = () => {
    const d = $('#desconto').value.trim() ? App.centavos($('#desconto').value) : 0;
    return Number.isFinite(d) && d > 0 ? d : 0;
  };
  const total = () => Math.max(subtotal() - desconto(), 0);
  const pago = () => pagamentos.reduce((s, p) => s + p.valor, 0);

  function desenharCarrinho() {
    const linhas = [...carrinho.values()].map(({ produto: p, quantidade: q }) => `
      <tr>
        <td><strong>${App.escapar(p.nome)}</strong><br><small class="rodape">${App.escapar(p.codigo)} · estoque ${p.quantidade_estoque}</small></td>
        <td><span class="qtd-ctrl">
          <button type="button" data-menos="${p.id_produto}" aria-label="Diminuir">−</button>
          <span>${q}</span>
          <button type="button" data-mais="${p.id_produto}" aria-label="Aumentar">+</button></span></td>
        <td class="num esconde-celular">${App.moeda(p.preco_venda)}</td>
        <td class="num">${App.moeda((q * App.centavos(p.preco_venda)) / 100)}</td>
        <td class="acoes"><button class="btn mini contorno-perigo" data-remover="${p.id_produto}" aria-label="Remover">✕</button></td>
      </tr>`).join('');
    $('#itens').innerHTML = linhas;
    $('#vazio').hidden = carrinho.size > 0;
    $('#subtotal').textContent = App.moeda(subtotal() / 100);
    $('#valorDesconto').textContent = '− ' + App.moeda(desconto() / 100);
    $('#total').textContent = App.moeda(total() / 100);
    $('#btnPagar').disabled = carrinho.size === 0;
  }

  function adicionar(produto, qtd) {
    if (!Number.isInteger(qtd) || qtd < 1) return App.aviso('Informe uma quantidade inteira maior que zero.', 'erro');
    const atual = carrinho.get(produto.id_produto);
    const nova = (atual ? atual.quantidade : 0) + qtd;
    if (nova > produto.quantidade_estoque) {     // RN02 (conferida de novo no servidor)
      return App.aviso(`Estoque insuficiente: "${produto.nome}" tem ${produto.quantidade_estoque} em estoque.`, 'erro');
    }
    if (!iniciadaEm) iniciadaEm = new Date().toISOString();
    carrinho.set(produto.id_produto, { produto, quantidade: nova });
    desenharCarrinho();
  }

  // ---------- busca de produto ----------
  function mostrarResultados() {
    const box = $('#resultados');
    if (!encontrados.length) {
      box.innerHTML = '<p class="vazio">Nenhum produto encontrado.</p>';
    } else {
      box.innerHTML = encontrados.map((p, i) => `
        <button type="button" data-i="${i}" class="${i === foco ? 'foco' : ''}" ${p.quantidade_estoque < 1 ? 'disabled' : ''}>
          <span>${App.escapar(p.nome)}<small>${App.escapar(p.codigo)} · ${p.quantidade_estoque < 1 ? 'sem estoque' : `estoque ${p.quantidade_estoque}`}</small></span>
          <strong>${App.moeda(p.preco_venda)}</strong>
        </button>`).join('');
    }
    box.hidden = false;
  }

  async function buscar() {
    const termo = $('#busca').value.trim();
    if (!termo) { $('#resultados').hidden = true; return; }
    try {
      encontrados = await App.api(`/produtos?busca=${encodeURIComponent(termo)}&limite=8`);
      foco = encontrados.length === 1 ? 0 : -1;
      // código exato: adiciona direto (como num leitor de código de barras)
      if (encontrados.length === 1 && encontrados[0].codigo === termo) return escolher(0);
      mostrarResultados();
    } catch (e) { App.aviso(e.message, 'erro'); }
  }

  function escolher(i) {
    adicionar(encontrados[i], Number($('#qtd').value));
    $('#resultados').hidden = true;
    $('#busca').value = '';
    $('#qtd').value = 1;
    $('#busca').focus();
  }

  let espera;
  $('#busca').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(buscar, 250); });
  $('#busca').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (!$('#resultados').hidden && foco >= 0) escolher(foco); else buscar();
    } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!encontrados.length) return;
      foco = (foco + (ev.key === 'ArrowDown' ? 1 : -1) + encontrados.length) % encontrados.length;
      mostrarResultados();
    } else if (ev.key === 'Escape') { $('#resultados').hidden = true; }
  });
  $('#resultados').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-i]');
    if (b) escolher(Number(b.dataset.i));
  });

  $('#itens').addEventListener('click', (ev) => {
    const t = ev.target.closest('button');
    if (!t) return;
    const id = Number(t.dataset.mais || t.dataset.menos || t.dataset.remover);
    const item = carrinho.get(id);
    if (!item) return;
    if (t.dataset.mais) adicionar(item.produto, 1);
    if (t.dataset.menos) { if (item.quantidade > 1) item.quantidade -= 1; else carrinho.delete(id); }
    if (t.dataset.remover) carrinho.delete(id);
    desenharCarrinho();
  });

  $('#desconto').addEventListener('input', () => {
    desenharCarrinho();
    const d = $('#desconto').value.trim() ? App.centavos($('#desconto').value) : 0;
    if (!Number.isFinite(d) || d < 0) App.aviso('Desconto inválido.', 'erro');
    else if (d > subtotal()) App.aviso('O desconto não pode ser maior que o subtotal.', 'erro');
  });

  // ---------- cliente (opcional) ----------
  let esperaCli;
  $('#buscaCliente').addEventListener('input', () => {
    clearTimeout(esperaCli);
    esperaCli = setTimeout(async () => {
      const termo = $('#buscaCliente').value.trim();
      const box = $('#resultadosCliente');
      if (termo.length < 2) { box.hidden = true; return; }
      const lista = await App.api(`/clientes?busca=${encodeURIComponent(termo)}`).catch(() => []);
      box.innerHTML = lista.slice(0, 6).map((c) => `
        <button type="button" data-id="${c.id_cliente}"><span>${App.escapar(c.nome)}<small>${App.documento(c.cpf_cnpj)}</small></span></button>`).join('')
        || '<p class="vazio">Cliente não encontrado. O cadastro é feito pelo administrador.</p>';
      box.hidden = false;
      box.onclick = (ev) => {
        const b = ev.target.closest('button[data-id]');
        if (!b) return;
        cliente = lista.find((c) => c.id_cliente === Number(b.dataset.id));
        $('#clienteEscolhido').innerHTML = `<span><strong>${App.escapar(cliente.nome)}</strong><br><small>${App.documento(cliente.cpf_cnpj)}</small></span>
          <button type="button" class="btn mini" id="tirarCliente">Remover</button>`;
        $('#clienteEscolhido').hidden = false;
        $('#buscaCliente').closest('label').hidden = true;
        box.hidden = true;
        $('#tirarCliente').onclick = () => {
          cliente = null;
          $('#clienteEscolhido').hidden = true;
          $('#buscaCliente').closest('label').hidden = false;
          $('#buscaCliente').value = '';
        };
      };
    }, 250);
  });

  // ---------- pagamento ----------
  function formaAtual() { return formas.find((f) => f.id_forma_pagamento === Number($('#forma').value)); }

  function desenharPagamento() {
    const restante = total() - pago();
    $('#totalPagar').textContent = App.moeda(total() / 100);
    $('#pagamentos').innerHTML = pagamentos.map((p, i) => `
      <li><span>${App.escapar(p.nome)}${p.recebido ? `<br><small class="rodape">recebido ${App.moeda(p.recebido / 100)}</small>` : ''}</span>
        <span>${App.moeda(p.valor / 100)} <button class="btn mini contorno-perigo" data-tirar="${i}" aria-label="Remover pagamento">✕</button></span></li>`).join('');
    $('#restante').textContent = App.moeda(Math.max(restante, 0) / 100);
    $('#restante').classList.toggle('zero', restante === 0);
    const troco = pagamentos.reduce((s, p) => s + (p.recebido ? p.recebido - p.valor : 0), 0);
    $('#linhaTroco').hidden = troco <= 0;
    $('#troco').textContent = App.moeda(troco / 100);
    $('#btnFinalizar').disabled = restante !== 0;       // RN01
    $('#formPagamento').hidden = restante <= 0;
    $('#valorPg').value = restante > 0 ? App.numero(restante / 100) : '';
    $('#campoRecebido').hidden = !formaAtual().permite_troco;
  }

  $('#btnPagar').addEventListener('click', () => {
    if (desconto() > subtotal()) return App.aviso('O desconto não pode ser maior que o subtotal.', 'erro');
    $('#passoResumo').hidden = true;
    $('#passoPagamento').hidden = false;
    $('#etapa').textContent = '2. Pagamento';
    $('#busca').disabled = true;
    pagamentos = [];
    desenharPagamento();
    $('#forma').focus();
  });
  $('#btnVoltar').addEventListener('click', () => {
    $('#passoResumo').hidden = false;
    $('#passoPagamento').hidden = true;
    $('#etapa').textContent = '1. Itens';
    $('#busca').disabled = false;
  });
  $('#forma').addEventListener('change', () => { $('#campoRecebido').hidden = !formaAtual().permite_troco; });

  $('#formPagamento').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const forma = formaAtual();
    const valor = App.centavos($('#valorPg').value);
    const restante = total() - pago();
    if (!(valor > 0)) return App.aviso('Informe um valor maior que zero.', 'erro');
    if (valor > restante) return App.aviso(`O valor passa do restante (${App.moeda(restante / 100)}). Use "Recebido" para calcular troco.`, 'erro');
    let recebido = null;
    if (forma.permite_troco && $('#recebido').value.trim()) {
      recebido = App.centavos($('#recebido').value);
      if (!(recebido >= valor)) return App.aviso('O valor recebido não pode ser menor que o valor pago.', 'erro');
    }
    pagamentos.push({ id_forma_pagamento: forma.id_forma_pagamento, nome: forma.nome, valor, recebido });
    $('#recebido').value = '';
    desenharPagamento();
  });
  $('#pagamentos').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tirar]');
    if (b) { pagamentos.splice(Number(b.dataset.tirar), 1); desenharPagamento(); }
  });

  $('#btnFinalizar').addEventListener('click', async () => {
    const botao = $('#btnFinalizar');
    botao.disabled = true;
    try {
      const r = await App.api('/vendas', {
        method: 'POST',
        body: {
          id_cliente: cliente ? cliente.id_cliente : null,
          desconto: (desconto() / 100).toFixed(2),
          iniciada_em: iniciadaEm,
          itens: [...carrinho.values()].map((i) => ({ id_produto: i.produto.id_produto, quantidade: i.quantidade })),
          pagamentos: pagamentos.map((p) => ({
            id_forma_pagamento: p.id_forma_pagamento,
            valor: (p.valor / 100).toFixed(2),
            valor_recebido: p.recebido ? (p.recebido / 100).toFixed(2) : null,
          })),
        },
      });
      App.guardar('hermes_venda_nova', { mensagem: r.mensagem, alertas: r.alertas });
      location.href = `comprovante.html?id=${r.id_venda}&nova=1`;
    } catch (e) {
      App.aviso(e.message, 'erro');
      botao.disabled = false;
    }
  });

  $('#btnLimpar').addEventListener('click', async () => {
    if (!carrinho.size) return;
    const { ok } = await App.confirmar({ titulo: 'Cancelar venda em andamento?', texto: 'Os itens lançados serão descartados. Nada foi gravado ainda.', botao: 'Descartar itens', perigo: true });
    if (!ok) return;
    carrinho.clear();
    iniciadaEm = null;
    desenharCarrinho();
    App.aviso('Venda em andamento descartada.');
  });

  desenharCarrinho();
  $('#busca').focus();
})();
