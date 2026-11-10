// Testes automáticos da API (node:test, nativo do Node — sem dependências).
// Pré-requisito: servidor rodando (npm start) com os dados de teste do banco (banco/script_carga.sql).
// Executar: npm test      (ou API_URL=http://localhost:3000 node --test tests/api.test.js)
const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = (process.env.API_URL || 'http://localhost:3000') + '/api';
const SENHA = 'Hermes@2026';

async function entrar(login) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login, senha: SENHA }),
  });
  assert.equal(r.status, 200, `login de ${login}`);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  return async (metodo, url, corpo) => {
    const resp = await fetch(BASE + url, {
      method: metodo, headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const tipo = resp.headers.get('content-type') || '';
    return { status: resp.status, dados: tipo.includes('json') ? await resp.json() : await resp.text(), tipo };
  };
}

let adm; let ger; let atd;
const unico = Date.now().toString().slice(-6);

before(async () => {
  adm = await entrar('helena.adm');
  ger = await entrar('rafael.gerente');
  atd = await entrar('bianca.caixa');
});

describe('Autenticação e perfis (RF04, RN04)', () => {
  test('senha errada é recusada sem revelar qual campo errou', async () => {
    const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'diego.caixa', senha: 'errada' }) });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).erro, 'Usuário ou senha inválidos.');
  });
  test('usuário inativo não entra', async () => {
    const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'otavio.caixa', senha: SENHA }) });
    assert.equal(r.status, 403);
  });
  test('sem sessão não acessa a API', async () => {
    assert.equal((await fetch(`${BASE}/produtos`)).status, 401);
  });
  test('atendente não cadastra produto e gerente não registra venda', async () => {
    assert.equal((await atd('POST', '/produtos', {})).status, 403);
    assert.equal((await ger('POST', '/vendas', {})).status, 403);
    assert.equal((await atd('GET', '/relatorios/vendas')).status, 403);
    assert.equal((await ger('GET', '/usuarios')).status, 403);
  });
});

describe('Venda e cancelamento (UC05, UC09)', () => {
  const pix = (valor) => ({ id_forma_pagamento: 4, valor });

  test('RN01: pagamentos diferentes do total são recusados', async () => {
    const r = await atd('POST', '/vendas', { itens: [{ id_produto: 1, quantidade: 1 }], pagamentos: [pix('10.00')] });
    assert.equal(r.status, 400);
    assert.match(r.dados.erro, /RN01/);
  });

  test('RN02: não vende acima do estoque', async () => {
    const p = (await atd('GET', '/produtos/24')).dados;
    const r = await atd('POST', '/vendas', { itens: [{ id_produto: 24, quantidade: p.quantidade_estoque + 1 }], pagamentos: [pix('1.00')] });
    assert.equal(r.status, 409);
    assert.match(r.dados.erro, /Estoque insuficiente/);
  });

  test('venda com pagamento dividido e troco; baixa e reposição de estoque', async () => {
    const antes = (await atd('GET', '/produtos/7')).dados.quantidade_estoque;     // refrigerante 9,99
    const venda = await atd('POST', '/vendas', {
      itens: [{ id_produto: 7, quantidade: 2 }], desconto: '0,98',                 // 19,98 - 0,98 = 19,00
      pagamentos: [{ id_forma_pagamento: 1, valor: '10,00', valor_recebido: '20,00' }, pix('9.00')],
    });
    assert.equal(venda.status, 201, JSON.stringify(venda.dados));
    const id = venda.dados.id_venda;
    const comp = (await atd('GET', `/vendas/${id}`)).dados;
    assert.equal(comp.valor_total, '19.00');
    assert.equal(comp.pagamentos[0].troco, '10.00');                             // RN09
    assert.equal((await atd('GET', '/produtos/7')).dados.quantidade_estoque, antes - 2);   // RF09

    assert.equal((await atd('POST', `/vendas/${id}/cancelar`, { motivo: '' })).status, 400);   // RN08
    const canc = await atd('POST', `/vendas/${id}/cancelar`, { motivo: 'Teste automatizado' });
    assert.equal(canc.status, 200);
    assert.equal(canc.dados.venda.status, 'CANCELADA');
    assert.equal((await atd('GET', '/produtos/7')).dados.quantidade_estoque, antes);       // RN03
    assert.equal((await atd('POST', `/vendas/${id}/cancelar`, { motivo: 'De novo, não pode' })).status, 409);
  });

  test('RN07: venda que leva o produto ao mínimo gera alerta', async () => {
    const criado = await adm('POST', '/produtos', { codigo: `T${unico}`, nome: `Produto teste ${unico}`, id_categoria: 1, preco_venda: '2,00', quantidade_estoque: 5, estoque_minimo: 3 });
    assert.equal(criado.status, 201);
    const id = criado.dados.id_produto;
    const venda = await atd('POST', '/vendas', { itens: [{ id_produto: id, quantidade: 2 }], pagamentos: [pix('4.00')] });
    assert.equal(venda.status, 201);
    assert.deepEqual(venda.dados.alertas, [`Produto teste ${unico}`]);
    assert.ok((await atd('GET', '/alertas')).dados.some((a) => a.id_produto === id));
    await adm('PATCH', `/produtos/${id}/estoque`, { quantidade: 10 });                    // reposição encerra o alerta
    assert.ok(!(await atd('GET', '/alertas')).dados.some((a) => a.id_produto === id));
    const ex = await adm('DELETE', `/produtos/${id}`);                                     // RN05: tem venda → inativa
    assert.equal(ex.dados.acao, 'inativado');
  });
});

describe('Cadastros (CRUD) com validação', () => {
  test('produto: criar, editar, excluir; código duplicado é recusado', async () => {
    const dados = { codigo: `P${unico}`, nome: 'Produto CRUD', id_categoria: 2, preco_venda: '3,50', quantidade_estoque: 10, estoque_minimo: 2 };
    const c = await adm('POST', '/produtos', dados);
    assert.equal(c.status, 201);
    assert.equal((await adm('POST', '/produtos', dados)).status, 409);
    assert.equal((await adm('POST', '/produtos', { ...dados, codigo: `Q${unico}`, preco_venda: '0' })).status, 400);
    const e = await adm('PUT', `/produtos/${c.dados.id_produto}`, { ...dados, nome: 'Produto CRUD editado' });
    assert.equal(e.dados.nome, 'Produto CRUD editado');
    assert.equal((await adm('DELETE', `/produtos/${c.dados.id_produto}`)).dados.acao, 'excluido');
  });

  test('cliente: CPF inválido, CPF duplicado (RN06), criar, editar e excluir', async () => {
    assert.equal((await adm('POST', '/clientes', { nome: 'Fulano', cpf_cnpj: '12345678900' })).status, 400);
    const existente = (await adm('GET', '/clientes/1')).dados.cpf_cnpj;
    assert.equal((await adm('POST', '/clientes', { nome: 'Fulano', cpf_cnpj: existente })).status, 409);
    const c = await adm('POST', '/clientes', { nome: 'Cliente de teste', cpf_cnpj: '529.982.247-25', email: 'teste@example.com', telefone: '(11) 98888-7777' });
    assert.equal(c.status, 201, JSON.stringify(c.dados));
    assert.equal(c.dados.telefone, '11988887777');
    assert.equal((await adm('PUT', `/clientes/${c.dados.id_cliente}`, { ...c.dados, nome: 'Cliente editado' })).dados.nome, 'Cliente editado');
    assert.equal((await adm('DELETE', `/clientes/${c.dados.id_cliente}`)).status, 200);
    assert.equal((await adm('DELETE', '/clientes/1')).status, 409);       // tem vendas: não exclui
  });

  test('usuário: senha fraca recusada; criar, entrar, excluir', async () => {
    const base = { nome: 'Usuário de teste', login: `teste${unico}`, perfil: 'ATENDENTE' };
    assert.equal((await adm('POST', '/usuarios', { ...base, senha: '1234' })).status, 400);
    const u = await adm('POST', '/usuarios', { ...base, senha: 'Teste1234' });
    assert.equal(u.status, 201);
    const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: base.login, senha: 'Teste1234' }) });
    assert.equal(r.status, 200);
    assert.equal((await adm('DELETE', `/usuarios/${u.dados.id_usuario}`)).dados.acao, 'excluido');
    assert.equal((await adm('DELETE', '/usuarios/1')).status, 400);       // ninguém exclui a si mesmo
  });
});

describe('Consultas, relatório e integração', () => {
  test('filtro de vendas por período e status', async () => {
    const r = await atd('GET', '/vendas?inicio=2026-10-01&fim=2026-10-31&status=CANCELADA');
    assert.equal(r.status, 200);
    assert.ok(r.dados.length >= 2 && r.dados.every((v) => v.status === 'CANCELADA'));
  });
  test('relatório com totalizadores e exportação CSV', async () => {
    const r = await ger('GET', '/relatorios/vendas?inicio=2026-10-01&fim=2026-10-31');
    assert.equal(r.dados.totais.qtd_vendas, 82);
    const csv = await ger('GET', '/relatorios/vendas.csv?inicio=2026-10-01&fim=2026-10-31');
    assert.match(csv.tipo, /text\/csv/);
    assert.match(csv.dados, /Faturamento líquido \(R\$\);3\.811,82|Faturamento líquido \(R\$\);3811,82/);
  });
  test('dashboard traz os indicadores da Aula 3', async () => {
    const d = (await ger('GET', '/dashboard?inicio=2026-10-01&fim=2026-10-31')).dados;
    for (const k of ['tempo_medio_seg', 'pct_alertas_resolvidos', 'reposicao_media_horas', 'ticket_medio']) assert.ok(k in d.indicadores, k);
  });
  test('API de integração devolve vendas com itens e pagamentos', async () => {
    const r = (await adm('GET', '/integracao/vendas?inicio=2026-10-01&fim=2026-10-01')).dados;
    assert.equal(r.sistema, 'HermesPDV');
    assert.equal(r.quantidade, r.vendas.length);
    assert.ok(r.vendas[0].itens.length > 0 && r.vendas[0].pagamentos.length > 0);
  });
});
