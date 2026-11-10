// Ponto de entrada do HermesPDV: API REST + telas (HTML, CSS e JS) servidas pelo mesmo servidor.
process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

const path = require('path');
const express = require('express');
const seguranca = require('./middlewares/seguranca');
const rotas = require('./routes');
const { tratarErros } = require('./middlewares/erros');

const app = express();
app.use(seguranca);
app.use(express.json({ limit: '100kb' }));

app.get('/', (req, res) => res.redirect('/pages/login.html'));
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use('/api', rotas);
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use(tratarErros);

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`HermesPDV rodando em http://localhost:${PORT}`));
