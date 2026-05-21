require('dotenv').config();
const { pool } = require('./database');
const logger   = require('../utils/logger');

async function migrateV2() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('🚀 Migração V2 iniciando...\n');

        logger.info('📋 Adicionando coluna setor em users...');
        await conn.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS setor
                ENUM('FRIOS','SECOS') NULL DEFAULT NULL
                AFTER cargo
        `);
        logger.info('   ✅ users.setor OK');

        logger.info('📋 Adicionando coluna setor em pallets...');
        await conn.query(`
            ALTER TABLE pallets
            ADD COLUMN IF NOT EXISTS setor
                ENUM('FRIOS','SECOS') NOT NULL DEFAULT 'SECOS'
                AFTER sobra_status
        `);
        logger.info('   ✅ pallets.setor OK');

        logger.info('📋 Criando tabela lojas...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS lojas (
                id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
                nome          VARCHAR(120)  NOT NULL,
                numero        VARCHAR(20)   NOT NULL,
                ativo         TINYINT(1)    NOT NULL DEFAULT 1,
                criado_por    INT UNSIGNED  NOT NULL,
                criado_em     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
                atualizado_em DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_lojas_numero (numero),
                INDEX idx_lojas_ativo (ativo),
                CONSTRAINT fk_lojas_usuario
                    FOREIGN KEY (criado_por)
                    REFERENCES users(id)
                    ON DELETE RESTRICT
                    ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        logger.info('   ✅ lojas OK');

        logger.info('📋 Adicionando loja_id em pallets...');
        await conn.query(`
            ALTER TABLE pallets
            ADD COLUMN IF NOT EXISTS loja_id
                INT UNSIGNED NULL DEFAULT NULL
                AFTER id
        `);

        try {
            await conn.query(`
                ALTER TABLE pallets
                ADD CONSTRAINT fk_pallets_loja
                    FOREIGN KEY (loja_id)
                    REFERENCES lojas(id)
                    ON DELETE SET NULL
                    ON UPDATE CASCADE
            `);
        } catch (e) {
            logger.info('   (FK já existia, ignorando)');
        }

        try {
            await conn.query(`
                CREATE INDEX idx_pallets_loja_id ON pallets(loja_id)
            `);
        } catch (e) {
            logger.info('   (índice já existia, ignorando)');
        }

        logger.info('   ✅ pallets.loja_id OK');
        logger.info('\n✅ Migração V2 concluída!');

    } catch (error) {
        logger.error(`❌ Erro: ${error.message}`);
        throw error;
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

migrateV2().catch(() => process.exit(1));