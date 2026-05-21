require('dotenv').config();
const { pool } = require('./database');
const logger   = require('../utils/logger');

// ---------------------------------------------------
// Helper: verifica se uma coluna existe na tabela
// ---------------------------------------------------
async function colunaExiste(conn, tabela, coluna) {
    const rows = await conn.query(
        `SELECT COUNT(*) as total
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = ?
           AND COLUMN_NAME  = ?`,
        [tabela, coluna]
    );
    return rows[0][0].total > 0;
}

// ---------------------------------------------------
// Helper: verifica se uma tabela existe
// ---------------------------------------------------
async function tabelaExiste(conn, tabela) {
    const rows = await conn.query(
        `SELECT COUNT(*) as total
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = ?`,
        [tabela]
    );
    return rows[0][0].total > 0;
}

// ---------------------------------------------------
// Helper: verifica se um índice existe
// ---------------------------------------------------
async function indiceExiste(conn, tabela, indice) {
    const rows = await conn.query(
        `SELECT COUNT(*) as total
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = ?
           AND INDEX_NAME   = ?`,
        [tabela, indice]
    );
    return rows[0][0].total > 0;
}

// ---------------------------------------------------
// Helper: verifica se uma FK existe
// ---------------------------------------------------
async function fkExiste(conn, tabela, fk) {
    const rows = await conn.query(
        `SELECT COUNT(*) as total
         FROM information_schema.TABLE_CONSTRAINTS
         WHERE TABLE_SCHEMA     = DATABASE()
           AND TABLE_NAME       = ?
           AND CONSTRAINT_NAME  = ?
           AND CONSTRAINT_TYPE  = 'FOREIGN KEY'`,
        [tabela, fk]
    );
    return rows[0][0].total > 0;
}

async function migrateV2() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('🚀 Migração V2 iniciando...\n');

        // ---------------------------------------------------
        // 1. Adiciona coluna setor em users
        // ---------------------------------------------------
        logger.info('📋 Verificando coluna setor em users...');
        const setorUsersExiste = await colunaExiste(conn, 'users', 'setor');
        if (!setorUsersExiste) {
            await conn.query(`
                ALTER TABLE users
                ADD COLUMN setor ENUM('FRIOS','SECOS') NULL DEFAULT NULL
                AFTER cargo
            `);
            logger.info('   ✅ users.setor adicionada');
        } else {
            logger.info('   ⏭️  users.setor já existe, pulando');
        }

        // ---------------------------------------------------
        // 2. Adiciona coluna setor em pallets
        // ---------------------------------------------------
        logger.info('📋 Verificando coluna setor em pallets...');
        const setorPalletsExiste = await colunaExiste(conn, 'pallets', 'setor');
        if (!setorPalletsExiste) {
            await conn.query(`
                ALTER TABLE pallets
                ADD COLUMN setor ENUM('FRIOS','SECOS') NOT NULL DEFAULT 'SECOS'
                AFTER sobra_status
            `);
            logger.info('   ✅ pallets.setor adicionada');
        } else {
            logger.info('   ⏭️  pallets.setor já existe, pulando');
        }

        // ---------------------------------------------------
        // 3. Cria tabela lojas
        // ---------------------------------------------------
        logger.info('📋 Verificando tabela lojas...');
        const lojasTabelaExiste = await tabelaExiste(conn, 'lojas');
        if (!lojasTabelaExiste) {
            await conn.query(`
                CREATE TABLE lojas (
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
            logger.info('   ✅ tabela lojas criada');
        } else {
            logger.info('   ⏭️  tabela lojas já existe, pulando');
        }

        // ---------------------------------------------------
        // 4. Adiciona loja_id em pallets
        // ---------------------------------------------------
        logger.info('📋 Verificando coluna loja_id em pallets...');
        const lojaIdExiste = await colunaExiste(conn, 'pallets', 'loja_id');
        if (!lojaIdExiste) {
            await conn.query(`
                ALTER TABLE pallets
                ADD COLUMN loja_id INT UNSIGNED NULL DEFAULT NULL
                AFTER id
            `);
            logger.info('   ✅ pallets.loja_id adicionada');
        } else {
            logger.info('   ⏭️  pallets.loja_id já existe, pulando');
        }

        // ---------------------------------------------------
        // 5. Adiciona FK de loja_id em pallets
        // ---------------------------------------------------
        logger.info('📋 Verificando FK fk_pallets_loja...');
        const fkLojaExiste = await fkExiste(conn, 'pallets', 'fk_pallets_loja');
        if (!fkLojaExiste) {
            await conn.query(`
                ALTER TABLE pallets
                ADD CONSTRAINT fk_pallets_loja
                    FOREIGN KEY (loja_id)
                    REFERENCES lojas(id)
                    ON DELETE SET NULL
                    ON UPDATE CASCADE
            `);
            logger.info('   ✅ FK fk_pallets_loja criada');
        } else {
            logger.info('   ⏭️  FK fk_pallets_loja já existe, pulando');
        }

        // ---------------------------------------------------
        // 6. Índice para loja_id
        // ---------------------------------------------------
        logger.info('📋 Verificando índice idx_pallets_loja_id...');
        const idxExiste = await indiceExiste(
            conn, 'pallets', 'idx_pallets_loja_id'
        );
        if (!idxExiste) {
            await conn.query(`
                CREATE INDEX idx_pallets_loja_id ON pallets(loja_id)
            `);
            logger.info('   ✅ índice idx_pallets_loja_id criado');
        } else {
            logger.info('   ⏭️  índice já existe, pulando');
        }

        logger.info('\n✅ Migração V2 concluída com sucesso!');

    } catch (error) {
        logger.error(`❌ Erro: ${error.message}`);
        throw error;
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

migrateV2().catch(() => process.exit(1));