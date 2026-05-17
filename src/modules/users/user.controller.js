/**
 * StockDock - User Controller
 *
 * Responsabilidade: receber requisição HTTP,
 * chamar o service e devolver resposta padronizada.
 */

const userService = require('./user.service');
const {
    createUserSchema,
    updateUserSchema,
    changePasswordSchema,
    listUsersSchema,
    validate,
} = require('./user.validator');
const { success, created, error, paginated } = require('../../utils/response');

// ---------------------------------------------------
// Helper: extrai IP real do cliente
// ---------------------------------------------------
function getIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]
        || req.socket?.remoteAddress
        || 'desconhecido';
}

// ---------------------------------------------------
// GET /api/v1/users
// Lista usuários com filtros (apenas ADMIN)
// ---------------------------------------------------
async function listar(req, res, next) {
    try {
        const { error: validationError, value } = validate(
            listUsersSchema,
            req.query
        );

        if (validationError) {
            const erros = validationError.details.map(d => d.message);
            return error(res, 'Parâmetros inválidos.', 422, 'VALIDATION_ERROR', erros);
        }

        const resultado = await userService.listarUsuarios(value);

        return paginated(
            res,
            resultado.usuarios,
            resultado.pagination,
            'Usuários carregados com sucesso.'
        );
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// GET /api/v1/users/stats
// Estatísticas de usuários (apenas ADMIN)
// ---------------------------------------------------
async function stats(req, res, next) {
    try {
        const dados = await userService.estatisticasUsuarios();
        return success(res, dados, 'Estatísticas de usuários carregadas.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// GET /api/v1/users/:id
// Busca usuário por ID (apenas ADMIN)
// ---------------------------------------------------
async function buscarPorId(req, res, next) {
    try {
        const id = parseInt(req.params.id);

        if (!id || id <= 0) {
            return error(res, 'ID inválido.', 400, 'INVALID_ID');
        }

        const usuario = await userService.buscarUsuarioPorId(id);
        return success(res, usuario, 'Usuário encontrado.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// POST /api/v1/users
// Cria usuário (apenas ADMIN)
// ---------------------------------------------------
async function criar(req, res, next) {
    try {
        const { error: validationError, value } = validate(
            createUserSchema,
            req.body
        );

        if (validationError) {
            const erros = validationError.details.map(d => d.message);
            return error(res, 'Dados inválidos.', 422, 'VALIDATION_ERROR', erros);
        }

        const usuario = await userService.criarUsuario(
            value,
            req.user.id,
            getIp(req)
        );

        return created(res, usuario, 'Usuário criado com sucesso.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// PUT /api/v1/users/:id
// Edita usuário (apenas ADMIN)
// ---------------------------------------------------
async function editar(req, res, next) {
    try {
        const id = parseInt(req.params.id);

        if (!id || id <= 0) {
            return error(res, 'ID inválido.', 400, 'INVALID_ID');
        }

        const { error: validationError, value } = validate(
            updateUserSchema,
            req.body
        );

        if (validationError) {
            const erros = validationError.details.map(d => d.message);
            return error(res, 'Dados inválidos.', 422, 'VALIDATION_ERROR', erros);
        }

        const usuario = await userService.editarUsuario(
            id,
            value,
            req.user.id,
            getIp(req)
        );

        return success(res, usuario, 'Usuário atualizado com sucesso.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// DELETE /api/v1/users/:id
// Desativa usuário — soft delete (apenas ADMIN)
// ---------------------------------------------------
async function excluir(req, res, next) {
    try {
        const id = parseInt(req.params.id);

        if (!id || id <= 0) {
            return error(res, 'ID inválido.', 400, 'INVALID_ID');
        }

        const resultado = await userService.excluirUsuario(
            id,
            req.user.id,
            getIp(req)
        );

        return success(res, null, resultado.message);
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// PATCH /api/v1/users/:id/reativar
// Reativa usuário desativado (apenas ADMIN)
// ---------------------------------------------------
async function reativar(req, res, next) {
    try {
        const id = parseInt(req.params.id);

        if (!id || id <= 0) {
            return error(res, 'ID inválido.', 400, 'INVALID_ID');
        }

        const usuario = await userService.reativarUsuario(
            id,
            req.user.id,
            getIp(req)
        );

        return success(res, usuario, 'Usuário reativado com sucesso.');
    } catch (err) {
        next(err);
    }
}

// ---------------------------------------------------
// PATCH /api/v1/users/me/senha
// Altera a própria senha (qualquer usuário logado)
// ---------------------------------------------------
async function alterarSenha(req, res, next) {
    try {
        const { error: validationError, value } = validate(
            changePasswordSchema,
            req.body
        );

        if (validationError) {
            const erros = validationError.details.map(d => d.message);
            return error(res, 'Dados inválidos.', 422, 'VALIDATION_ERROR', erros);
        }

        const resultado = await userService.alterarSenha(
            req.user.id,
            value.senha_atual,
            value.nova_senha,
            getIp(req)
        );

        return success(res, null, resultado.message);
    } catch (err) {
        next(err);
    }
}

module.exports = {
    listar,
    stats,
    buscarPorId,
    criar,
    editar,
    excluir,
    reativar,
    alterarSenha,
};