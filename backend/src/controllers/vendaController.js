const service = require('../services/vendaService');
const { tratar } = require('../middlewares/erros');

module.exports = {
  listar: tratar(async (req, res) => res.json(await service.listar(req.query))),
  buscar: tratar(async (req, res) => res.json(await service.buscar(req.params.id))),
  registrar: tratar(async (req, res) => res.status(201).json(await service.registrar(req.body, req.usuario))),
  cancelar: tratar(async (req, res) => res.json(await service.cancelar(req.params.id, req.body, req.usuario))),
};
