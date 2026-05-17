/**
 * StockDock - Auth Routes
 * 
 * Define as rotas do módulo de autenticação.
 * Prefixo registrado no app.js: /api/v1/auth
 */

const express    = require('express');
const controller = require('./auth.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const asyncHandler     = require('../../utils/asyncHandler');

const router = express.Router();

// ---------------------------------------------------
// Rotas PÚBLICAS (sem autenticação)
// ---------------------------------------------------

// POST /api/v1/auth/login
router.post('/login', asyncHandler(controller.login));

// POST /api/v1/auth/refresh
router.post('/refresh', asyncHandler(controller.refresh));

// ---------------------------------------------------
// Rotas PROTEGIDAS (requerem JWT válido)
// ---------------------------------------------------

// POST /api/v1/auth/logout
router.post('/logout', authenticate, asyncHandler(controller.logout));

// GET /api/v1/auth/me
router.get('/me', authenticate, asyncHandler(controller.me));

module.exports = router;