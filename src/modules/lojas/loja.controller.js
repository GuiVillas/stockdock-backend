const lojaService = require('./loja.service');
const { createLojaSchema, updateLojaSchema, validate } = require('./loja.validator');
const { success, created, error } = require('../../utils/response');

async function listar(req, res, next) {
    try {
        const apenasAtivas = req.query.todas !== 'true';
        const lojas = await lojaService.listarLojas(apenasAtivas);
        return success(res, lojas, 'Lojas carregadas com sucesso.');
    } catch (err) { next(err); }
}

async function buscarPorId(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (!id || id <= 0) return error(res, 'ID inválido.', 400, 'INVALID_ID');
        const loja = await lojaService.buscarLojaPorId(id);
        return success(res, loja, 'Loja encontrada.');
    } catch (err) { next(err); }
}

async function criar(req, res, next) {
    try {
        const { error: ve, value } = validate(createLojaSchema, req.body);
        if (ve) {
            const erros = ve.details.map(d => d.message);
            return error(res, 'Dados inválidos.', 422, 'VALIDATION_ERROR', erros);
        }
        const ip   = req.headers['x-forwarded-for']?.split(',')[0]
                  || req.socket?.remoteAddress || 'desconhecido';
        const loja = await lojaService.criarLoja(value, req.user.id, ip);
        return created(res, loja, 'Loja criada com sucesso.');
    } catch (err) { next(err); }
}

async function editar(req, res, next) {
    try {
        const id = parseInt(req.params.id);
        if (!id || id <= 0) return error(res, 'ID inválido.', 400, 'INVALID_ID');

        const { error: ve, value } = validate(updateLojaSchema, req.body);
        if (ve) {
            const erros = ve.details.map(d => d.message);
            return error(res, 'Dados inválidos.', 422, 'VALIDATION_ERROR', erros);
        }
        const ip   = req.headers['x-forwarded-for']?.split(',')[0]
                  || req.socket?.remoteAddress || 'desconhecido';
        const loja = await lojaService.editarLoja(id, value, req.user.id, ip);
        return success(res, loja, 'Loja atualizada com sucesso.');
    } catch (err) { next(err); }
}

module.exports = { listar, buscarPorId, criar, editar };