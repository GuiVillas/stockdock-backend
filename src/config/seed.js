/**
 * StockDock - Script de Seed
 * 
 * Insere dados iniciais obrigatórios:
 *   → Usuário ADMIN padrão do sistema
 * 
 * Execute com: npm run db:seed
 * 
 * ATENÇÃO: Verifica se o admin já existe antes de inserir.
 * Seguro para rodar múltiplas vezes.
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { pool } = require('./database');
const logger   = require('../utils/logger');

// ---------------------------------------------------
// Dados do admin inicial
// TROQUE A SENHA antes de ir para produção!
// ---------------------------------------------------
const ADMIN_DATA = {
    nome:  'Administrador',
    email: 'admin@stockdock.com',
    senha: 'Admin@2025',   // ← troque em produção
    cargo: 'ADMIN',
};

async function seed() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('🌱 Iniciando seed do banco de dados...\n');

        // Verifica se admin já existe
        const [existing] = await conn.query(
            'SELECT id, email FROM users WHERE email = ?',
            [ADMIN_DATA.email]
        );

        if (existing.length > 0) {
            logger.info(`⚠️  Admin já existe (ID: ${existing[0].id}). Seed ignorado.`);
            return;
        }

        // Gera hash da senha
        const rounds    = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const senhaHash = await bcrypt.hash(ADMIN_DATA.senha, rounds);

        logger.info(`🔐 Gerando hash da senha (rounds: ${rounds})... aguarde...`);

        // Insere admin
        const [result] = await conn.query(
            `INSERT INTO users (nome, email, senha_hash, cargo)
             VALUES (?, ?, ?, ?)`,
            [ADMIN_DATA.nome, ADMIN_DATA.email, senhaHash, ADMIN_DATA.cargo]
        );

        logger.info('\n✅ Seed concluído com sucesso!');
        logger.info('='.repeat(45));
        logger.info('   👤 Usuário admin criado:');
        logger.info(`   ID    : ${result.insertId}`);
        logger.info(`   Email : ${ADMIN_DATA.email}`);
        logger.info(`   Senha : ${ADMIN_DATA.senha}`);
        logger.info(`   Cargo : ${ADMIN_DATA.cargo}`);
        logger.info('='.repeat(45));
        logger.info('⚠️  TROQUE A SENHA antes de ir para produção!');

    } catch (error) {
        logger.error(`❌ Erro no seed: ${error.message}`);
        throw error;
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

seed().catch(() => process.exit(1));