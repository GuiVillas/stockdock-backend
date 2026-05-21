const { query, withTransaction } = require('../../config/database');
const { AppError }               = require('../../middleware/error.middleware');
const { registrarLog }           = require('../auth/auth.service');
const logger                     = require('../../utils/logger');

async function listarPallets(filtros, usuarioRequisitante) {
    const {
        loja, carga, placa, sobra, setor,
        usuario_id, data_inicio, data_fim,
        busca, page, limit, order_by, order,
    } = filtros;

    const conditions = [];
    const params     = [];

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
    if (setor) {
        conditions.push('p.setor = ?');
        params.push(setor);
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

    const allowedOrderBy = {
        'data_registro': 'p.data_registro',
        'loja_numero':   'p.loja_numero',
        'carga_numero':  'p.carga_numero',
        'quantidade':    'p.quantidade',
        'criado_em':     'p.criado_em',
    };
    const orderByColumn = allowedOrderBy[order_by] || 'p.criado_em';
    const orderDir      = order === 'asc' ? 'ASC' : 'DESC';

    const countRows = await query(
        `SELECT COUNT(*) AS total FROM pallets p ${whereClause}`,
        params
    );
    const total = parseInt(countRows[0].total);

    const offset = (page - 1) * limit;

    const pallets = await query(
        `SELECT
            p.id, p.loja_id, p.loja_numero, p.box_numero,
            p.carga_numero, p.quantidade, p.data_registro,
            p.placa_caminhao, p.sobra_status, p.setor,
            p.criado_em, p.atualizado_em,
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

    return {
        pallets: pallets.map(formatPallet),
        pagination: { total, page, limit },
    };
}

async function buscarPalletPorId(id) {
    const rows = await query(
        `SELECT
            p.id, p.loja_id, p.loja_numero, p.box_numero,
            p.carga_numero, p.quantidade, p.data_registro,
            p.placa_caminhao, p.sobra_status, p.setor,
            p.criado_em, p.atualizado_em,
            u.id    AS usuario_id,
            u.nome  AS usuario_nome,
            u.email AS usuario_email
         FROM pallets p
         INNER JOIN users u ON u.id = p.criado_por
         WHERE p.id = ? LIMIT 1`,
        [id]
    );
    if (!rows[0]) {
        throw new AppError(
            `Pallet ID ${id} não encontrado.`, 404, 'PALLET_NOT_FOUND'
        );
    }
    return formatPallet(rows[0]);
}

async function criarPallet(dados, usuarioId, ipAddress) {
    const {
        loja_id, loja_numero, box_numero, carga_numero,
        quantidade, data_registro, placa_caminhao,
        sobra_status, setor,
    } = dados;

    const result = await query(
        `INSERT INTO pallets
            (loja_id, loja_numero, box_numero, carga_numero,
             quantidade, data_registro, placa_caminhao,
             sobra_status, setor, criado_por)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            loja_id || null,
            loja_numero,
            box_numero,
            carga_numero,
            quantidade,
            data_registro,
            placa_caminhao.toUpperCase(),
            sobra_status ? 1 : 0,
            setor || 'SECOS',
            usuarioId,
        ]
    );

    const novoPallet = await buscarPalletPorId(result.insertId);

    await registrarLog({
        usuarioId,
        acao:        'CRIAR_PALLET',
        descricao:   `Pallet criado. Loja: ${loja_numero} | Carga: ${carga_numero} | Setor: ${setor}`,
        dadosDepois: novoPallet,
        ipAddress,
    });

    logger.info(`📦 Pallet criado: ID ${novoPallet.id} | Usuário: ${usuarioId}`);
    return novoPallet;
}

async function editarPallet(id, dados, usuarioId, ipAddress) {
    const palletAntes = await buscarPalletPorId(id);

    const campos = [];
    const params = [];

    if (dados.loja_id       !== undefined) { campos.push('loja_id = ?');       params.push(dados.loja_id || null); }
    if (dados.loja_numero   !== undefined) { campos.push('loja_numero = ?');   params.push(dados.loja_numero); }
    if (dados.box_numero    !== undefined) { campos.push('box_numero = ?');    params.push(dados.box_numero); }
    if (dados.carga_numero  !== undefined) { campos.push('carga_numero = ?');  params.push(dados.carga_numero); }
    if (dados.quantidade    !== undefined) { campos.push('quantidade = ?');    params.push(dados.quantidade); }
    if (dados.data_registro !== undefined) { campos.push('data_registro = ?'); params.push(dados.data_registro); }
    if (dados.placa_caminhao!== undefined) { campos.push('placa_caminhao = ?');params.push(dados.placa_caminhao.toUpperCase()); }
    if (dados.sobra_status  !== undefined) { campos.push('sobra_status = ?');  params.push(dados.sobra_status ? 1 : 0); }
    if (dados.setor         !== undefined) { campos.push('setor = ?');         params.push(dados.setor); }

    params.push(id);
    await query(`UPDATE pallets SET ${campos.join(', ')} WHERE id = ?`, params);

    const palletDepois = await buscarPalletPorId(id);

    await registrarLog({
        usuarioId,
        acao:        'EDITAR_PALLET',
        descricao:   `Pallet ID ${id} editado.`,
        dadosAntes:  palletAntes,
        dadosDepois: palletDepois,
        ipAddress,
    });

    logger.info(`✏️ Pallet editado: ID ${id} | Usuário: ${usuarioId}`);
    return palletDepois;
}

async function excluirPallet(id, usuarioId, ipAddress) {
    const pallet = await buscarPalletPorId(id);
    await query('DELETE FROM pallets WHERE id = ?', [id]);

    await registrarLog({
        usuarioId,
        acao:       'EXCLUIR_PALLET',
        descricao:  `Pallet ID ${id} excluído.`,
        dadosAntes: pallet,
        ipAddress,
    });

    logger.info(`🗑️ Pallet excluído: ID ${id} | Usuário: ${usuarioId}`);
    return { message: `Pallet ID ${id} excluído com sucesso.` };
}

async function estatisticas() {
    const [totais] = await query(`
        SELECT
            COUNT(*)                       AS total_registros,
            SUM(quantidade)                AS total_pallets,
            SUM(sobra_status = 1)          AS total_sobras,
            COUNT(DISTINCT loja_numero)    AS total_lojas,
            COUNT(DISTINCT placa_caminhao) AS total_caminhoes
        FROM pallets
    `);
    const hoje = new Date().toISOString().split('T')[0];
    const [hoje_row] = await query(
        `SELECT COUNT(*) AS registros_hoje, SUM(quantidade) AS pallets_hoje
         FROM pallets WHERE data_registro = ?`,
        [hoje]
    );
    const topLojas = await query(`
        SELECT loja_numero, SUM(quantidade) AS total
        FROM pallets
        GROUP BY loja_numero
        ORDER BY total DESC
        LIMIT 5
    `);

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

function formatPallet(row) {
    return {
        id:             row.id,
        loja_id:        row.loja_id,
        loja_numero:    row.loja_numero,
        box_numero:     row.box_numero,
        carga_numero:   row.carga_numero,
        quantidade:     row.quantidade,
        data_registro:  row.data_registro,
        placa_caminhao: row.placa_caminhao,
        sobra_status:   row.sobra_status === 1 || row.sobra_status === true,
        setor:          row.setor,
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