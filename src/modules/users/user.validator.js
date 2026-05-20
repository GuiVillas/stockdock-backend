/**
 * StockDock - Validadores do módulo Users
 *
 * Valida todos os inputs de criação,
 * edição e listagem de usuários.
 */

const Joi = require('joi');

// ---------------------------------------------------
// Mensagens padronizadas em PT-BR
// ---------------------------------------------------
const messages = {
    'string.base':         '{{#label}} deve ser um texto.',
    'string.empty':        '{{#label}} não pode estar vazio.',
    'string.min':          '{{#label}} deve ter no mínimo {{#limit}} caracteres.',
    'string.max':          '{{#label}} deve ter no máximo {{#limit}} caracteres.',
    'string.email':        '{{#label}} deve ser um e-mail válido.',
    'string.pattern.base': '{{#label}} possui formato inválido.',
    'boolean.base':        '{{#label}} deve ser verdadeiro ou falso.',
    'any.required':        '{{#label}} é obrigatório.',
    'any.only':            '{{#label}} deve ser um dos valores: {{#valids}}.',
};

// ---------------------------------------------------
// Regex de senha forte:
// Mínimo 8 caracteres, 1 maiúscula, 1 minúscula,
// 1 número e 1 caractere especial
// ---------------------------------------------------
const SENHA_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#_\-])[A-Za-z\d@$!%*?&#_\-]{8,}$/;

const CARGOS_VALIDOS = ['ADMIN', 'OPERADOR', 'VISUALIZADOR'];

// ---------------------------------------------------
// Schema: Criar usuário (todos os campos obrigatórios)
// ---------------------------------------------------
const createUserSchema = Joi.object({

    nome: Joi.string()
        .min(3)
        .max(120)
        .required()
        .label('Nome'),

    email: Joi.string()
        .email({ tlds: { allow: false } })
        .max(180)
        .required()
        .label('E-mail'),

    senha: Joi.string()
        .pattern(SENHA_REGEX)
        .required()
        .label('Senha')
        .messages({
            'string.pattern.base':
                'Senha deve ter no mínimo 8 caracteres, ' +
                '1 letra maiúscula, 1 minúscula, ' +
                '1 número e 1 caractere especial (@$!%*?&#_-).',
        }),

    cargo: Joi.string()
        .valid(...CARGOS_VALIDOS)
        .required()
        .label('Cargo'),

    setor: Joi.string()
        .valid('FRIOS', 'SECOS')
        .allow(null)
        .optional()
        .label('Setor'),

}).messages(messages);

// ---------------------------------------------------
// Schema: Editar usuário (campos opcionais,
// mas pelo menos 1 deve ser enviado)
// ---------------------------------------------------
const updateUserSchema = Joi.object({

    nome: Joi.string()
        .min(3)
        .max(120)
        .label('Nome'),

    email: Joi.string()
        .email({ tlds: { allow: false } })
        .max(180)
        .label('E-mail'),

    cargo: Joi.string()
        .valid(...CARGOS_VALIDOS)
        .label('Cargo'),

    ativo: Joi.boolean()
        .label('Ativo'),
    
    setor: Joi.string()
        .valid('FRIOS', 'SECOS')
        .allow(null)
        .optional()
        .label('Setor'),

}).min(1).messages({
    ...messages,
    'object.min': 'Informe pelo menos um campo para atualizar.',
});

// ---------------------------------------------------
// Schema: Alterar senha (pelo próprio usuário)
// ---------------------------------------------------
const changePasswordSchema = Joi.object({

    senha_atual: Joi.string()
        .required()
        .label('Senha atual'),

    nova_senha: Joi.string()
        .pattern(SENHA_REGEX)
        .required()
        .label('Nova senha')
        .messages({
            'string.pattern.base':
                'Nova senha deve ter no mínimo 8 caracteres, ' +
                '1 letra maiúscula, 1 minúscula, ' +
                '1 número e 1 caractere especial (@$!%*?&#_-).',
        }),

    confirmar_senha: Joi.string()
        .valid(Joi.ref('nova_senha'))
        .required()
        .label('Confirmar senha')
        .messages({
            'any.only': 'Confirmação de senha não confere com a nova senha.',
        }),

}).messages(messages);

// ---------------------------------------------------
// Schema: Filtros da listagem de usuários
// ---------------------------------------------------
const listUsersSchema = Joi.object({

    busca:  Joi.string().max(100).optional().label('Busca'),
    cargo:  Joi.string().valid(...CARGOS_VALIDOS).optional().label('Cargo'),
    ativo:  Joi.string().valid('true', 'false').optional().label('Ativo'),

    page:   Joi.number().integer().min(1).default(1).label('Página'),
    limit:  Joi.number().integer().min(1).max(100).default(20).label('Limite'),

    order_by: Joi.string()
        .valid('nome', 'email', 'cargo', 'criado_em')
        .default('criado_em')
        .label('Ordenar por'),

    order: Joi.string()
        .valid('asc', 'desc')
        .default('asc')
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
    createUserSchema,
    updateUserSchema,
    changePasswordSchema,
    listUsersSchema,
    validate,
};