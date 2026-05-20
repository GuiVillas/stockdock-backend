/**
 * StockDock - Validadores do módulo Pallets
 *
 * Valida todos os inputs antes de chegar no service.
 * Mensagens de erro em português.
 */

const Joi = require('joi');

// ---------------------------------------------------
// Mensagens padronizadas em PT-BR
// ---------------------------------------------------
const messages = {
    'string.base':      '{{#label}} deve ser um texto.',
    'string.empty':     '{{#label}} não pode estar vazio.',
    'string.min':       '{{#label}} deve ter no mínimo {{#limit}} caracteres.',
    'string.max':       '{{#label}} deve ter no máximo {{#limit}} caracteres.',
    'string.pattern.base': '{{#label}} possui formato inválido.',
    'number.base':      '{{#label}} deve ser um número.',
    'number.integer':   '{{#label}} deve ser um número inteiro.',
    'number.min':       '{{#label}} deve ser no mínimo {{#limit}}.',
    'number.max':       '{{#label}} deve ser no máximo {{#limit}}.',
    'boolean.base':     '{{#label}} deve ser verdadeiro ou falso.',
    'date.base':        '{{#label}} deve ser uma data válida.',
    'date.format':      '{{#label}} deve estar no formato AAAA-MM-DD.',
    'any.required':     '{{#label}} é obrigatório.',
    'any.only':         '{{#label}} deve ser um dos valores: {{#valids}}.',
};

// ---------------------------------------------------
// Schema: Criar pallet
// ---------------------------------------------------
const createPalletSchema = Joi.object({

    loja_numero: Joi.string()
        .min(1)
        .max(20)
        .required()
        .label('Número da loja'),

    box_numero: Joi.string()
        .min(1)
        .max(20)
        .required()
        .label('Número do box'),

    carga_numero: Joi.string()
        .min(1)
        .max(30)
        .required()
        .label('Número da carga'),

    quantidade: Joi.number()
        .integer()
        .min(0)
        .max(99999)
        .required()
        .label('Quantidade de pallets'),

    data_registro: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .required()
        .label('Data')
        .messages({
            'string.pattern.base': 'Data deve estar no formato AAAA-MM-DD. Ex: 2025-01-31',
        }),

    placa_caminhao: Joi.string()
        .min(7)
        .max(15)
        .required()
        .label('Placa do caminhão'),

    sobra_status: Joi.boolean()
        .default(false)
        .label('Sobra de pallets'),

    setor: Joi.string()
    .valid('FRIOS', 'SECOS')
    .required()
    .label('Setor'),

    loja_id: Joi.number()
        .integer()
        .positive()
        .required()
        .label('Loja'),

}).messages(messages);

// ---------------------------------------------------
// Schema: Editar pallet (todos os campos opcionais,
// mas pelo menos 1 deve ser informado)
// ---------------------------------------------------
const updatePalletSchema = Joi.object({

    loja_numero: Joi.string()
        .min(1)
        .max(20)
        .label('Número da loja'),

    box_numero: Joi.string()
        .min(1)
        .max(20)
        .label('Número do box'),

    carga_numero: Joi.string()
        .min(1)
        .max(30)
        .label('Número da carga'),

    quantidade: Joi.number()
        .integer()
        .min(0)
        .max(99999)
        .label('Quantidade de pallets'),

    data_registro: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .label('Data')
        .messages({
            'string.pattern.base': 'Data deve estar no formato AAAA-MM-DD. Ex: 2025-01-31',
        }),

    placa_caminhao: Joi.string()
        .min(7)
        .max(15)
        .label('Placa do caminhão'),

    sobra_status: Joi.boolean()
        .label('Sobra de pallets'),

// Garante que pelo menos 1 campo foi enviado
}).min(1).messages({
    ...messages,
    'object.min': 'Informe pelo menos um campo para atualizar.',
});

// ---------------------------------------------------
// Schema: Filtros da listagem (query params)
// ---------------------------------------------------
const listPalletsSchema = Joi.object({

    // Filtros
    loja:       Joi.string().max(20).optional().label('Loja'),
    carga:      Joi.string().max(30).optional().label('Carga'),
    placa:      Joi.string().max(15).optional().label('Placa'),
    sobra:      Joi.string().valid('true','false').optional().label('Sobra'),
    usuario_id: Joi.number().integer().positive().optional().label('Usuário'),

    data_inicio: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .label('Data início'),

    data_fim: Joi.string()
        .pattern(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .label('Data fim'),

    // Busca geral
    busca: Joi.string().max(100).optional().label('Busca'),

    // Paginação
    page:  Joi.number().integer().min(1).default(1).label('Página'),
    limit: Joi.number().integer().min(1).max(100).default(20).label('Limite'),

    // Ordenação
    order_by: Joi.string()
        .valid('data_registro','loja_numero','carga_numero','quantidade','criado_em')
        .default('criado_em')
        .label('Ordenar por'),

    order: Joi.string()
        .valid('asc','desc')
        .default('desc')
        .label('Direção'),

}).messages(messages);

// ---------------------------------------------------
// Função validadora genérica
// ---------------------------------------------------
function validate(schema, data) {
    return schema.validate(data, {
        abortEarly:   false,
        stripUnknown: true,
    });
}

module.exports = {
    createPalletSchema,
    updatePalletSchema,
    listPalletsSchema,
    validate,
};