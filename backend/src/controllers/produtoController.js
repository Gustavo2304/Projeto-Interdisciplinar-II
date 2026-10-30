// Controller: traduz HTTP <-> service. Não contém regra de negócio nem SQL.
const service = require('../services/produtoService');

// repassa erros de funções assíncronas para o middleware de erros
const tratar = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = {
  listar: tratar(async (req, res) => {
    const produtos = await service.listar({
      busca: req.query.busca ? String(req.query.busca).trim() : null,
      incluirInativos: req.query.inativos === 'true',
    });
    res.json(produtos);
  }),
  buscar: tratar(async (req, res) => res.json(await service.buscar(req.params.id))),
  criar: tratar(async (req, res) => res.status(201).json(await service.criar(req.body))),
  atualizar: tratar(async (req, res) => res.json(await service.atualizar(req.params.id, req.body))),
  excluir: tratar(async (req, res) => res.json(await service.excluir(req.params.id))),
};
