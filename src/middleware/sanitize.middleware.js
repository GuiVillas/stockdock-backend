/**
 * StockDock - Middleware Global de Sanitização
 *
 * Aplicado em TODAS as requisições antes dos controllers.
 * Sanitiza req.body, req.query e req.params.
 *
 * Registrado no app.js após o express.json().
 */

const { sanitizeObject } = require('../utils/sanitizer');
const logger             = require('../utils/logger');

function sanitizeInputs(req, res, next) {
    try {
        // Sanitiza o body (POST, PUT, PATCH)
        if (req.body && typeof req.body === 'object') {
            req.body = sanitizeObject(req.body);
        }

        // Sanitiza query params (GET com filtros)
        if (req.query && typeof req.query === 'object') {
            req.query = sanitizeObject(req.query);
        }

        // Sanitiza parâmetros de rota (/:id, etc.)
        if (req.params && typeof req.params === 'object') {
            req.params = sanitizeObject(req.params);
        }

        next();

    } catch (error) {
        logger.error(`❌ Erro na sanitização: ${error.message}`);
        next(error);
    }
}

module.exports = { sanitizeInputs };