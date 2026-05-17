/**
 * StockDock - Middleware de tratamento de erros global
 * 
 * Centraliza TODOS os erros da aplicação.
 * Deve ser registrado APÓS todas as rotas no app.js.
 */

const logger = require('../utils/logger');

// ---------------------------------------------------
// 404 - Rota não encontrada
// ---------------------------------------------------
function notFoundHandler(req, res, next) {
    res.status(404).json({
        success:   false,
        message:   `Rota não encontrada: ${req.method} ${req.originalUrl}`,
        code:      'NOT_FOUND',
        timestamp: new Date().toISOString(),
    });
}

// ---------------------------------------------------
// Handler global de erros (4 parâmetros = obrigatório no Express)
// ---------------------------------------------------
function errorHandler(err, req, res, next) {
    // Log detalhado do erro interno
    logger.error(`❌ ${err.message}`, {
        url:    req.originalUrl,
        method: req.method,
        body:   req.body,
        user:   req.user?.id || 'não autenticado',
        stack:  err.stack,
    });

    // ---------------------------------------------------
    // Erros do PostgreSQL
    // ---------------------------------------------------
    if (err.code) {
        switch (err.code) {
            // Violação de unique constraint (ex: email duplicado)
            case '23505':
                return res.status(409).json({
                    success:   false,
                    message:   'Registro já existe. Verifique os dados e tente novamente.',
                    code:      'DUPLICATE_ENTRY',
                    timestamp: new Date().toISOString(),
                });

            // Violação de foreign key (ex: deletar usuário com pallets)
            case '23503':
                return res.status(409).json({
                    success:   false,
                    message:   'Operação não permitida. Registro está vinculado a outros dados.',
                    code:      'FOREIGN_KEY_VIOLATION',
                    timestamp: new Date().toISOString(),
                });

            // Violação de not null
            case '23502':
                return res.status(400).json({
                    success:   false,
                    message:   'Campo obrigatório não informado.',
                    code:      'NOT_NULL_VIOLATION',
                    timestamp: new Date().toISOString(),
                });
        }
    }

    // ---------------------------------------------------
    // Erros de JWT (gerados no auth.middleware)
    // ---------------------------------------------------
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success:   false,
            message:   'Token inválido.',
            code:      'INVALID_TOKEN',
            timestamp: new Date().toISOString(),
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success:   false,
            message:   'Token expirado. Faça login novamente.',
            code:      'TOKEN_EXPIRED',
            timestamp: new Date().toISOString(),
        });
    }

    // ---------------------------------------------------
    // Erros customizados da aplicação (ex: AppError)
    // ---------------------------------------------------
    if (err.isOperational) {
        return res.status(err.statusCode || 400).json({
            success:   false,
            message:   err.message,
            code:      err.code || 'APP_ERROR',
            timestamp: new Date().toISOString(),
        });
    }

    // ---------------------------------------------------
    // Erro genérico — nunca expor detalhes em produção
    // ---------------------------------------------------
    const isDev = process.env.NODE_ENV !== 'production';

    res.status(500).json({
        success:   false,
        message:   'Erro interno do servidor.',
        code:      'INTERNAL_SERVER_ERROR',
        ...(isDev && { debug: err.message, stack: err.stack }),
        timestamp: new Date().toISOString(),
    });
}

// ---------------------------------------------------
// Classe AppError para erros operacionais controlados
// Permite lançar erros com status HTTP específico
// ---------------------------------------------------
class AppError extends Error {
    constructor(message, statusCode = 400, code = 'APP_ERROR') {
        super(message);
        this.statusCode  = statusCode;
        this.code        = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = { notFoundHandler, errorHandler, AppError };