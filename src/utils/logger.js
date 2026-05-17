/**
 * StockDock - Logger centralizado com Winston
 * 
 * Níveis: error > warn > info > http > debug
 * Em produção: grava em arquivo com rotação diária
 * Em desenvolvimento: exibe no console colorido
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const LOG_DIR   = process.env.LOG_DIR   || 'logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const IS_PROD   = process.env.NODE_ENV  === 'production';

// ---------------------------------------------------
// Formato base: timestamp + nível + mensagem
// ---------------------------------------------------
const baseFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // inclui stack trace em erros
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        return stack
            ? `[${timestamp}] ${level.toUpperCase()}: ${message}\n${stack}`
            : `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
);

// ---------------------------------------------------
// Transportes (destinos dos logs)
// ---------------------------------------------------
const transports = [];

// Console: sempre ativo (colorido em dev, simples em prod)
transports.push(new winston.transports.Console({
    format: IS_PROD
        ? baseFormat
        : winston.format.combine(winston.format.colorize(), baseFormat),
}));

// Arquivo: apenas em produção
if (IS_PROD) {
    // Logs gerais (info, warn, http)
    transports.push(new DailyRotateFile({
        dirname:     path.join(LOG_DIR, 'application'),
        filename:    'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize:     '20m',
        maxFiles:    '30d',  // mantém 30 dias de logs
        level:       'info',
        format:      baseFormat,
    }));

    // Apenas erros em arquivo separado
    transports.push(new DailyRotateFile({
        dirname:     path.join(LOG_DIR, 'errors'),
        filename:    'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize:     '20m',
        maxFiles:    '30d',
        level:       'error',
        format:      baseFormat,
    }));
}

// ---------------------------------------------------
// Instância do logger
// ---------------------------------------------------
const logger = winston.createLogger({
    level:       LOG_LEVEL,
    transports,
    exitOnError: false,
});

module.exports = logger;