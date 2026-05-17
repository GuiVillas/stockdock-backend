/**
 * StockDock - Script de Migração do Banco de Dados
 * 
 * Cria todas as tabelas necessárias para o sistema.
 * Execute com: npm run db:migrate
 * 
 * ATENÇÃO: Seguro para rodar múltiplas vezes.
 * Usa IF NOT EXISTS em todas as tabelas.
 */

require('dotenv').config();

const { pool } = require('./database');
const logger   = require('../utils/logger');

// ---------------------------------------------------
// Definição das tabelas em ordem de dependência
// (users antes de pallets e logs, pois são referenciados)
// ---------------------------------------------------

const CREATE_USERS_TABLE = `
    CREATE TABLE IF NOT EXISTS users (
        id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        nome          VARCHAR(120)    NOT NULL,
        email         VARCHAR(180)    NOT NULL,
        senha_hash    VARCHAR(255)    NOT NULL,
        cargo         ENUM('ADMIN','OPERADOR','VISUALIZADOR') NOT NULL DEFAULT 'VISUALIZADOR',
        ativo         TINYINT(1)      NOT NULL DEFAULT 1,
        criado_em     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        UNIQUE KEY  uq_users_email (email),
        INDEX       idx_users_cargo (cargo),
        INDEX       idx_users_ativo (ativo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const CREATE_PALLETS_TABLE = `
    CREATE TABLE IF NOT EXISTS pallets (
        id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        loja_numero      VARCHAR(20)     NOT NULL,
        box_numero       VARCHAR(20)     NOT NULL,
        carga_numero     VARCHAR(30)     NOT NULL,
        quantidade       INT UNSIGNED    NOT NULL DEFAULT 0,
        data_registro    DATE            NOT NULL,
        placa_caminhao   VARCHAR(15)     NOT NULL,
        sobra_status     TINYINT(1)      NOT NULL DEFAULT 0,
        criado_por       INT UNSIGNED    NOT NULL,
        criado_em        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        -- Chave estrangeira para users
        CONSTRAINT fk_pallets_usuario
            FOREIGN KEY (criado_por)
            REFERENCES users(id)
            ON DELETE RESTRICT
            ON UPDATE CASCADE,

        -- Índices para os filtros mais usados
        INDEX idx_pallets_loja       (loja_numero),
        INDEX idx_pallets_data       (data_registro),
        INDEX idx_pallets_carga      (carga_numero),
        INDEX idx_pallets_placa      (placa_caminhao),
        INDEX idx_pallets_sobra      (sobra_status),
        INDEX idx_pallets_criado_por (criado_por),

        -- Índice composto para relatórios por loja+data (query mais comum)
        INDEX idx_pallets_loja_data  (loja_numero, data_registro)

    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const CREATE_LOGS_TABLE = `
    CREATE TABLE IF NOT EXISTS logs (
        id           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
        usuario_id   INT UNSIGNED    NOT NULL,
        acao         ENUM(
                        'LOGIN',
                        'LOGOUT',
                        'CRIAR_PALLET',
                        'EDITAR_PALLET',
                        'EXCLUIR_PALLET',
                        'GERAR_PDF',
                        'CRIAR_USUARIO',
                        'EDITAR_USUARIO',
                        'EXCLUIR_USUARIO'
                     ) NOT NULL,
        descricao    TEXT            NULL,
        dados_antes  JSON            NULL,
        dados_depois JSON            NULL,
        ip_address   VARCHAR(45)     NULL,
        data_hora    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

        PRIMARY KEY (id),

        -- Chave estrangeira para users
        CONSTRAINT fk_logs_usuario
            FOREIGN KEY (usuario_id)
            REFERENCES users(id)
            ON DELETE RESTRICT
            ON UPDATE CASCADE,

        -- Índices para consultas de auditoria
        INDEX idx_logs_usuario  (usuario_id),
        INDEX idx_logs_acao     (acao),
        INDEX idx_logs_data     (data_hora),

        -- Índice composto para filtro por usuário + período
        INDEX idx_logs_usuario_data (usuario_id, data_hora)

    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// ---------------------------------------------------
// Função principal de migração
// ---------------------------------------------------
async function migrate() {
    let conn;
    try {
        conn = await pool.getConnection();
        logger.info('🚀 Iniciando migração do banco de dados...\n');

        // Garante que foreign key checks estão ativos
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');

        // Cria tabelas em ordem
        logger.info('📋 Criando tabela: users');
        await conn.query(CREATE_USERS_TABLE);
        logger.info('   ✅ users OK');

        logger.info('📋 Criando tabela: pallets');
        await conn.query(CREATE_PALLETS_TABLE);
        logger.info('   ✅ pallets OK');

        logger.info('📋 Criando tabela: logs');
        await conn.query(CREATE_LOGS_TABLE);
        logger.info('   ✅ logs OK');

        // Confirma estrutura criada
        const [tables] = await conn.query('SHOW TABLES');
        const tableNames = tables.map(t => Object.values(t)[0]);

        logger.info('\n✅ Migração concluída com sucesso!');
        logger.info(`   Tabelas no banco: ${tableNames.join(', ')}`);

    } catch (error) {
        logger.error(`❌ Erro na migração: ${error.message}`);
        throw error;
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

migrate().catch(() => process.exit(1));