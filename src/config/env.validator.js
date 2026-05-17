/**
 * StockDock - Validador de Variáveis de Ambiente
 *
 * Executado ANTES de qualquer coisa no server.js.
 * Se uma variável crítica estiver faltando ou
 * com valor inseguro, o servidor NÃO sobe.
 *
 * Isso evita o app rodar em produção com
 * configurações de desenvolvimento (ex: JWT fraco).
 */

const logger = require('../utils/logger');

// ---------------------------------------------------
// Definição das variáveis com regras de validação
// ---------------------------------------------------
const ENV_RULES = [
    // Banco de dados
    {
        key:      'DB_HOST',
        required: true,
        message:  'Host do banco de dados não definido.',
    },
    {
        key:      'DB_NAME',
        required: true,
        message:  'Nome do banco de dados não definido.',
    },
    {
        key:      'DB_USER',
        required: true,
        message:  'Usuário do banco de dados não definido.',
    },
    {
        key:      'DB_PASSWORD',
        required: process.env.NODE_ENV === 'production',
        message:  'Senha do banco de dados obrigatória em produção.',
    },

    // JWT
    {
        key:      'JWT_SECRET',
        required: true,
        minLength: 32,
        message:  'JWT_SECRET deve ter no mínimo 32 caracteres.',
    },
    {
        key:      'JWT_REFRESH_SECRET',
        required: true,
        minLength: 32,
        message:  'JWT_REFRESH_SECRET deve ter no mínimo 32 caracteres.',
    },

    // Segurança em produção
    {
        key:         'JWT_SECRET',
        notContains: ['stockdock_jwt_secret', 'troque', 'exemplo', 'change_me'],
        onlyInProd:  true,
        message:     'JWT_SECRET parece ser um valor padrão. Troque em produção!',
    },
    {
        key:         'JWT_REFRESH_SECRET',
        notContains: ['stockdock_refresh', 'troque', 'exemplo', 'change_me'],
        onlyInProd:  true,
        message:     'JWT_REFRESH_SECRET parece ser um valor padrão. Troque em produção!',
    },
];

// ---------------------------------------------------
// Executa a validação
// ---------------------------------------------------
function validateEnv() {
    const errors   = [];
    const warnings = [];
    const isProd   = process.env.NODE_ENV === 'production';

    for (const rule of ENV_RULES) {
        const value = process.env[rule.key];

        // Pula regras exclusivas de produção quando em dev
        if (rule.onlyInProd && !isProd) continue;

        // Verifica se variável obrigatória existe
        if (rule.required && (!value || value.trim() === '')) {
            errors.push(`❌ ${rule.key}: ${rule.message}`);
            continue;
        }

        // Verifica comprimento mínimo
        if (rule.minLength && value && value.length < rule.minLength) {
            errors.push(`❌ ${rule.key}: ${rule.message}`);
            continue;
        }

        // Verifica valores inseguros (padrão/exemplo)
        if (rule.notContains && value) {
            const hasUnsafeValue = rule.notContains.some(unsafe =>
                value.toLowerCase().includes(unsafe.toLowerCase())
            );
            if (hasUnsafeValue) {
                errors.push(`❌ ${rule.key}: ${rule.message}`);
            }
        }
    }

    // Avisos em desenvolvimento
    if (!isProd) {
        if (!process.env.DB_PASSWORD) {
            warnings.push('⚠️  DB_PASSWORD vazia — OK para desenvolvimento local.');
        }
        if (process.env.JWT_SECRET?.length < 64) {
            warnings.push('⚠️  JWT_SECRET curto — use 64+ caracteres em produção.');
        }
    }

    // Exibe os avisos
    if (warnings.length > 0) {
        logger.warn('\n📋 Avisos de configuração:');
        warnings.forEach(w => logger.warn(`   ${w}`));
    }

    // Se houver erros, aborta a inicialização
    if (errors.length > 0) {
        logger.error('\n🚨 ERROS CRÍTICOS DE CONFIGURAÇÃO:');
        errors.forEach(e => logger.error(`   ${e}`));
        logger.error('\n💡 Corrija as variáveis no arquivo .env e reinicie.\n');
        process.exit(1);
    }

    logger.info('✅ Variáveis de ambiente validadas com sucesso.');
}

module.exports = { validateEnv };