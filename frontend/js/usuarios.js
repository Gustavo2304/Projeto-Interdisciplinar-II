// Cadastro de usuários (RF03, RN04). A senha é gravada como hash bcrypt (RNF02).
(async () => {
  const eu = await App.iniciar(['ADMINISTRADOR']);
  const { $, escapar: e } = App;
  const form = $('#formUsuario');
  const NOMES = { ADMINISTRADOR: 'Administrador', GERENTE: 'Gerente', ATENDENTE: 'Atendente' };
  let usuarios = [];
  let editando = null;

  async function carregar() {
    const busca = $('#busca').value.trim();
    try {
      usuarios = await App.api('/usuarios' + (busca ? `?busca=${encodeURIComponent(busca)}` : ''));
      $('#lista').innerHTML = usuarios.map((u) => `
        <tr class="${u.ativo ? '' : 'inativo'}">
          <td>${e(u.nome)}${u.id_usuario === eu.id_usuario ? ' <span class="selo info">você</span>' : ''}</td>
          <td>${e(u.login)}</td><td>${NOMES[u.perfil]}</td>
          <td><span class="selo ${u.ativo ? 'ok' : 'off'}">${u.ativo ? 'Ativo' : 'Inativo'}</span></td>
          <td class="num esconde-celular">${u.qtd_vendas}</td>
          <td class="acoes">
            <button class="btn mini" data-editar="${u.id_usuario}">Editar</button>
            ${u.id_usuario === eu.id_usuario ? '' : `<button class="btn mini contorno-perigo" data-excluir="${u.id_usuario}">Excluir</button>`}
          </td>
        </tr>`).join('') || '<tr><td colspan="6" class="vazio">Nenhum usuário encontrado.</td></tr>';
    } catch (err) { App.aviso(err.message, 'erro'); }
  }

  function abrirForm(u) {
    editando = u ? u.id_usuario : null;
    $('#tituloUsuario').textContent = u ? `Editar usuário — ${u.nome}` : 'Novo usuário';
    form.nome.value = u ? u.nome : '';
    form.login.value = u ? u.login : '';
    form.perfil.value = u ? u.perfil : '';
    form.senha.value = '';
    form.ativo.checked = u ? u.ativo : true;
    $('#rotuloSenha').textContent = u ? 'Nova senha (deixe em branco para manter a atual)' : 'Senha *';
    App.abrir('janelaUsuario');
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (form.nome.value.trim().length < 3 || !form.login.value.trim() || !form.perfil.value) {
      return App.erroNaJanela('janelaUsuario', 'Preencha nome, login e perfil.');
    }
    if (!editando && !form.senha.value) return App.erroNaJanela('janelaUsuario', 'Informe a senha inicial.');
    const dados = { nome: form.nome.value, login: form.login.value, perfil: form.perfil.value, ativo: form.ativo.checked };
    if (form.senha.value) dados.senha = form.senha.value;
    try {
      const salvo = editando
        ? await App.api(`/usuarios/${editando}`, { method: 'PUT', body: dados })
        : await App.api('/usuarios', { method: 'POST', body: dados });
      App.fechar('janelaUsuario');
      App.aviso(editando ? `Usuário "${salvo.login}" atualizado.` : `Usuário "${salvo.login}" criado.`);
      carregar();
    } catch (err) { App.erroNaJanela('janelaUsuario', err.message); }
  });

  $('#lista').addEventListener('click', async (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const u = usuarios.find((x) => x.id_usuario === Number(b.dataset.editar || b.dataset.excluir));
    if (b.dataset.editar) abrirForm(u);
    if (b.dataset.excluir) {
      const { ok } = await App.confirmar({ titulo: 'Excluir usuário?', texto: `"${u.nome}" perderá o acesso. Se já tiver vendas, será apenas inativado para manter o histórico.`, botao: 'Excluir', perigo: true });
      if (!ok) return;
      try {
        const r = await App.api(`/usuarios/${u.id_usuario}`, { method: 'DELETE' });
        App.aviso(r.mensagem, r.acao === 'inativado' ? 'alerta' : 'ok');
        carregar();
      } catch (err) { App.aviso(err.message, 'erro'); }
    }
  });

  $('#btnNovo').addEventListener('click', () => abrirForm(null));
  $('#filtros').addEventListener('submit', (ev) => { ev.preventDefault(); carregar(); });
  carregar();
})();
