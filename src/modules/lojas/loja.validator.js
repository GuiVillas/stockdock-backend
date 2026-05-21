const Joi = require('joi');

const messages = {
    'string.base':   '{{#label}} deve ser um texto.',
    'string.empty':  '{{#label}} não pode estar vazio.',
    'string.min':    '{{#label}} deve ter no mínimo {{#limit}} caracteres.',
    'string.max':    '{{#label}} deve ter no máximo {{#limit}} caracteres.',
    'any.required':  '{{#label}} é obrigatório.',
};

const createLojaSchema = Joi.object({
    nome:   Joi.string().min(2).max(120).required().label('Nome'),
    numero: Joi.string().min(1).max(20).required().label('Número'),
}).messages(messages);

const updateLojaSchema = Joi.object({
    nome:   Joi.string().min(2).max(120).label('Nome'),
    numero: Joi.string().min(1).max(20).label('Número'),
    ativo:  Joi.boolean().label('Ativo'),
}).min(1).messages({
    ...messages,
    'object.min': 'Informe pelo menos um campo para atualizar.',
});

function validate(schema, data) {
    return schema.validate(data, {
        abortEarly:   false,
        stripUnknown: true,
    });
}

module.exports = { createLojaSchema, updateLojaSchema, validate };