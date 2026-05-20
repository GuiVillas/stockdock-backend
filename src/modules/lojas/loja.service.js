const { query }          = require('../../config/database');
const { AppError }       = require('../../middleware/error.middleware');
const { registrarLog }   = require('../auth/auth.service');

// ---------------------------------------------------
// LISTAR todas as lojas ativas
// ---------------------------------------------------
async function listarLojas(apenasAtivas = true) {
    const where = apenasAtivas ? 'WHERE ativo = 1' : '';
    const lojas = await query(
        `SELECT l.id, l.nome, l.numero, l.ativo,
                l.criado_em, u.nome AS criado_por_nome
         FROM lojas l
         INNER JOIN users u ON u.id = l.criado_por
         ${where}
         ORDER BY l.numero ASC`
    );
    return lojas;
}

// ---------------------------------------------------
// CRIAR loja
// ---------------------------------------------------
async function criarLoja(dados, adminId, ipAddress) {
    const { nome, numero } = dados;

    const existing = await query(
        'SELECT id FROM lojas WHERE numero = ? LIMIT 1', [numero]
    );
    if (existing.length > 0) {
        throw new AppError(
            'Já existe uma loja com este número.',
            409, 'LOJA_ALREADY_EXISTS'
        );
    }

    const result = await query(
        'INSERT INTO lojas (nome, numero, criado_por) VALUES (?, ?, ?)',
        [nome, numero, adminId]
    );

    const loja = await buscarLojaPorId(result.insertId);

    await registrarLog({
        usuarioId:   adminId,
        acao:        'CRIAR_USUARIO', // reutilizamos para loja
        descricao:   `Loja criada: ${numero} — ${nome}`,
        dadosDepois: loja,
        ipAddress,
    });

    return loja;
}

// ---------------------------------------------------
// EDITAR loja
// ---------------------------------------------------
async function editarLoja(id, dados, adminId, ipAddress) {
    const lojaAntes = await buscarLojaPorId(id);

    const campos = [];
    const params = [];

    if (dados.nome   !== undefined) { campos.push('nome = ?');   params.push(dados.nome); }
    if (dados.numero !== undefined) { campos.push('numero = ?'); params.push(dados.numero); }
    if (dados.ativo  !== undefined) { campos.push('ativo = ?');  params.push(dados.ativo ? 1 : 0); }

    params.push(id);
    await query(`UPDATE lojas SET ${campos.join(', ')} WHERE id = ?`, params);

    const lojaDepois = await buscarLojaPorId(id);

    await registrarLog({
        usuarioId:   adminId,
        acao:        'EDITAR_USUARIO',
        descricao:   `Loja editada: ${lojaDepois.numero}`,
        dadosAntes:  lojaAntes,
        dadosDepois: lojaDepois,
        ipAddress,
    });

    return lojaDepois;
}

// ---------------------------------------------------
// BUSCAR por ID
// ---------------------------------------------------
async function buscarLojaPorId(id) {
    const rows = await query(
        `SELECT l.id, l.nome, l.numero, l.ativo, l.criado_em,
                u.nome AS criado_por_nome
         FROM lojas l
         INNER JOIN users u ON u.id = l.criado_por
         WHERE l.id = ? LIMIT 1`,
        [id]
    );
    if (!rows[0]) {
        throw new AppError(`Loja ID ${id} não encontrada.`, 404, 'LOJA_NOT_FOUND');
    }
    return rows[0];
}

module.exports = { listarLojas, criarLoja, editarLoja, buscarLojaPorId };