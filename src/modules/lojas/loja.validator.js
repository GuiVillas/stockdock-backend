const Joi = require('joi');

const messages = {
    'string.empty':  '{{#label}} não pode estar vazio.',
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
}).min(1).messages(messages);

function validate(schema, data) {
    return schema.validate(data, {
        abortEarly: false, stripUnknown: true
    });
}

module.exports = { createLojaSchema, updateLojaSchema, validate };