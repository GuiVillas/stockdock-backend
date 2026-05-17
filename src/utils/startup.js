/**
 * StockDock - Checklist de Segurança na Inicialização
 *
 * Exibe um resumo do estado do sistema ao subir.
 * Ajuda a identificar configurações incorretas
 * antes de entrar em produção.
 */

const logger = require('./logger');

function printStartupInfo() {
    const isProd = process.env.NODE_ENV === 'production';

    const info = [
        '',
        '╔══════════════════════════════════════════════╗',
        '║          StockDock API — Inicializado        ║',
        '╠══════════════════════════════════════════════╣',
        `║  Ambiente   : ${padEnd(process.env.NODE_ENV || 'development', 29)}║`,
        `║  Porta      : ${padEnd(process.env.PORT || '3000', 29)}║`,
        `║  Banco      : ${padEnd(process.env.DB_NAME || '?', 29)}║`,
        `║  Host DB    : ${padEnd(process.env.DB_HOST || '?', 29)}║`,
        '╠══════════════════════════════════════════════╣',
        `║  JWT Expira : ${padEnd(process.env.JWT_EXPIRES_IN || '8h', 29)}║`,
        `║  Bcrypt     : ${padEnd(`${process.env.BCRYPT_ROUNDS || 12} rounds`, 29)}║`,
        `║  Rate Limit : ${padEnd(`${process.env.RATE_LIMIT_MAX_REQUESTS || 100} req/15min`, 29)}║`,
        '╠══════════════════════════════════════════════╣',
        `║  Segurança  : ${padEnd(isProd ? '🔒 PRODUÇÃO' : '🔓 DESENVOLVIMENTO', 29)}║`,
        `║  CORS       : ${padEnd(isProd ? 'Restrito' : 'Aberto (*)', 29)}║`,
        `║  Logs       : ${padEnd(process.env.LOG_LEVEL || 'info', 29)}║`,
        '╚══════════════════════════════════════════════╝',
        '',
    ];

    info.forEach(line => logger.info(line));

    // Alertas importantes
    if (!isProd) {
        logger.warn('⚠️  Rodando em modo DESENVOLVIMENTO.');
        logger.warn('   Não use esta configuração em produção!');
        logger.warn(`   Acesse: http://localhost:${process.env.PORT || 3000}/health`);
        logger.info('');
    }
}

// Helper para alinhar as colunas do quadro
function padEnd(str, length) {
    str = String(str);
    return str.length > length
        ? str.substring(0, length - 3) + '...'
        : str.padEnd(length);
}

module.exports = { printStartupInfo };