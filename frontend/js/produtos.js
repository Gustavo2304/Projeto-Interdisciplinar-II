// Cadastro de produtos (RF01, RN05) e consulta de estoque (RF17). Só o administrador altera.
(async () => {
  await App.iniciar();
  const { $, escapar: e } = App;
  const adm = App.pode('ADMINISTRADOR');
  const form = $('#formProduto');
  let produtos = [];
  let editando = null;
  let repondo = null;
  let destaque = null;

  $('#btnNovo').hidden = !adm;
  if (!adm) $('#subtitulo').textContent = 'Consulta de estoque por nome ou código';
  if (new URLSearchParams(location.search).get('baixo')) $('#baixo').checked = true;

  const categorias = await App.api('/categorias');
  form.id_categoria.innerHTML = '<option value="">Selecione...</option>'
    + categorias.map((c) => `<option value="${c.id_categoria}">${e(c.nome)}</option>`).join('');

  async function carregar() {
    const p = new URLSearchParams();
    if ($('#busca').value.trim()) p.set('busca', $('#busca').value.trim());
    if ($('#inativos').checked) p.set('inativos', 'true');
    if ($('#baixo').checked) p.set('baixo', 'true');
    try {
      produtos = await App.api('/produtos?' + p);
      $('#lista').innerHTML = produtos.map((x) => `
        <tr class="${x.ativo ? '' : 'inativo'} ${x.id_produto === destaque ? 'destaque' : ''}">
          <td>${e(x.codigo)}</td><td>${e(x.nome)}</td><td class="esconde-celular">${e(x.categoria)}</td>
          <td class="num">${App.moeda(x.preco_venda)}</td>
          <td class="num">${x.quantidade_estoque}${x.ativo && x.estoque_baixo ? ' <span class="selo baixo">baixo</span>' : ''}</td>
          <td class="num esconde-celular">${x.estoque_minimo}</td>
          <td><span class="selo ${x.ativo ? 'ok' : 'off'}">${x.ativo ? 'Ativo' : 'Inativo'}</span></td>
          <td class="acoes">${adm ? `
            <button class="btn mini" data-repor="${x.id_produto}">Repor</button>
            <button class="btn mini" data-editar="${x.id_produto}">Editar</button>
            <button class="btn mini contorno-perigo" data-excluir="${x.id_produto}">Excluir</button>` : ''}</td>
        </tr>`).join('') || '<tr><td colspan="8" class="vazio">Nenhum produto encontrado.</td></tr>';
      $('#total').textContent = `${produtos.length} produto(s).`;
    } catch (err) { App.aviso(err.message, 'erro'); }
  }

  function abrirForm(p) {
    editando = p ? p.id_produto : null;
    $('#tituloProduto').textContent = p ? `Editar produto — ${p.nome}` : 'Novo produto';
    form.codigo.value = p ? p.codigo : '';
    form.nome.value = p ? p.nome : '';
    form.id_categoria.value = p ? p.id_categoria : '';
    form.preco_custo.value = p ? App.numero(p.preco_custo) : '';
    form.preco_venda.value = p ? App.numero(p.preco_venda) : '';
    form.quantidade_estoque.value = p ? p.quantidade_estoque : 0;
    form.estoque_minimo.value = p ? p.estoque_minimo : 0;
    form.ativo.checked = p ? p.ativo : true;
    App.abrir('janelaProduto');
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!form.codigo.value.trim() || !form.nome.value.trim() || !form.id_categoria.value || !form.preco_venda.value.trim()) {
      return App.erroNaJanela('janelaProduto', 'Preencha os campos obrigatórios (*).');
    }
    const dados = {
      codigo: form.codigo.value, nome: form.nome.value, id_categoria: form.id_categoria.value,
      preco_custo: form.preco_custo.value || '0', preco_venda: form.preco_venda.value,
      quantidade_estoque: Number(form.quantidade_estoque.value || 0), estoque_minimo: Number(form.estoque_minimo.value || 0),
      ativo: form.ativo.checked,
    };
    try {
      const salvo = editando
        ? await App.api(`/produtos/${editando}`, { method: 'PUT', body: dados })
        : await App.api('/produtos', { method: 'POST', body: dados });
      App.fechar('janelaProduto');
      destaque = salvo.id_produto;
      App.aviso(editando ? `Produto "${salvo.nome}" atualizado.` : `Produto "${salvo.nome}" cadastrado.`);
      if (salvo.estoque_baixo && salvo.ativo) App.aviso(`"${salvo.nome}" está com estoque no mínimo: alerta gerado (RN07).`, 'alerta');
      carregar();
    } catch (err) { App.erroNaJanela('janelaProduto', err.message); }
  });

  $('#formRepor').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const qtd = Number(ev.target.quantidade.value);
    if (!Number.isInteger(qtd) || qtd < 1) return App.erroNaJanela('janelaRepor', 'Informe uma quantidade inteira maior que zero.');
    try {
      const p = await App.api(`/produtos/${repondo}/estoque`, { method: 'PATCH', body: { quantidade: qtd } });
      App.fechar('janelaRepor');
      destaque = p.id_produto;
      App.aviso(`Estoque de "${p.nome}" agora é ${p.quantidade_estoque}.${p.estoque_baixo ? '' : ' Alerta encerrado.'}`);
      carregar();
    } catch (err) { App.erroNaJanela('janelaRepor', err.message); }
  });

  $('#lista').addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const p = produtos.find((x) => x.id_produto === Number(b.dataset.editar || b.dataset.excluir || b.dataset.repor));
    if (b.dataset.editar) abrirForm(p);
    if (b.dataset.repor) {
      repondo = p.id_produto;
      $('#textoRepor').textContent = `${p.nome} — saldo atual ${p.quantidade_estoque}, mínimo ${p.estoque_minimo}.`;
      $('#formRepor').quantidade.value = '';
      App.abrir('janelaRepor');
    }
    if (b.dataset.excluir) {
      const { ok } = await App.confirmar({ titulo: 'Excluir produto?', texto: `"${p.nome}" será excluído. Se já tiver vendas, ele será apenas inativado (RN05).`, botao: 'Excluir', perigo: true });
      if (!ok) return;
      try {
        const r = await App.api(`/produtos/${p.id_produto}`, { method: 'DELETE' });
        App.aviso(r.mensagem, r.acao === 'inativado' ? 'alerta' : 'ok');
        carregar();
      } catch (err) { App.aviso(err.message, 'erro'); }
    }
  });

  $('#btnNovo').addEventListener('click', () => abrirForm(null));
  $('#filtros').addEventListener('submit', (ev) => { ev.preventDefault(); carregar(); });
  $('#inativos').addEventListener('change', carregar);
  $('#baixo').addEventListener('change', carregar);
  carregar();
})();
