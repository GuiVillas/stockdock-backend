const express          = require('express');
const controller       = require('./loja.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize }    = require('../../middleware/role.middleware');
const asyncHandler     = require('../../utils/asyncHandler');

const router = express.Router();
router.use(authenticate);

// Qualquer usuário logado pode listar lojas (para o select box)
router.get('/',    asyncHandler(controller.listar));

// Apenas ADMIN gerencia lojas
router.post('/',   authorize('ADMIN'), asyncHandler(controller.criar));
router.put('/:id', authorize('ADMIN'), asyncHandler(controller.editar));

module.exports = router;