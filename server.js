/**
 * StockDock Backend — server.js atualizado
 * Inclui: validação de env + checklist de startup
 */

require('dotenv').config();

// Valida variáveis de ambiente ANTES de qualquer import
const { validateEnv }    = require('./src/config/env.validator');
validateEnv();

const app                = require('./src/app');
const { testConnection } = require('./src/config/database');
const { printStartupInfo } = require('./src/utils/startup');

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await testConnection();

        const server = app.listen(PORT, () => {
            printStartupInfo();
        });

        // Graceful shutdown
        process.on('SIGTERM', () => gracefulShutdown(server, 'SIGTERM'));
        process.on('SIGINT',  () => gracefulShutdown(server, 'SIGINT'));

    } catch (error) {
        console.error('❌ Falha ao iniciar servidor:', error.message);
        process.exit(1);
    }
}

function gracefulShutdown(server, signal) {
    const logger = require('./src/utils/logger');
    logger.info(`\n⚠️  ${signal} recebido. Encerrando servidor...`);
    server.close(() => {
        logger.info('✅ Servidor encerrado com segurança.');
        process.exit(0);
    });

    // Força encerramento após 10 segundos se travar
    setTimeout(() => {
        logger.error('❌ Timeout no shutdown. Forçando encerramento.');
        process.exit(1);
    }, 10000);
}

process.on('unhandledRejection', (reason) => {
    const logger = require('./src/utils/logger');
    logger.error(`❌ Unhandled Rejection: ${reason}`);
});

process.on('uncaughtException', (error) => {
    const logger = require('./src/utils/logger');
    logger.error(`❌ Uncaught Exception: ${error.message}`);
    process.exit(1);
});

startServer();