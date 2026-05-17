/**
 * StockDock - Sanitizador de Inputs
 *
 * Protege contra XSS removendo/escapando
 * conteúdo HTML e scripts maliciosos dos inputs.
 *
 * Aplicado globalmente em todas as requisições
 * via middleware antes dos controllers.
 */

// ---------------------------------------------------
// Remove tags HTML e scripts de uma string
// ---------------------------------------------------
function sanitizeString(value) {
    if (typeof value !== 'string') return value;

    return value
        // Remove tags HTML completas (<script>, <img>, etc.)
        .replace(/<[^>]*>/g, '')
        // Escapa caracteres especiais HTML
        .replace(/&/g,  '&amp;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#x27;')
        .replace(/\//g, '&#x2F;')
        // Remove null bytes (técnica de bypass de filtros)
        .replace(/\0/g, '')
        // Remove sequências de escape perigosas
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi,   '')
        .replace(/onload=/gi,     '')
        .replace(/onerror=/gi,    '')
        // Limita tamanho máximo para evitar DoS via payload gigante
        .substring(0, 10000)
        .trim();
}

// ---------------------------------------------------
// Sanitiza recursivamente um objeto inteiro
// Percorre arrays, objetos aninhados e strings
// ---------------------------------------------------
function sanitizeObject(obj) {
    if (obj === null || obj === undefined) return obj;

    // String: aplica sanitização direta
    if (typeof obj === 'string') {
        return sanitizeString(obj);
    }

    // Array: sanitiza cada elemento
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    // Objeto: sanitiza cada propriedade
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const key of Object.keys(obj)) {
            // Sanitiza também a chave para evitar prototype pollution
            const safeKey = sanitizeString(String(key));

            // Bloqueia prototype pollution
            if (safeKey === '__proto__' ||
                safeKey === 'constructor' ||
                safeKey === 'prototype') {
                continue;
            }

            sanitized[safeKey] = sanitizeObject(obj[key]);
        }
        return sanitized;
    }

    // Números, booleanos e outros tipos: retorna sem modificação
    return obj;
}

module.exports = { sanitizeString, sanitizeObject };