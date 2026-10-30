// Ponto de entrada da API do HermesPDV.
const path = require('path');
const express = require('express');
const produtoRoutes = require('./routes/produtoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const { tratarErros } = require('./middlewares/erros');

const app = express();
app.use(express.json());

// o front-end (HTML, CSS e JS) é servido pela própria API
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));
app.get('/', (req, res) => res.redirect('/pages/produtos.html'));

app.use('/api/produtos', produtoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use(tratarErros);

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`HermesPDV rodando em http://localhost:${PORT}`));
