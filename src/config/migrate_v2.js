require('dotenv').config();
const { pool } = require('./database');
const logger   = require('../utils/logger');

async function migrateV2() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('🚀 Migração V2 iniciando...\n');

        // ---------------------------------------------------
        // 1. Adiciona coluna setor na tabela users
        // ENUM: FRIOS, SECOS, null (para ADMIN e VISUALIZADOR)
        // ---------------------------------------------------
        logger.info('📋 Adicionando coluna setor em users...');
        await conn.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS setor
                ENUM('FRIOS','SECOS') NULL DEFAULT NULL
                AFTER cargo
        `);
        logger.info('   ✅ users.setor OK');

        // ---------------------------------------------------
        // 2. Adiciona coluna setor na tabela pallets
        // ---------------------------------------------------
        logger.info('📋 Adicionando coluna setor em pallets...');
        await conn.query(`
            ALTER TABLE pallets
            ADD COLUMN IF NOT EXISTS setor
                ENUM('FRIOS','SECOS') NOT NULL DEFAULT 'SECOS'
                AFTER sobra_status
        `);
        logger.info('   ✅ pallets.setor OK');

        // ---------------------------------------------------
        // 3. Cria tabela de lojas
        // ---------------------------------------------------
        logger.info('📋 Criando tabela lojas...');
        await conn.query(`
            CREATE TABLE IF NOT EXISTS lojas (
                id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
                nome          VARCHAR(120)  NOT NULL,
                numero        VARCHAR(20)   NOT NULL UNIQUE,
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

        // ---------------------------------------------------
        // 4. Adiciona FK de loja_id em pallets (opcional —
        //    mantemos loja_numero como string também para
        //    compatibilidade com registros antigos)
        // ---------------------------------------------------
        logger.info('📋 Adicionando loja_id em pallets...');
        await conn.query(`
            ALTER TABLE pallets
            ADD COLUMN IF NOT EXISTS loja_id
                INT UNSIGNED NULL DEFAULT NULL
                AFTER id,
            ADD CONSTRAINT fk_pallets_loja
                FOREIGN KEY IF NOT EXISTS (loja_id)
                REFERENCES lojas(id)
                ON DELETE SET NULL
                ON UPDATE CASCADE
        `);
        logger.info('   ✅ pallets.loja_id OK');

        // Índice para loja_id
        await conn.query(`
            CREATE INDEX IF NOT EXISTS idx_pallets_loja_id
            ON pallets(loja_id)
        `).catch(() => {}); // ignora se já existe

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