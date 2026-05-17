/**
 * StockDock - Log Controller
 *
 * Responsabilidade: receber requisição HTTP,
 * chamar o service e devolver resposta padronizada.
 *
 * Logs são SOMENTE LEITURA via API.
 * Não existe POST, PUT ou DELETE neste controller.
 */

const logService = require('./log.service');
const { listLogsSchema, validate } = require('./log.validator');
const { success, error, paginated } = require('../../utils/response');

// ---------------------------------------------------
// GET /api/v1/logs
// Lista logs com filtros e paginação
// ---------------------------------------------------
async function listar(req, res, next) {
    try {
        const { error: validationError, value } = validate(
            listLogsSchema,
            req.query
        );

        if (validationError) {
            const erros = validationError.details.map(d => d.message);
            return error(res, 'Parâmetros inválidos.', 422, 'VALIDATION_ERROR', erros);
        }

        const resultado = await logService.listarLogs(value);

        return paginated(
            res,
            resultado.logs,
            resultado.pagination,
            'Logs carregados com sucesso.'
        );
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// GET /api/v1/logs/stats
// Estatísticas gerais de auditoria
// ---------------------------------------------------
async function stats(req, res, next) {
    try {
        const dados = await logService.estatisticasLogs();
        return success(res, dados, 'Estatísticas de logs carregadas.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// GET /api/v1/logs/recentes
// Últimos logs do sistema (widget do dashboard)
// ---------------------------------------------------
async function recentes(req, res, next) {
    try {
        // Permite customizar o limite via query param
        const limite = Math.min(
            parseInt(req.query.limite) || 10,
            50 // máximo de 50 para este endpoint
        );

        const logs = await logService.logsRecentes(limite);
        return success(res, logs, 'Logs recentes carregados.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// GET /api/v1/logs/:id
// Detalhe completo de um log (com snapshots)
// ---------------------------------------------------
async function buscarPorId(req, res, next) {
    try {
        const id = parseInt(req.params.id);

        if (!id || id <= 0) {
            return error(res, 'ID inválido.', 400, 'INVALID_ID');
        }

        const log = await logService.buscarLogPorId(id);
        return success(res, log, 'Log encontrado.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// GET /api/v1/logs/usuario/:id
// Resumo de atividade de um usuário específico
// ---------------------------------------------------
async function resumoUsuario(req, res, next) {
    try {
        const id = parseInt(req.params.id);

        if (!id || id <= 0) {
            return error(res, 'ID inválido.', 400, 'INVALID_ID');
        }

        const resumo = await logService.resumoUsuario(id);
        return success(res, resumo, 'Resumo do usuário carregado.');
    } catch (err) {
        next(err);
    }
}

module.exports = { listar, stats, recentes, buscarPorId, resumoUsuario };