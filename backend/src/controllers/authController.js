const service = require('../services/authService');
const { gravarSessao, apagarSessao } = require('../middlewares/auth');
const { tratar } = require('../middlewares/erros');

module.exports = {
  login: tratar(async (req, res) => {
    const usuario = await service.login(req.body.login, req.body.senha);
    gravarSessao(res, usuario);
    res.json({ usuario });
  }),
  logout: (req, res) => { apagarSessao(res); res.json({ mensagem: 'Sessão encerrada.' }); },
  sessao: (req, res) => res.json({ usuario: req.usuario }),
};
