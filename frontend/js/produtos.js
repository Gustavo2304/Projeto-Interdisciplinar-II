// Tela de produtos: conversa com a API /api/produtos usando fetch.
const API = '/api/produtos';
const $ = (sel) => document.querySelector(sel);
const moeda = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let editandoId = null;
let excluindoId = null;
let destacarId = null;

// aceita "1.234,56" (formato brasileiro) e "1234.56"
const decimal = (v) => (v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v).trim();

async function api(url, opcoes = {}) {
  const resp = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opcoes });
  const corpo = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(corpo.erro || `Erro ${resp.status}`);
  return corpo;
}

function avisar(texto, falha = false) {
  const el = $('#aviso');
  el.textContent = texto;
  el.className = 'aviso' + (falha ? ' falha' : '');
  el.hidden = false;
}

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function carregar() {
  const params = new URLSearchParams();
  const busca = $('#busca').value.trim();
  if (busca) params.set('busca', busca);
  if ($('#inativos').checked) params.set('inativos', 'true');
  try {
    const produtos = await api(`${API}?${params}`);
    $('#lista').innerHTML = produtos.map((p) => `
      <tr class="${p.ativo ? '' : 'inativo'} ${p.id_produto === destacarId ? 'novo' : ''}">
        <td>${escapar(p.codigo)}</td>
        <td>${escapar(p.nome)}</td>
        <td>${escapar(p.categoria)}</td>
        <td class="num">${moeda(p.preco_venda)}</td>
        <td class="num">${p.quantidade_estoque}${p.ativo && p.quantidade_estoque <= p.estoque_minimo ? '<span class="selo baixo">baixo</span>' : ''}</td>
        <td><span class="selo ${p.ativo ? 'ok' : 'off'}">${p.ativo ? 'Ativo' : 'Inativo'}</span></td>
        <td class="acoes">
          <button class="btn mini" data-editar="${p.id_produto}">Editar</button>
          <button class="btn mini" data-excluir="${p.id_produto}" data-nome="${escapar(p.nome)}">Excluir</button>
        </td>
      </tr>`).join('');
    $('#total').textContent = `${produtos.length} produto(s) encontrado(s).`;
  } catch (e) {
    avisar('Não foi possível carregar os produtos: ' + e.message, true);
  }
}

async function carregarCategorias() {
  const cats = await api('/api/categorias');
  $('#formProduto [name=id_categoria]').innerHTML =
    '<option value="">Selecione...</option>' + cats.map((c) => `<option value="${c.id_categoria}">${escapar(c.nome)}</option>`).join('');
}

function abrirJanela(produto) {
  const f = $('#formProduto');
  f.reset();
  $('#erroForm').hidden = true;
  editandoId = produto ? produto.id_produto : null;
  $('#tituloJanela').textContent = produto ? `Editar produto #${produto.id_produto}` : 'Novo produto';
  if (produto) {
    for (const campo of ['codigo', 'nome', 'id_categoria', 'quantidade_estoque', 'estoque_minimo']) f[campo].value = produto[campo];
    f.preco_custo.value = moeda(produto.preco_custo);
    f.preco_venda.value = moeda(produto.preco_venda);
    f.ativo.checked = produto.ativo;
  }
  $('#janela').hidden = false;
  f.codigo.focus();
}

$('#formProduto').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  const dados = {
    codigo: f.codigo.value, nome: f.nome.value, id_categoria: f.id_categoria.value,
    preco_custo: decimal(f.preco_custo.value), preco_venda: decimal(f.preco_venda.value),
    quantidade_estoque: f.quantidade_estoque.value, estoque_minimo: f.estoque_minimo.value,
    ativo: f.ativo.checked,
  };
  try {
    const salvo = editandoId
      ? await api(`${API}/${editandoId}`, { method: 'PUT', body: JSON.stringify(dados) })
      : await api(API, { method: 'POST', body: JSON.stringify(dados) });
    $('#janela').hidden = true;
    destacarId = salvo.id_produto;
    avisar(editandoId ? `Produto "${salvo.nome}" atualizado.` : `Produto "${salvo.nome}" cadastrado com o id ${salvo.id_produto}.`);
    carregar();
  } catch (e) {
    $('#erroForm').textContent = e.message;
    $('#erroForm').hidden = false;
  }
});

$('#lista').addEventListener('click', async (ev) => {
  const editar = ev.target.dataset.editar;
  const excluir = ev.target.dataset.excluir;
  if (editar) abrirJanela(await api(`${API}/${editar}`));
  if (excluir) {
    excluindoId = excluir;
    $('#textoConfirma').textContent = `"${ev.target.dataset.nome}" será excluído. Se o produto já tiver vendas, ele será apenas inativado (RN05).`;
    $('#confirma').hidden = false;
  }
});

$('#btnConfirmaExcluir').addEventListener('click', async () => {
  $('#confirma').hidden = true;
  try {
    const r = await api(`${API}/${excluindoId}`, { method: 'DELETE' });
    destacarId = null;
    avisar(r.mensagem);
    carregar();
  } catch (e) {
    avisar(e.message, true);
  }
});

document.querySelectorAll('[data-fechar]').forEach((b) =>
  b.addEventListener('click', () => { $('#janela').hidden = true; $('#confirma').hidden = true; }));
$('#btnNovo').addEventListener('click', () => abrirJanela(null));
$('#formBusca').addEventListener('submit', (ev) => { ev.preventDefault(); carregar(); });
$('#inativos').addEventListener('change', carregar);

carregarCategorias().then(carregar);
