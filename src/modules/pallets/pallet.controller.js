/**
 * StockDock - Pallet Controller
 *
 * Responsabilidade: receber requisição HTTP,
 * chamar o service e devolver resposta padronizada.
 */

const palletService = require('./pallet.service');
const {
    createPalletSchema,
    updatePalletSchema,
    listPalletsSchema,
    validate,
} = require('./pallet.validator');
const { success, created, error, paginated } = require('../../utils/response');

// ---------------------------------------------------
// GET /api/v1/pallets
// Lista pallets com filtros e paginação
// ---------------------------------------------------
async function listar(req, res, next) {
    try {
        // Valida os query params
        const { error: validationError, value } = validate(
            listPalletsSchema,
            req.query
        );

        if (validationError) {
            const erros = validationError.details.map(d => d.message);
            return error(res, 'Parâmetros inválidos.', 422, 'VALIDATION_ERROR', erros);
        }

        const resultado = await palletService.listarPallets(value, req.user);

        return paginated(
            res,
            resultado.pallets,
            resultado.pagination,
            'Pallets carregados com sucesso.'
        );
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// GET /api/v1/pallets/:id
// Busca pallet por ID
// ---------------------------------------------------
async function buscarPorId(req, res, next) {
    try {
        const id = parseInt(req.params.id);

        if (!id || id <= 0) {
            return error(res, 'ID inválido.', 400, 'INVALID_ID');
        }

        const pallet = await palletService.buscarPalletPorId(id);
        return success(res, pallet, 'Pallet encontrado.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// POST /api/v1/pallets
// Cria novo pallet
// ---------------------------------------------------
async function criar(req, res, next) {
    try {
        const { error: validationError, value } = validate(
            createPalletSchema,
            req.body
        );

        if (validationError) {
            const erros = validationError.details.map(d => d.message);
            return error(res, 'Dados inválidos.', 422, 'VALIDATION_ERROR', erros);
        }

        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]
                       || req.socket?.remoteAddress
                       || 'desconhecido';

        const pallet = await palletService.criarPallet(
            value,
            req.user.id,
            ipAddress
        );

        return created(res, pallet, 'Pallet criado com sucesso.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// PUT /api/v1/pallets/:id
// Edita pallet existente
// ---------------------------------------------------
async function editar(req, res, next) {
    try {
        const id = parseInt(req.params.id);

        if (!id || id <= 0) {
            return error(res, 'ID inválido.', 400, 'INVALID_ID');
        }

        const { error: validationError, value } = validate(
            updatePalletSchema,
            req.body
        );

        if (validationError) {
            const erros = validationError.details.map(d => d.message);
            return error(res, 'Dados inválidos.', 422, 'VALIDATION_ERROR', erros);
        }

        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]
                       || req.socket?.remoteAddress
                       || 'desconhecido';

        const pallet = await palletService.editarPallet(
            id,
            value,
            req.user.id,
            ipAddress
        );

        return success(res, pallet, 'Pallet atualizado com sucesso.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// DELETE /api/v1/pallets/:id
// Exclui pallet (apenas ADMIN)
// ---------------------------------------------------
async function excluir(req, res, next) {
    try {
        const id = parseInt(req.params.id);

        if (!id || id <= 0) {
            return error(res, 'ID inválido.', 400, 'INVALID_ID');
        }

        const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]
                       || req.socket?.remoteAddress
                       || 'desconhecido';

        const resultado = await palletService.excluirPallet(
            id,
            req.user.id,
            ipAddress
        );

        return success(res, null, resultado.message);
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// GET /api/v1/pallets/stats
// Estatísticas para o Dashboard
// ---------------------------------------------------
async function stats(req, res, next) {
    try {
        const dados = await palletService.estatisticas();
        return success(res, dados, 'Estatísticas carregadas.');
    } catch (err) {
        next(err);
    }
}

module.exports = { listar, buscarPorId, criar, editar, excluir, stats };