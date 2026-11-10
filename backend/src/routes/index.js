// Todas as rotas da API e quem pode usar cada uma (RN04).
// ATENDENTE: vendas e consultas | GERENTE: consultas e relatórios | ADMINISTRADOR: gerente + cadastros
const express = require('express');
const { autenticar, autorizar } = require('../middlewares/auth');
const { tratar } = require('../middlewares/erros');
const auth = require('../controllers/authController');
const produto = require('../controllers/produtoController');
const cliente = require('../controllers/clienteController');
const usuario = require('../controllers/usuarioController');
const venda = require('../controllers/vendaController');
const relatorio = require('../controllers/relatorioController');
const categorias = require('../repositories/categoriaRepository');
const formas = require('../repositories/formaPagamentoRepository');
const alertas = require('../repositories/alertaRepository');

const ADM = 'ADMINISTRADOR';
const GER = 'GERENTE';
const ATD = 'ATENDENTE';

const r = express.Router();

// públicas
r.post('/auth/login', auth.login);
r.post('/auth/logout', auth.logout);

// daqui para baixo, só com sessão válida
r.use(autenticar);
r.get('/auth/sessao', auth.sessao);

r.get('/produtos', produto.listar);
r.get('/produtos/:id', produto.buscar);
r.post('/produtos', autorizar(ADM), produto.criar);
r.put('/produtos/:id', autorizar(ADM), produto.atualizar);
r.patch('/produtos/:id/estoque', autorizar(ADM), produto.repor);
r.delete('/produtos/:id', autorizar(ADM), produto.excluir);

r.get('/categorias', tratar(async (req, res) => res.json(await categorias.listar())));
r.get('/formas-pagamento', tratar(async (req, res) => res.json(await formas.listarAtivas())));
r.get('/alertas', tratar(async (req, res) => res.json(await alertas.listarAbertos())));

r.get('/clientes', cliente.listar);
r.get('/clientes/:id', cliente.buscar);
r.post('/clientes', autorizar(ADM), cliente.criar);
r.put('/clientes/:id', autorizar(ADM), cliente.atualizar);
r.delete('/clientes/:id', autorizar(ADM), cliente.excluir);

r.get('/usuarios', autorizar(ADM), usuario.listar);
r.get('/usuarios/:id', autorizar(ADM), usuario.buscar);
r.post('/usuarios', autorizar(ADM), usuario.criar);
r.put('/usuarios/:id', autorizar(ADM), usuario.atualizar);
r.delete('/usuarios/:id', autorizar(ADM), usuario.excluir);

r.get('/vendas', venda.listar);
r.get('/vendas/:id', venda.buscar);
r.post('/vendas', autorizar(ATD), venda.registrar);
r.post('/vendas/:id/cancelar', autorizar(ATD), venda.cancelar);

r.get('/relatorios/vendas', autorizar(GER, ADM), relatorio.vendas);
r.get('/relatorios/vendas.csv', autorizar(GER, ADM), relatorio.vendasCsv);
r.get('/dashboard', autorizar(GER, ADM), relatorio.dashboard);

// API de integração: vendas concluídas com itens e pagamentos, em JSON
r.get('/integracao/vendas', autorizar(GER, ADM), relatorio.integracaoVendas);

module.exports = r;
