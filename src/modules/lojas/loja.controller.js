const lojaService = require('./loja.service');
const { createLojaSchema, updateLojaSchema, validate } = require('./loja.validator');
const { success, created, error } = require('../../utils/response');

async function listar(req, res, next) {
    try {
        const apenasAtivas = req.query.todas !== 'true';
        const lojas = await lojaService.listarLojas(apenasAtivas);
        return success(res, lojas, 'Lojas carregadas.');
    } catch (err) { next(err); }
}

async function criar(req, res, next) {
    try {
        const { error: ve, value } = validate(createLojaSchema, req.body);
        if (ve) {
            return error(res, ve.details[0].message, 422, 'VALIDATION_ERROR');
        }
        const ip   = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
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
            return error(res, ve.details[0].message, 422, 'VALIDATION_ERROR');
        }
        const ip   = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress;
        const loja = await lojaService.editarLoja(id, value, req.user.id, ip);
        return success(res, loja, 'Loja atualizada.');
    } catch (err) { next(err); }
}

module.exports = { listar, criar, editar };