const service = require('../services/relatorioService');
const { tratar } = require('../middlewares/erros');

module.exports = {
  vendas: tratar(async (req, res) => res.json(await service.vendas(req.query))),
  vendasCsv: tratar(async (req, res) => {
    const arquivo = await service.vendasCsv(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${arquivo.nome}"`);
    res.send(arquivo.conteudo);
  }),
  dashboard: tratar(async (req, res) => res.json(await service.dashboard(req.query))),
  integracaoVendas: tratar(async (req, res) => res.json(await service.integracaoVendas(req.query))),
};
