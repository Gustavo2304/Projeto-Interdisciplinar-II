const express = require('express');
const repo = require('../repositories/categoriaRepository');

const router = express.Router();
router.get('/', (req, res, next) => repo.listar().then((r) => res.json(r)).catch(next));

module.exports = router;
