const express = require('express');
const ctrl = require('../controllers/produtoController');

const router = express.Router();
router.get('/', ctrl.listar);          // listar e buscar   (Read)
router.get('/:id', ctrl.buscar);       // um produto         (Read)
router.post('/', ctrl.criar);          // cadastrar          (Create)
router.put('/:id', ctrl.atualizar);    // editar             (Update)
router.delete('/:id', ctrl.excluir);   // excluir/inativar   (Delete)

module.exports = router;
