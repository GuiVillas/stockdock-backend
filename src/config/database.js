/**
 * StockDock - Configuração MySQL
 * Usa mysql2 com pool de conexões e promises nativas
 */

const mysql  = require('mysql2/promise');
const logger = require('../utils/logger');

const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT) || 3306,
    database:           process.env.DB_NAME     || 'stockdock',
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit:    parseInt(process.env.DB_MAX_CONNECTIONS) || 10,
    queueLimit:         0,
    timezone:           'Z',        // UTC para consistência
    charset:            'utf8mb4',  // suporte completo a emojis e caracteres especiais
    connectTimeout:     10000,
});

// ---------------------------------------------------
// Testa conexão antes de subir o servidor
// ---------------------------------------------------
async function testConnection() {
    let conn;
    try {
        conn = await pool.getConnection();
        const [rows] = await conn.query(
            'SELECT NOW() AS server_time, VERSION() AS mysql_version'
        );
        const { server_time, mysql_version } = rows[0];

        logger.info('✅ MySQL conectado com sucesso');
        logger.info(`   Hora do servidor : ${server_time}`);
        logger.info(`   Versão           : ${mysql_version}`);

    } catch (error) {
        logger.error(`❌ Falha ao conectar ao MySQL: ${error.message}`);
        throw error;
    } finally {
        if (conn) conn.release();
    }
}

// ---------------------------------------------------
// Helper para queries simples
// Retorna direto as rows para facilitar uso
// ---------------------------------------------------
async function query(sql, params = []) {
    const start = Date.now();
    try {
        const [rows] = await pool.query(sql, params);
        const duration = Date.now() - start;

        if (duration > 1000) {
            logger.warn(`⚠️  Query lenta (${duration}ms): ${sql.substring(0, 100)}`);
        }

        return rows;
    } catch (error) {
        logger.error(`❌ Erro na query: ${error.message}`);
        logger.error(`   SQL: ${sql.substring(0, 200)}`);
        throw error;
    }
}

// ---------------------------------------------------
// Helper para transações
// COMMIT automático no sucesso, ROLLBACK no erro
// ---------------------------------------------------
async function withTransaction(callback) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const result = await callback(conn);
        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback();
        logger.error(`❌ Transação revertida: ${error.message}`);
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = { pool, query, withTransaction, testConnection };