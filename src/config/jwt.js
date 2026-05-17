/**
 * StockDock - Configuração e utilitários JWT
 * 
 * Access Token  : curta duração (8h), usado nas requests
 * Refresh Token : longa duração (7d), usado para renovar access token
 */

const jwt    = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET          = process.env.JWT_SECRET;
const JWT_EXPIRES_IN      = process.env.JWT_EXPIRES_IN      || '8h';
const JWT_REFRESH_SECRET  = process.env.JWT_REFRESH_SECRET;
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// ---------------------------------------------------
// Validação crítica: app não deve iniciar sem os secrets
// ---------------------------------------------------
if (!JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET inválido. Defina uma string de no mínimo 32 caracteres no .env');
}

if (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET.length < 32) {
    throw new Error('JWT_REFRESH_SECRET inválido. Defina uma string de no mínimo 32 caracteres no .env');
}

// ---------------------------------------------------
// Gera Access Token (payload: id, email, cargo)
// ---------------------------------------------------
function generateAccessToken(user) {
    const payload = {
        sub:   user.id,       // "subject" — padrão JWT para ID do usuário
        email: user.email,
        cargo: user.cargo,
        nome:  user.nome,
        type:  'access',
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
        issuer:    'stockdock-api',
        audience:  'stockdock-app',
    });
}

// ---------------------------------------------------
// Gera Refresh Token (payload mínimo — apenas ID)
// ---------------------------------------------------
function generateRefreshToken(user) {
    const payload = {
        sub:  user.id,
        type: 'refresh',
    };

    return jwt.sign(payload, JWT_REFRESH_SECRET, {
        expiresIn: JWT_REFRESH_EXPIRES,
        issuer:    'stockdock-api',
        audience:  'stockdock-app',
    });
}

// ---------------------------------------------------
// Verifica e decodifica Access Token
// ---------------------------------------------------
function verifyAccessToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET, {
            issuer:   'stockdock-api',
            audience: 'stockdock-app',
        });
    } catch (error) {
        logger.warn(`⚠️  Token inválido: ${error.message}`);
        return null;
    }
}

// ---------------------------------------------------
// Verifica e decodifica Refresh Token
// ---------------------------------------------------
function verifyRefreshToken(token) {
    try {
        return jwt.verify(token, JWT_REFRESH_SECRET, {
            issuer:   'stockdock-api',
            audience: 'stockdock-app',
        });
    } catch (error) {
        logger.warn(`⚠️  Refresh token inválido: ${error.message}`);
        return null;
    }
}

// ---------------------------------------------------
// Calcula tempo restante do token em segundos
// ---------------------------------------------------
function getTokenRemainingTime(token) {
    try {
        const decoded = jwt.decode(token);
        if (!decoded || !decoded.exp) return 0;
        return Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
    } catch {
        return 0;
    }
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    getTokenRemainingTime,
};