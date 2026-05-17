/**
 * StockDock - Auth Controller
 * 
 * Responsabilidade: Receber a requisição HTTP,
 * chamar o service correto e devolver a resposta.
 * Não contém regras de negócio.
 */

const authService              = require('./auth.service');
const { loginSchema, refreshSchema, validate } = require('./auth.validator');
const { success, error }       = require('../../utils/response');
const { AppError }             = require('../../middleware/error.middleware');

// ---------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------
async function login(req, res, next) {
    try {
        // 1. Valida os dados de entrada
        const { error: validationError, value } = validate(loginSchema, req.body);

        if (validationError) {
            const erros = validationError.details.map(d => d.message);
            return error(res, 'Dados inválidos.', 422, 'VALIDATION_ERROR', erros);
        }

        // 2. Pega o IP real do cliente
        // (considera proxy reverso / load balancer)
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]
                       || req.socket?.remoteAddress
                       || 'desconhecido';

        // 3. Chama o service
        const result = await authService.login(value.email, value.senha, ipAddress);

        // 4. Retorna resposta de sucesso
        return success(res, result, 'Login realizado com sucesso.');

    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// POST /api/v1/auth/logout
// Requer: authenticate middleware
// ---------------------------------------------------
async function logout(req, res, next) {
    try {
        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]
                       || req.socket?.remoteAddress
                       || 'desconhecido';

        // req.user é injetado pelo middleware authenticate
        const result = await authService.logout(req.user.id, ipAddress);

        return success(res, null, result.message);

    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// POST /api/v1/auth/refresh
// Renova o access token usando o refresh token
// ---------------------------------------------------
async function refresh(req, res, next) {
    try {
        const { error: validationError, value } = validate(refreshSchema, req.body);

        if (validationError) {
            const erros = validationError.details.map(d => d.message);
            return error(res, 'Dados inválidos.', 422, 'VALIDATION_ERROR', erros);
        }

        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]
                       || req.socket?.remoteAddress
                       || 'desconhecido';

        const result = await authService.refreshToken(value.refresh_token, ipAddress);

        return success(res, result, 'Token renovado com sucesso.');

    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// GET /api/v1/auth/me
// Retorna dados do usuário autenticado
// Requer: authenticate middleware
// ---------------------------------------------------
async function me(req, res, next) {
    try {
        const user = await authService.getMe(req.user.id);
        return success(res, user, 'Dados do usuário carregados.');
    } catch (err) {
        next(err);
    }
}

module.exports = { login, logout, refresh, me };