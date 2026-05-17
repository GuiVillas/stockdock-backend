/**
 * StockDock - Validadores do módulo Auth
 * 
 * Usa Joi para validar os dados de entrada
 * antes de chegar no controller.
 * Retorna mensagens de erro em português.
 */

const Joi = require('joi');

// ---------------------------------------------------
// Mensagens de erro padronizadas em PT-BR
// ---------------------------------------------------
const messages = {
    'string.base':     '{{#label}} deve ser um texto.',
    'string.empty':    '{{#label}} não pode estar vazio.',
    'string.min':      '{{#label}} deve ter no mínimo {{#limit}} caracteres.',
    'string.max':      '{{#label}} deve ter no máximo {{#limit}} caracteres.',
    'string.email':    '{{#label}} deve ser um e-mail válido.',
    'any.required':    '{{#label}} é obrigatório.',
};

// ---------------------------------------------------
// Schema: Login
// ---------------------------------------------------
const loginSchema = Joi.object({
    email: Joi.string()
        .email({ tlds: { allow: false } })
        .max(180)
        .required()
        .label('E-mail'),

    senha: Joi.string()
        .min(6)
        .max(100)
        .required()
        .label('Senha'),

}).messages(messages);

// ---------------------------------------------------
// Schema: Refresh Token
// ---------------------------------------------------
const refreshSchema = Joi.object({
    refresh_token: Joi.string()
        .required()
        .label('Refresh token'),

}).messages(messages);

// ---------------------------------------------------
// Função validadora genérica
// Retorna { error, value } no padrão Joi
// ---------------------------------------------------
function validate(schema, data) {
    return schema.validate(data, {
        abortEarly:  false,  // retorna TODOS os erros, não só o primeiro
        stripUnknown: true,  // remove campos não declarados no schema
    });
}

module.exports = {
    loginSchema,
    refreshSchema,
    validate,
};