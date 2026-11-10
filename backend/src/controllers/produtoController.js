const service = require('../services/produtoService');
const { tratar } = require('../middlewares/erros');

module.exports = {
  listar: tratar(async (req, res) => res.json(await service.listar(req.query))),
  buscar: tratar(async (req, res) => res.json(await service.buscar(req.params.id))),
  criar: tratar(async (req, res) => res.status(201).json(await service.criar(req.body))),
  atualizar: tratar(async (req, res) => res.json(await service.atualizar(req.params.id, req.body))),
  repor: tratar(async (req, res) => res.json(await service.repor(req.params.id, req.body))),
  excluir: tratar(async (req, res) => res.json(await service.excluir(req.params.id))),
};
