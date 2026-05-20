/**
 * StockDock - Pallet Service
 *
 * Responsabilidade: todas as regras de negócio
 * relacionadas a pallets.
 * Inclui: CRUD completo, filtros, paginação e logs.
 */

const { query, withTransaction } = require('../../config/database');
const { AppError }               = require('../../middleware/error.middleware');
const { registrarLog }           = require('../auth/auth.service');
const logger                     = require('../../utils/logger');

// ---------------------------------------------------
// LISTAR pallets com filtros e paginação
// ---------------------------------------------------
async function listarPallets(filtros, usuarioRequisitante) {
    const {
        loja, carga, placa, sobra,
        usuario_id, data_inicio, data_fim,
        busca, page, limit, order_by, order,
    } = filtros;

    // ---------------------------------------------------
    // Monta a query dinamicamente conforme os filtros
    // Usa array de condições para evitar SQL Injection
    // ---------------------------------------------------
    const conditions = [];  // cláusulas WHERE
    const params     = [];  // valores dos placeholders

    if (loja) {
        conditions.push('p.loja_numero LIKE ?');
        params.push(`%${loja}%`);
    }

    if (carga) {
        conditions.push('p.carga_numero LIKE ?');
        params.push(`%${carga}%`);
    }

    if (placa) {
        conditions.push('p.placa_caminhao LIKE ?');
        params.push(`%${placa}%`);
    }

    if (sobra !== undefined) {
        conditions.push('p.sobra_status = ?');
        params.push(sobra === 'true' ? 1 : 0);
    }

    if (usuario_id) {
        conditions.push('p.criado_por = ?');
        params.push(usuario_id);
    }

    if (data_inicio) {
        conditions.push('p.data_registro >= ?');
        params.push(data_inicio);
    }

    if (data_fim) {
        conditions.push('p.data_registro <= ?');
        params.push(data_fim);
    }

    // Filtro por setor (FRIOS ou SECOS)
    if (filtros.setor) {
        conditions.push('p.setor = ?');
        params.push(filtros.setor);
    }

    // Filtro por usuário (para relatório pessoal)
    if (filtros.usuario_id) {
        conditions.push('p.criado_por = ?');
        params.push(filtros.usuario_id);
    }

    // Busca geral: procura em loja, carga e placa ao mesmo tempo
    if (busca) {
        conditions.push(`(
            p.loja_numero    LIKE ? OR
            p.carga_numero   LIKE ? OR
            p.placa_caminhao LIKE ? OR
            p.box_numero     LIKE ?
        )`);
        const termo = `%${busca}%`;
        params.push(termo, termo, termo, termo);
    }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    // ---------------------------------------------------
    // Colunas permitidas para ordenação (whitelist)
    // Evita SQL Injection via parâmetro order_by
    // ---------------------------------------------------
    const allowedOrderBy = {
        'data_registro': 'p.data_registro',
        'loja_numero':   'p.loja_numero',
        'carga_numero':  'p.carga_numero',
        'quantidade':    'p.quantidade',
        'criado_em':     'p.criado_em',
    };

    const orderByColumn = allowedOrderBy[order_by] || 'p.criado_em';
    const orderDir      = order === 'asc' ? 'ASC' : 'DESC';

    // ---------------------------------------------------
    // Query de contagem total (para paginação)
    // ---------------------------------------------------
    const countRows = await query(
        `SELECT COUNT(*) AS total
         FROM pallets p
         ${whereClause}`,
        params
    );
    const total = parseInt(countRows[0].total);

    // ---------------------------------------------------
    // Query principal com JOIN para trazer nome do usuário
    // LIMIT e OFFSET para paginação
    // ---------------------------------------------------
    const offset = (page - 1) * limit;

    const pallets = await query(
        `SELECT
            p.id,
            p.loja_numero,
            p.box_numero,
            p.carga_numero,
            p.quantidade,
            p.data_registro,
            p.placa_caminhao,
            p.sobra_status,
            p.criado_em,
            p.atualizado_em,
            u.id    AS usuario_id,
            u.nome  AS usuario_nome,
            u.email AS usuario_email
         FROM pallets p
         INNER JOIN users u ON u.id = p.criado_por
         ${whereClause}
         ORDER BY ${orderByColumn} ${orderDir}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    // Formata os dados para o padrão do app
    const formatted = pallets.map(formatPallet);

    return {
        pallets: formatted,
        pagination: { total, page, limit },
    };
}

// ---------------------------------------------------
// BUSCAR pallet por ID
// ---------------------------------------------------
async function buscarPalletPorId(id) {
    const rows = await query(
        `SELECT
            p.id,
            p.loja_numero,
            p.box_numero,
            p.carga_numero,
            p.quantidade,
            p.data_registro,
            p.placa_caminhao,
            p.sobra_status,
            p.criado_em,
            p.atualizado_em,
            u.id    AS usuario_id,
            u.nome  AS usuario_nome,
            u.email AS usuario_email
         FROM pallets p
         INNER JOIN users u ON u.id = p.criado_por
         WHERE p.id = ?
         LIMIT 1`,
        [id]
    );

    if (!rows[0]) {
        throw new AppError(
            `Pallet ID ${id} não encontrado.`,
            404,
            'PALLET_NOT_FOUND'
        );
    }

    return formatPallet(rows[0]);
}

// ---------------------------------------------------
// CRIAR pallet
// ---------------------------------------------------
async function criarPallet(dados, usuarioId, ipAddress) {
    const {
        loja_numero, box_numero, carga_numero,
        quantidade, data_registro, placa_caminhao,
        sobra_status,
    } = dados;

    // Insere o pallet no banco
    const result = await query(
        `INSERT INTO pallets
            (loja_id, loja_numero, box_numero, carga_numero,
            quantidade, data_registro, placa_caminhao,
            sobra_status, setor, criado_por)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            dados.loja_id || null,
            dados.loja_numero,
            dados.box_numero,
            dados.carga_numero,
            dados.quantidade,
            dados.data_registro,
            dados.placa_caminhao.toUpperCase(),
            dados.sobra_status ? 1 : 0,
            dados.setor || 'SECOS',
            usuarioId,
        ]
    );

    const novoPallet = await buscarPalletPorId(result.insertId);

    // Registra log de auditoria
    await registrarLog({
        usuarioId,
        acao:        'CRIAR_PALLET',
        descricao:   `Pallet criado. Loja: ${loja_numero} | Carga: ${carga_numero} | Qtd: ${quantidade}`,
        dadosDepois: novoPallet,
        ipAddress,
    });

    logger.info(`📦 Pallet criado: ID ${novoPallet.id} | Usuário: ${usuarioId}`);

    return novoPallet;
}

// ---------------------------------------------------
// EDITAR pallet
// ---------------------------------------------------
async function editarPallet(id, dados, usuarioId, ipAddress) {
    // 1. Verifica se o pallet existe e salva estado anterior
    const palletAntes = await buscarPalletPorId(id);

    // 2. Monta os campos a atualizar dinamicamente
    const campos = [];
    const params = [];

    if (dados.loja_numero !== undefined) {
        campos.push('loja_numero = ?');
        params.push(dados.loja_numero);
    }
    if (dados.box_numero !== undefined) {
        campos.push('box_numero = ?');
        params.push(dados.box_numero);
    }
    if (dados.carga_numero !== undefined) {
        campos.push('carga_numero = ?');
        params.push(dados.carga_numero);
    }
    if (dados.quantidade !== undefined) {
        campos.push('quantidade = ?');
        params.push(dados.quantidade);
    }
    if (dados.data_registro !== undefined) {
        campos.push('data_registro = ?');
        params.push(dados.data_registro);
    }
    if (dados.placa_caminhao !== undefined) {
        campos.push('placa_caminhao = ?');
        params.push(dados.placa_caminhao.toUpperCase());
    }
    if (dados.sobra_status !== undefined) {
        campos.push('sobra_status = ?');
        params.push(dados.sobra_status ? 1 : 0);
    }

    // Adiciona o ID no final para o WHERE
    params.push(id);

    // 3. Executa o UPDATE
    await query(
        `UPDATE pallets SET ${campos.join(', ')} WHERE id = ?`,
        params
    );

    // 4. Busca o pallet atualizado
    const palletDepois = await buscarPalletPorId(id);

    // 5. Registra log com snapshot antes/depois
    await registrarLog({
        usuarioId,
        acao:        'EDITAR_PALLET',
        descricao:   `Pallet ID ${id} editado.`,
        dadosAntes:  palletAntes,
        dadosDepois: palletDepois,
        ipAddress,
    });

    logger.info(`✏️  Pallet editado: ID ${id} | Usuário: ${usuarioId}`);

    return palletDepois;
}

// ---------------------------------------------------
// EXCLUIR pallet
// ---------------------------------------------------
async function excluirPallet(id, usuarioId, ipAddress) {
    // 1. Verifica se o pallet existe
    const pallet = await buscarPalletPorId(id);

    // 2. Exclui do banco
    await query('DELETE FROM pallets WHERE id = ?', [id]);

    // 3. Registra log com snapshot do que foi excluído
    await registrarLog({
        usuarioId,
        acao:       'EXCLUIR_PALLET',
        descricao:  `Pallet ID ${id} excluído. Loja: ${pallet.loja_numero} | Carga: ${pallet.carga_numero}`,
        dadosAntes: pallet,
        ipAddress,
    });

    logger.info(`🗑️  Pallet excluído: ID ${id} | Usuário: ${usuarioId}`);

    return { message: `Pallet ID ${id} excluído com sucesso.` };
}

// ---------------------------------------------------
// ESTATÍSTICAS para o Dashboard
// ---------------------------------------------------
async function estatisticas() {
    const [totais] = await query(
        `SELECT
            COUNT(*)                        AS total_registros,
            SUM(quantidade)                 AS total_pallets,
            SUM(sobra_status = 1)           AS total_sobras,
            COUNT(DISTINCT loja_numero)     AS total_lojas,
            COUNT(DISTINCT placa_caminhao)  AS total_caminhoes
         FROM pallets`
    );

    const hoje = new Date().toISOString().split('T')[0];
    const [hoje_row] = await query(
        `SELECT
            COUNT(*)       AS registros_hoje,
            SUM(quantidade) AS pallets_hoje
         FROM pallets
         WHERE data_registro = ?`,
        [hoje]
    );

    // Top 5 lojas por quantidade de pallets
    const topLojas = await query(
        `SELECT
            loja_numero,
            SUM(quantidade) AS total
         FROM pallets
         GROUP BY loja_numero
         ORDER BY total DESC
         LIMIT 5`
    );

    return {
        total_registros:  parseInt(totais.total_registros)  || 0,
        total_pallets:    parseInt(totais.total_pallets)     || 0,
        total_sobras:     parseInt(totais.total_sobras)      || 0,
        total_lojas:      parseInt(totais.total_lojas)       || 0,
        total_caminhoes:  parseInt(totais.total_caminhoes)   || 0,
        registros_hoje:   parseInt(hoje_row.registros_hoje)  || 0,
        pallets_hoje:     parseInt(hoje_row.pallets_hoje)    || 0,
        top_lojas:        topLojas,
    };
}

// ---------------------------------------------------
// Helper: formata pallet para resposta padronizada
// Converte tipos do MySQL para o formato do app
// ---------------------------------------------------
function formatPallet(row) {
    return {
        id:             row.id,
        loja_numero:    row.loja_numero,
        box_numero:     row.box_numero,
        carga_numero:   row.carga_numero,
        quantidade:     row.quantidade,
        data_registro:  row.data_registro,
        placa_caminhao: row.placa_caminhao,
        // MySQL retorna TINYINT como 0/1 — convertemos para boolean
        sobra_status:   row.sobra_status === 1 || row.sobra_status === true,
        criado_em:      row.criado_em,
        atualizado_em:  row.atualizado_em,
        criado_por: {
            id:    row.usuario_id,
            nome:  row.usuario_nome,
            email: row.usuario_email,
        },
    };
}

module.exports = {
    listarPallets,
    buscarPalletPorId,
    criarPallet,
    editarPallet,
    excluirPallet,
    estatisticas,
};