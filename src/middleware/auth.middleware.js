/**
 * StockDock - Middleware de Autenticação JWT
 * 
 * Valida o token Bearer em todas as rotas protegidas.
 * Injeta req.user com os dados do usuário autenticado.
 */

const { verifyAccessToken } = require('../config/jwt');
const { AppError }          = require('./error.middleware');

function authenticate(req, res, next) {
    try {
        // ---------------------------------------------------
        // Extrai o token do header Authorization
        // Formato esperado: "Bearer eyJhbGciOiJIUzI1..."
        // ---------------------------------------------------
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError(
                'Token de autenticação não fornecido.',
                401,
                'MISSING_TOKEN'
            );
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            throw new AppError(
                'Token de autenticação malformado.',
                401,
                'MALFORMED_TOKEN'
            );
        }

        // ---------------------------------------------------
        // Verifica e decodifica o token
        // ---------------------------------------------------
        const decoded = verifyAccessToken(token);

        if (!decoded) {
            throw new AppError(
                'Token inválido ou expirado. Faça login novamente.',
                401,
                'INVALID_TOKEN'
            );
        }

        // Garante que é um access token (não refresh)
        if (decoded.type !== 'access') {
            throw new AppError(
                'Tipo de token inválido.',
                401,
                'WRONG_TOKEN_TYPE'
            );
        }

        // ---------------------------------------------------
        // Injeta dados do usuário na requisição
        // Disponível em todos os controllers como req.user
        // ---------------------------------------------------
        req.user = {
            id:    decoded.sub,
            email: decoded.email,
            cargo: decoded.cargo,
            nome:  decoded.nome,
        };

        next();

    } catch (error) {
        next(error);
    }
}

module.exports = { authenticate };