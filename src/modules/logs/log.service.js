/**
 * StockDock - Log Service
 *
 * Responsabilidade: consultas de auditoria.
 *
 * Os logs são SEMPRE somente leitura via API.
 * A gravação é feita internamente pelo registrarLog()
 * no auth.service.js — reutilizado por todos os módulos.
 *
 * Funcionalidades:
 *   - Listar logs com filtros e paginação
 *   - Buscar log por ID (com snapshot antes/depois)
 *   - Estatísticas de auditoria
 *   - Resumo de atividade por usuário
 */

const { query }    = require('../../config/database');
const { AppError } = require('../../middleware/error.middleware');

// ---------------------------------------------------
// LISTAR logs com filtros e paginação
// ---------------------------------------------------
async function listarLogs(filtros) {
    const {
        usuario_id, acao, data_inicio,
        data_fim, busca, page, limit, order,
    } = filtros;

    const conditions = [];
    const params     = [];

    // Filtro por usuário
    if (usuario_id) {
        conditions.push('l.usuario_id = ?');
        params.push(usuario_id);
    }

    // Filtro por tipo de ação
    if (acao) {
        conditions.push('l.acao = ?');
        params.push(acao);
    }

    // Filtro por período — data_inicio
    if (data_inicio) {
        conditions.push('DATE(l.data_hora) >= ?');
        params.push(data_inicio);
    }

    // Filtro por período — data_fim
    if (data_fim) {
        conditions.push('DATE(l.data_hora) <= ?');
        params.push(data_fim);
    }

    // Busca na descrição do log
    if (busca) {
        conditions.push('l.descricao LIKE ?');
        params.push(`%${busca}%`);
    }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    const orderDir = order === 'asc' ? 'ASC' : 'DESC';

    // ---------------------------------------------------
    // Contagem total para paginação
    // ---------------------------------------------------
    const countRows = await query(
        `SELECT COUNT(*) AS total
         FROM logs l
         ${whereClause}`,
        params
    );
    const total = parseInt(countRows[0].total);

    // ---------------------------------------------------
    // Query principal com JOIN para nome do usuário
    // Não retorna dados_antes e dados_depois na listagem
    // (apenas no detalhe por ID) para economizar payload
    // ---------------------------------------------------
    const offset = (page - 1) * limit;

    const logs = await query(
        `SELECT
            l.id,
            l.acao,
            l.descricao,
            l.ip_address,
            l.data_hora,
            u.id    AS usuario_id,
            u.nome  AS usuario_nome,
            u.email AS usuario_email,
            u.cargo AS usuario_cargo
         FROM logs l
         INNER JOIN users u ON u.id = l.usuario_id
         ${whereClause}
         ORDER BY l.data_hora ${orderDir}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return {
        logs: logs.map(formatLog),
        pagination: { total, page, limit },
    };
}

// ---------------------------------------------------
// BUSCAR log por ID (inclui snapshot antes/depois)
// ---------------------------------------------------
async function buscarLogPorId(id) {
    const rows = await query(
        `SELECT
            l.id,
            l.acao,
            l.descricao,
            l.dados_antes,
            l.dados_depois,
            l.ip_address,
            l.data_hora,
            u.id    AS usuario_id,
            u.nome  AS usuario_nome,
            u.email AS usuario_email,
            u.cargo AS usuario_cargo
         FROM logs l
         INNER JOIN users u ON u.id = l.usuario_id
         WHERE l.id = ?
         LIMIT 1`,
        [id]
    );

    if (!rows[0]) {
        throw new AppError(
            `Log ID ${id} não encontrado.`,
            404,
            'LOG_NOT_FOUND'
        );
    }

    return formatLogDetalhado(rows[0]);
}

// ---------------------------------------------------
// ESTATÍSTICAS gerais de auditoria
// Usadas no dashboard do ADMIN
// ---------------------------------------------------
async function estatisticasLogs() {
    // Totais por tipo de ação
    const porAcao = await query(
        `SELECT acao, COUNT(*) AS total
         FROM logs
         GROUP BY acao
         ORDER BY total DESC`
    );

    // Totais de hoje
    const [hoje] = await query(
        `SELECT COUNT(*) AS total_hoje
         FROM logs
         WHERE DATE(data_hora) = CURDATE()`
    );

    // Totais dos últimos 7 dias (para gráfico)
    const ultimos7dias = await query(
        `SELECT
            DATE(data_hora)  AS data,
            COUNT(*)         AS total
         FROM logs
         WHERE data_hora >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
         GROUP BY DATE(data_hora)
         ORDER BY data ASC`
    );

    // Usuários mais ativos (top 5)
    const topUsuarios = await query(
        `SELECT
            u.id,
            u.nome,
            u.cargo,
            COUNT(l.id) AS total_acoes
         FROM logs l
         INNER JOIN users u ON u.id = l.usuario_id
         GROUP BY u.id, u.nome, u.cargo
         ORDER BY total_acoes DESC
         LIMIT 5`
    );

    // Total geral de logs
    const [totais] = await query(
        `SELECT COUNT(*) AS total FROM logs`
    );

    return {
        total_geral:   parseInt(totais.total)      || 0,
        total_hoje:    parseInt(hoje.total_hoje)    || 0,
        por_acao:      porAcao,
        ultimos_7dias: ultimos7dias,
        top_usuarios:  topUsuarios,
    };
}

// ---------------------------------------------------
// RESUMO de atividade de um usuário específico
// Útil para o ADMIN auditar um usuário em particular
// ---------------------------------------------------
async function resumoUsuario(usuarioId) {
    // Verifica se usuário existe
    const usuarios = await query(
        'SELECT id, nome, email, cargo FROM users WHERE id = ? LIMIT 1',
        [usuarioId]
    );

    if (!usuarios[0]) {
        throw new AppError(
            `Usuário ID ${usuarioId} não encontrado.`,
            404,
            'USER_NOT_FOUND'
        );
    }

    const usuario = usuarios[0];

    // Contagem de ações do usuário
    const acoes = await query(
        `SELECT acao, COUNT(*) AS total
         FROM logs
         WHERE usuario_id = ?
         GROUP BY acao
         ORDER BY total DESC`,
        [usuarioId]
    );

    // Último login
    const [ultimoLogin] = await query(
        `SELECT data_hora
         FROM logs
         WHERE usuario_id = ? AND acao = 'LOGIN'
         ORDER BY data_hora DESC
         LIMIT 1`,
        [usuarioId]
    );

    // Total de pallets criados pelo usuário
    const [palletsCriados] = await query(
        `SELECT COUNT(*) AS total
         FROM logs
         WHERE usuario_id = ? AND acao = 'CRIAR_PALLET'`,
        [usuarioId]
    );

    // Atividade dos últimos 30 dias
    const atividade30dias = await query(
        `SELECT
            DATE(data_hora) AS data,
            COUNT(*)        AS total
         FROM logs
         WHERE usuario_id = ?
           AND data_hora >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
         GROUP BY DATE(data_hora)
         ORDER BY data ASC`,
        [usuarioId]
    );

    return {
        usuario: {
            id:    usuario.id,
            nome:  usuario.nome,
            email: usuario.email,
            cargo: usuario.cargo,
        },
        resumo: {
            total_acoes:     acoes.reduce((sum, a) => sum + parseInt(a.total), 0),
            pallets_criados: parseInt(palletsCriados.total) || 0,
            ultimo_login:    ultimoLogin?.data_hora || null,
        },
        acoes_por_tipo:    acoes,
        atividade_30_dias: atividade30dias,
    };
}

// ---------------------------------------------------
// LOGS RECENTES — últimos N logs do sistema
// Usado no widget do dashboard
// ---------------------------------------------------
async function logsRecentes(limite = 10) {
    const logs = await query(
        `SELECT
            l.id,
            l.acao,
            l.descricao,
            l.data_hora,
            u.nome  AS usuario_nome,
            u.cargo AS usuario_cargo
         FROM logs l
         INNER JOIN users u ON u.id = l.usuario_id
         ORDER BY l.data_hora DESC
         LIMIT ?`,
        [limite]
    );

    return logs.map(formatLog);
}

// ---------------------------------------------------
// Helpers de formatação
// ---------------------------------------------------

// Formato resumido (para listagem)
function formatLog(row) {
    return {
        id:          row.id,
        acao:        row.acao,
        descricao:   row.descricao,
        ip_address:  row.ip_address,
        data_hora:   row.data_hora,
        usuario: {
            id:    row.usuario_id,
            nome:  row.usuario_nome,
            email: row.usuario_email,
            cargo: row.usuario_cargo,
        },
    };
}

// Formato completo com snapshots (para detalhe)
function formatLogDetalhado(row) {
    return {
        ...formatLog(row),
        // dados_antes e dados_depois vêm como string JSON do MySQL
        // precisamos fazer parse para retornar como objeto
        dados_antes:  row.dados_antes
            ? (typeof row.dados_antes === 'string'
                ? JSON.parse(row.dados_antes)
                : row.dados_antes)
            : null,
        dados_depois: row.dados_depois
            ? (typeof row.dados_depois === 'string'
                ? JSON.parse(row.dados_depois)
                : row.dados_depois)
            : null,
    };
}

module.exports = {
    listarLogs,
    buscarLogPorId,
    estatisticasLogs,
    resumoUsuario,
    logsRecentes,
};