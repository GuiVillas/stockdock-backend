/**
 * StockDock - Helpers de resposta padronizada
 * 
 * Garante que TODAS as respostas da API
 * sigam o mesmo formato JSON, facilitando
 * o tratamento no app Android.
 */

/**
 * Resposta de sucesso
 * @param {object} res     - Express response
 * @param {*}      data    - Dados a retornar
 * @param {string} message - Mensagem descritiva
 * @param {number} status  - HTTP status code (default 200)
 */
function success(res, data = null, message = 'Operação realizada com sucesso', status = 200) {
    return res.status(status).json({
        success:   true,
        message,
        data,
        timestamp: new Date().toISOString(),
    });
}

/**
 * Resposta de criação (201 Created)
 */
function created(res, data, message = 'Registro criado com sucesso') {
    return success(res, data, message, 201);
}

/**
 * Resposta de erro
 * @param {object} res     - Express response
 * @param {string} message - Mensagem de erro
 * @param {number} status  - HTTP status code (default 400)
 * @param {string} code    - Código do erro (para o app identificar)
 * @param {*}      errors  - Detalhes dos erros de validação
 */
function error(res, message = 'Erro interno', status = 400, code = 'ERROR', errors = null) {
    const body = {
        success:   false,
        message,
        code,
        timestamp: new Date().toISOString(),
    };

    if (errors) body.errors = errors;

    return res.status(status).json(body);
}

/**
 * Resposta paginada
 */
function paginated(res, data, pagination, message = 'Lista carregada com sucesso') {
    return res.status(200).json({
        success: true,
        message,
        data,
        pagination: {
            total:       pagination.total,
            page:        pagination.page,
            limit:       pagination.limit,
            total_pages: Math.ceil(pagination.total / pagination.limit),
            has_next:    pagination.page < Math.ceil(pagination.total / pagination.limit),
            has_prev:    pagination.page > 1,
        },
        timestamp: new Date().toISOString(),
    });
}

module.exports = { success, created, error, paginated };