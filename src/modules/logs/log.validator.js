/**
 * StockDock - Validadores do módulo Logs
 *
 * Valida os filtros de consulta dos logs de auditoria.
 * Logs são somente leitura — não há criação via API.
 * A inserção é feita internamente pelo registrarLog().
 */

const Joi = require('joi');

const messages = {
    'string.base':         '{{#label}} deve ser um texto.',
    'string.empty':        '{{#label}} não pode estar vazio.',
    'string.max':          '{{#label}} deve ter no máximo {{#limit}} caracteres.',
    'string.pattern.base': '{{#label}} possui formato inválido.',
    'number.base':         '{{#label}} deve ser um número.',
    'number.integer':      '{{#label}} deve ser um número inteiro.',
    'number.min':          '{{#label}} deve ser no mínimo {{#limit}}.',
    'any.only':            '{{#label}} deve ser um dos valores: {{#valids}}.',
};

// ---------------------------------------------------
// Ações válidas — espelha o ENUM do banco de dados
// ---------------------------------------------------
const ACOES_VALIDAS = [
    'LOGIN',
    'LOGOUT',
    'CRIAR_PALLET',
    'EDITAR_PALLET',
    'EXCLUIR_PALLET',
    'GERAR_PDF',
    'CRIAR_USUARIO',
    'EDITAR_USUARIO',
    'EXCLUIR_USUARIO',
];

// ---------------------------------------------------
// Schema: Filtros da listagem de logs
// ---------------------------------------------------
const listLogsSchema = Joi.object({

    // Filtro por usuário específico
    usuario_id: Joi.number()
        .integer()
        .min(1)
        .optional()
        .label('Usuário'),

    // Filtro por tipo de ação
    acao: Joi.string()
        .valid(...ACOES_VALIDAS)
        .optional()
        .label('Ação'),

    // Filtro por período
    data_inicio: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .label('Data início')
        .messages({
            'string.pattern.base': 'Data início deve estar no formato AAAA-MM-DD.',
        }),

    data_fim: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .label('Data fim')
        .messages({
            'string.pattern.base': 'Data fim deve estar no formato AAAA-MM-DD.',
        }),

    // Busca geral na descrição
    busca: Joi.string()
        .max(100)
        .optional()
        .label('Busca'),

    // Paginação
    page: Joi.number()
        .integer()
        .min(1)
        .default(1)
        .label('Página'),

    limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(30)
        .label('Limite'),

    // Ordenação — logs quase sempre são consultados
    // do mais recente para o mais antigo
    order: Joi.string()
        .valid('asc', 'desc')
        .default('desc')
        .label('Direção'),

}).messages(messages);

function validate(schema, data) {
    return schema.validate(data, {
        abortEarly:   false,
        stripUnknown: true,
    });
}

module.exports = { listLogsSchema, ACOES_VALIDAS, validate };