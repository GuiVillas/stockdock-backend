/**
 * StockDock - Log Routes
 *
 * Todos os endpoints de logs são:
 *   - Protegidos por JWT (authenticate)
 *   - Exclusivos para ADMIN (authorize)
 *   - Somente leitura (apenas GET)
 */

const express          = require('express');
const controller       = require('./log.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize }    = require('../../middleware/role.middleware');
const asyncHandler     = require('../../utils/asyncHandler');

const router = express.Router();

// Todas as rotas exigem autenticação + cargo ADMIN
router.use(authenticate);
router.use(authorize('ADMIN'));

// ---------------------------------------------------
// ATENÇÃO: rotas específicas SEMPRE antes de /:id
// para evitar conflito de parâmetros
// ---------------------------------------------------

// GET /api/v1/logs/stats
router.get('/stats',    asyncHandler(controller.stats));

// GET /api/v1/logs/recentes?limite=10
router.get('/recentes', asyncHandler(controller.recentes));

// GET /api/v1/logs/usuario/:id
router.get('/usuario/:id', asyncHandler(controller.resumoUsuario));

// GET /api/v1/logs
router.get('/', asyncHandler(controller.listar));

// GET /api/v1/logs/:id
router.get('/:id', asyncHandler(controller.buscarPorId));

module.exports = router;