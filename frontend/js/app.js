// Funções comuns a todas as telas: chamadas à API, sessão, menu por perfil, avisos e formatação.
const App = (() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const TODOS = ['ADMINISTRADOR', 'GERENTE', 'ATENDENTE'];
  const MENU = [
    { href: 'painel.html', texto: 'Painel', perfis: TODOS },
    { href: 'pdv.html', texto: 'Nova venda', perfis: ['ATENDENTE'] },
    { href: 'vendas.html', texto: 'Vendas', perfis: TODOS },
    { href: 'produtos.html', texto: 'Produtos', perfis: TODOS },
    { href: 'clientes.html', texto: 'Clientes', perfis: TODOS },
    { href: 'relatorios.html', texto: 'Relatórios', perfis: ['GERENTE', 'ADMINISTRADOR'] },
    { href: 'usuarios.html', texto: 'Usuários', perfis: ['ADMINISTRADOR'] },
  ];
  const NOME_PERFIL = { ADMINISTRADOR: 'Administrador', GERENTE: 'Gerente', ATENDENTE: 'Atendente' };
  let usuario = null;

  // ---------- API ----------
  async function api(url, opcoes = {}) {
    const cfg = { credentials: 'same-origin', ...opcoes, headers: { 'Content-Type': 'application/json' } };
    if (cfg.body && typeof cfg.body !== 'string') cfg.body = JSON.stringify(cfg.body);
    let resp;
    try {
      resp = await fetch('/api' + url, cfg);
    } catch {
      throw new Error('Sem conexão com o servidor. Verifique se o sistema está rodando.');
    }
    const dados = await resp.json().catch(() => ({}));
    if (resp.status === 401 && url !== '/auth/login') {
      location.href = '/pages/login.html?expirou=1';
      throw new Error(dados.erro || 'Sessão expirada.');
    }
    if (!resp.ok) throw new Error(dados.erro || `Erro ${resp.status}`);
    return dados;
  }

  // ---------- sessão e menu ----------
  async function iniciar(perfisPermitidos) {
    try {
      usuario = (await api('/auth/sessao')).usuario;
    } catch {
      return new Promise(() => {}); // redirecionando para o login
    }
    if (perfisPermitidos && !perfisPermitidos.includes(usuario.perfil)) {
      location.href = 'painel.html?negado=1';
      return new Promise(() => {});
    }
    montarMenu();
    if (new URLSearchParams(location.search).get('negado')) aviso('Seu perfil não tem acesso àquela tela.', 'erro');
    return usuario;
  }

  function montarMenu() {
    const menu = $('#menu');
    if (!menu) return;
    const atual = location.pathname.split('/').pop();
    menu.innerHTML = `
      <div class="topo-menu">
        <div class="marca">Hermes<span>PDV</span></div>
        <button class="btn claro mini abrir-menu" type="button" aria-label="Abrir menu">☰ Menu</button>
      </div>
      <nav>${MENU.filter((m) => m.perfis.includes(usuario.perfil))
        .map((m) => `<a href="${m.href}" class="${m.href === atual ? 'ativo' : ''}">${m.texto}</a>`).join('')}</nav>
      <div class="quem">
        <strong>${escapar(usuario.nome)}</strong>${NOME_PERFIL[usuario.perfil]}
        <button class="btn claro mini" type="button" id="btnSair">Sair</button>
      </div>`;
    $('.abrir-menu', menu).addEventListener('click', () => menu.classList.toggle('aberto'));
    $('#btnSair').addEventListener('click', sair);
  }

  async function sair() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/pages/login.html';
  }

  const pode = (...perfis) => usuario && perfis.includes(usuario.perfil);

  // ---------- avisos ----------
  function aviso(texto, tipo = 'ok') {
    let caixa = $('#avisos');
    if (!caixa) { caixa = document.createElement('div'); caixa.id = 'avisos'; document.body.appendChild(caixa); }
    const el = document.createElement('div');
    el.className = `aviso ${tipo === 'ok' ? '' : tipo}`;
    el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
    el.textContent = texto;
    caixa.appendChild(el);
    setTimeout(() => el.remove(), tipo === 'erro' ? 7000 : 4500);
  }

  // ---------- janelas ----------
  function abrir(id) {
    const j = document.getElementById(id);
    j.hidden = false;
    const erro = j.querySelector('.erro-form');
    if (erro) erro.hidden = true;
    const campo = j.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
    if (campo) setTimeout(() => campo.focus(), 30);
  }
  const fechar = (id) => { document.getElementById(id).hidden = true; };
  function erroNaJanela(id, msg) {
    const el = document.getElementById(id).querySelector('.erro-form');
    el.textContent = msg;
    el.hidden = false;
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-fechar]');
    if (b) b.closest('.fundo').hidden = true;
    if (ev.target.classList.contains('fundo')) ev.target.hidden = true;
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') document.querySelectorAll('.fundo:not([hidden])').forEach((f) => { f.hidden = true; });
  });

  // Janela de confirmação genérica. Com "campo", pede um texto (ex.: motivo do cancelamento).
  function confirmar({ titulo, texto, botao = 'Confirmar', perigo = false, campo = null }) {
    return new Promise((resolver) => {
      const fundo = document.createElement('div');
      fundo.className = 'fundo';
      fundo.innerHTML = `
        <div class="janela pequena" role="dialog" aria-modal="true">
          <h2>${escapar(titulo)}</h2>
          <p>${escapar(texto)}</p>
          ${campo ? `<label>${escapar(campo)} *<textarea maxlength="200"></textarea></label>` : ''}
          <p class="erro-form" hidden></p>
          <div class="acoes">
            <button class="btn" type="button" data-r="nao">Voltar</button>
            <button class="btn ${perigo ? 'perigo' : 'primario'}" type="button" data-r="sim">${escapar(botao)}</button>
          </div>
        </div>`;
      document.body.appendChild(fundo);
      const area = fundo.querySelector('textarea');
      (area || fundo.querySelector('[data-r=sim]')).focus();
      const terminar = (ok) => { fundo.remove(); resolver({ ok, valor: area ? area.value.trim() : null }); };
      fundo.addEventListener('click', (ev) => {
        if (ev.target === fundo || ev.target.dataset.r === 'nao') terminar(false);
        if (ev.target.dataset.r === 'sim') {
          if (area && area.value.trim().length < 5) {
            const e = fundo.querySelector('.erro-form');
            e.textContent = `Informe o ${campo.toLowerCase()} (mínimo de 5 caracteres).`;
            e.hidden = false;
            return;
          }
          terminar(true);
        }
      });
    });
  }

  // ---------- formatação ----------
  const moeda = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const numero = (v, casas = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const data = (s) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}${s.length > 10 ? ' ' + s.slice(11, 16) : ''}` : '');
  const documento = (d) => {
    const s = String(d || '');
    if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return s;
  };
  const telefone = (t) => {
    const s = String(t || '');
    if (s.length === 11) return s.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    if (s.length === 10) return s.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    return s;
  };
  const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // aceita "1.234,56" (formato brasileiro) e "1234.56"
  const paraNumero = (v) => {
    const s = String(v ?? '').trim();
    if (!s) return NaN;
    return Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  };
  const centavos = (v) => Math.round(paraNumero(v) * 100);
  const diaISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const duracao = (seg) => (seg == null ? '—' : `${Math.floor(seg / 60)} min ${String(seg % 60).padStart(2, '0')} s`);

  // pequena memória por navegador (ex.: mensagens entre telas); falha em silêncio se bloqueada
  const guardar = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } };
  const retirar = (k) => {
    try { const v = sessionStorage.getItem(k); sessionStorage.removeItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
  };

  return {
    $, api, iniciar, pode, aviso, abrir, fechar, erroNaJanela, confirmar,
    moeda, numero, data, documento, telefone, escapar, paraNumero, centavos, diaISO, duracao, guardar, retirar,
    get usuario() { return usuario; },
  };
})();
