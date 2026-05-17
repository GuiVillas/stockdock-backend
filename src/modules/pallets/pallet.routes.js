/**
 * StockDock - Pallet Routes
 *
 * Todas as rotas exigem autenticação JWT.
 * Permissões por cargo:
 *   GET    → TODOS (ADMIN, OPERADOR, VISUALIZADOR)
 *   POST   → ADMIN, OPERADOR
 *   PUT    → ADMIN, OPERADOR
 *   DELETE → apenas ADMIN
 */

const express      = require('express');
const controller   = require('./pallet.controller');
const { authenticate }    = require('../../middleware/auth.middleware');
const { authorize }       = require('../../middleware/role.middleware');
const asyncHandler        = require('../../utils/asyncHandler');

const router = express.Router();

// Todas as rotas abaixo exigem JWT válido
router.use(authenticate);

// ---------------------------------------------------
// GET /api/v1/pallets/stats
// ATENÇÃO: deve vir ANTES de /:id para não
// confundir "stats" com um ID numérico
// ---------------------------------------------------
router.get(
    '/stats',
    asyncHandler(controller.stats)
);

// ---------------------------------------------------
// GET /api/v1/pallets
// Todos os cargos podem listar
// ---------------------------------------------------
router.get(
    '/',
    asyncHandler(controller.listar)
);

// ---------------------------------------------------
// GET /api/v1/pallets/:id
// Todos os cargos podem visualizar
// ---------------------------------------------------
router.get(
    '/:id',
    asyncHandler(controller.buscarPorId)
);

// ---------------------------------------------------
// POST /api/v1/pallets
// Apenas ADMIN e OPERADOR podem criar
// ---------------------------------------------------
router.post(
    '/',
    authorize('ADMIN', 'OPERADOR'),
    asyncHandler(controller.criar)
);

// ---------------------------------------------------
// PUT /api/v1/pallets/:id
// Apenas ADMIN e OPERADOR podem editar
// ---------------------------------------------------
router.put(
    '/:id',
    authorize('ADMIN', 'OPERADOR'),
    asyncHandler(controller.editar)
);

// ---------------------------------------------------
// DELETE /api/v1/pallets/:id
// Apenas ADMIN pode excluir
// ---------------------------------------------------
router.delete(
    '/:id',
    authorize('ADMIN'),
    asyncHandler(controller.excluir)
);

module.exports = router;