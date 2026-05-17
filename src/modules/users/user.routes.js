/**
 * StockDock - User Routes
 *
 * Permissões:
 *   Gestão de usuários  → apenas ADMIN
 *   Alterar própria senha → qualquer usuário autenticado
 */

const express          = require('express');
const controller       = require('./user.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize }    = require('../../middleware/role.middleware');
const asyncHandler     = require('../../utils/asyncHandler');

const router = express.Router();

// Todas as rotas exigem autenticação
router.use(authenticate);

// ---------------------------------------------------
// Rotas acessíveis por QUALQUER usuário logado
// ---------------------------------------------------

// PATCH /api/v1/users/me/senha
// Deve vir antes de /:id para não conflitar
router.patch(
    '/me/senha',
    asyncHandler(controller.alterarSenha)
);

// ---------------------------------------------------
// Rotas exclusivas do ADMIN
// ---------------------------------------------------

// GET /api/v1/users/stats
router.get(
    '/stats',
    authorize('ADMIN'),
    asyncHandler(controller.stats)
);

// GET /api/v1/users
router.get(
    '/',
    authorize('ADMIN'),
    asyncHandler(controller.listar)
);

// GET /api/v1/users/:id
router.get(
    '/:id',
    authorize('ADMIN'),
    asyncHandler(controller.buscarPorId)
);

// POST /api/v1/users
router.post(
    '/',
    authorize('ADMIN'),
    asyncHandler(controller.criar)
);

// PUT /api/v1/users/:id
router.put(
    '/:id',
    authorize('ADMIN'),
    asyncHandler(controller.editar)
);

// DELETE /api/v1/users/:id  (soft delete)
router.delete(
    '/:id',
    authorize('ADMIN'),
    asyncHandler(controller.excluir)
);

// PATCH /api/v1/users/:id/reativar
router.patch(
    '/:id/reativar',
    authorize('ADMIN'),
    asyncHandler(controller.reativar)
);

module.exports = router;