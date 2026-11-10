// Cadastro de clientes (RF02, RN06). Só o administrador altera; os demais consultam.
(async () => {
  await App.iniciar();
  const { $, escapar: e } = App;
  const adm = App.pode('ADMINISTRADOR');
  const form = $('#formCliente');
  let clientes = [];
  let editando = null;

  $('#btnNovo').hidden = !adm;

  async function carregar() {
    const busca = $('#busca').value.trim();
    try {
      clientes = await App.api('/clientes' + (busca ? `?busca=${encodeURIComponent(busca)}` : ''));
      $('#lista').innerHTML = clientes.map((c) => `
        <tr>
          <td>${e(c.nome)}</td><td class="nw">${App.documento(c.cpf_cnpj)}</td>
          <td class="esconde-celular">${e(c.email || '')}</td><td class="esconde-celular nw">${App.telefone(c.telefone)}</td>
          <td class="num">${c.qtd_compras}</td>
          <td class="acoes">
            <a class="btn mini" href="vendas.html" data-historico="${c.id_cliente}">Compras</a>
            ${adm ? `<button class="btn mini" data-editar="${c.id_cliente}">Editar</button>
            <button class="btn mini contorno-perigo" data-excluir="${c.id_cliente}">Excluir</button>` : ''}
          </td>
        </tr>`).join('') || '<tr><td colspan="6" class="vazio">Nenhum cliente encontrado.</td></tr>';
      $('#total').textContent = `${clientes.length} cliente(s).`;
    } catch (err) { App.aviso(err.message, 'erro'); }
  }

  function abrirForm(c) {
    editando = c ? c.id_cliente : null;
    $('#tituloCliente').textContent = c ? `Editar cliente — ${c.nome}` : 'Novo cliente';
    form.nome.value = c ? c.nome : '';
    form.cpf_cnpj.value = c ? App.documento(c.cpf_cnpj) : '';
    form.telefone.value = c ? App.telefone(c.telefone) : '';
    form.email.value = c ? c.email || '' : '';
    App.abrir('janelaCliente');
  }

  form.cpf_cnpj.addEventListener('blur', () => { form.cpf_cnpj.value = App.documento(form.cpf_cnpj.value.replace(/\D/g, '')); });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const doc = form.cpf_cnpj.value.replace(/\D/g, '');
    if (form.nome.value.trim().length < 3) return App.erroNaJanela('janelaCliente', 'Informe o nome (mínimo de 3 letras).');
    if (doc.length !== 11 && doc.length !== 14) return App.erroNaJanela('janelaCliente', 'CPF deve ter 11 dígitos e CNPJ, 14.');
    const dados = { nome: form.nome.value, cpf_cnpj: doc, telefone: form.telefone.value, email: form.email.value };
    try {
      const salvo = editando
        ? await App.api(`/clientes/${editando}`, { method: 'PUT', body: dados })
        : await App.api('/clientes', { method: 'POST', body: dados });
      App.fechar('janelaCliente');
      App.aviso(editando ? `Cliente "${salvo.nome}" atualizado.` : `Cliente "${salvo.nome}" cadastrado.`);
      carregar();
    } catch (err) { App.erroNaJanela('janelaCliente', err.message); }
  });

  $('#lista').addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-editar],[data-excluir],[data-historico]');
    if (!b) return;
    const c = clientes.find((x) => x.id_cliente === Number(b.dataset.editar || b.dataset.excluir || b.dataset.historico));
    if (b.dataset.historico) { ev.preventDefault(); location.href = `vendas.html?cliente=${encodeURIComponent(c.cpf_cnpj)}`; }
    if (b.dataset.editar) abrirForm(c);
    if (b.dataset.excluir) {
      const { ok } = await App.confirmar({ titulo: 'Excluir cliente?', texto: `"${c.nome}" será excluído. Clientes com vendas não podem ser excluídos.`, botao: 'Excluir', perigo: true });
      if (!ok) return;
      try {
        const r = await App.api(`/clientes/${c.id_cliente}`, { method: 'DELETE' });
        App.aviso(r.mensagem);
        carregar();
      } catch (err) { App.aviso(err.message, 'erro'); }
    }
  });

  $('#btnNovo').addEventListener('click', () => abrirForm(null));
  $('#filtros').addEventListener('submit', (ev) => { ev.preventDefault(); carregar(); });
  carregar();
})();
