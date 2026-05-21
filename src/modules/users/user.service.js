const bcrypt           = require('bcryptjs');
const { query }        = require('../../config/database');
const { AppError }     = require('../../middleware/error.middleware');
const { registrarLog } = require('../auth/auth.service');
const logger           = require('../../utils/logger');

async function listarUsuarios(filtros) {
    const { busca, cargo, ativo, setor, page, limit, order_by, order } = filtros;

    const conditions = [];
    const params     = [];

    if (busca) {
        conditions.push('(nome LIKE ? OR email LIKE ?)');
        const termo = `%${busca}%`;
        params.push(termo, termo);
    }
    if (cargo) { conditions.push('cargo = ?'); params.push(cargo); }
    if (ativo !== undefined) {
        conditions.push('ativo = ?');
        params.push(ativo === 'true' ? 1 : 0);
    }
    if (setor) { conditions.push('setor = ?'); params.push(setor); }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedOrderBy = {
        'nome': 'nome', 'email': 'email',
        'cargo': 'cargo', 'criado_em': 'criado_em',
    };
    const orderByColumn = allowedOrderBy[order_by] || 'criado_em';
    const orderDir      = order === 'desc' ? 'DESC' : 'ASC';

    const countRows = await query(
        `SELECT COUNT(*) AS total FROM users ${whereClause}`, params
    );
    const total = parseInt(countRows[0].total);
    const offset = (page - 1) * limit;

    const usuarios = await query(
        `SELECT id, nome, email, cargo, setor, ativo, criado_em, atualizado_em
         FROM users ${whereClause}
         ORDER BY ${orderByColumn} ${orderDir}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return { usuarios: usuarios.map(formatUser), pagination: { total, page, limit } };
}

async function buscarUsuarioPorId(id) {
    const rows = await query(
        `SELECT id, nome, email, cargo, setor, ativo, criado_em, atualizado_em
         FROM users WHERE id = ? LIMIT 1`,
        [id]
    );
    if (!rows[0]) {
        throw new AppError(`Usuário ID ${id} não encontrado.`, 404, 'USER_NOT_FOUND');
    }
    return formatUser(rows[0]);
}

async function criarUsuario(dados, adminId, ipAddress) {
    const { nome, email, senha, cargo, setor } = dados;

    const existing = await query(
        'SELECT id FROM users WHERE email = ? LIMIT 1', [email]
    );
    if (existing.length > 0) {
        throw new AppError(
            'Este e-mail já está cadastrado no sistema.', 409, 'EMAIL_ALREADY_EXISTS'
        );
    }

    const rounds    = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const senhaHash = await bcrypt.hash(senha, rounds);

    const result = await query(
        `INSERT INTO users (nome, email, senha_hash, cargo, setor)
         VALUES (?, ?, ?, ?, ?)`,
        [nome, email.toLowerCase(), senhaHash, cargo, setor || null]
    );

    const novoUsuario = await buscarUsuarioPorId(result.insertId);

    await registrarLog({
        usuarioId:   adminId,
        acao:        'CRIAR_USUARIO',
        descricao:   `Usuário criado: ${email} | Cargo: ${cargo} | Setor: ${setor || 'N/A'}`,
        dadosDepois: { id: novoUsuario.id, nome, email, cargo, setor },
        ipAddress,
    });

    logger.info(`👤 Usuário criado: ${email} (${cargo}) | Admin: ${adminId}`);
    return novoUsuario;
}

async function editarUsuario(id, dados, adminId, ipAddress) {
    const usuarioAntes = await buscarUsuarioPorId(id);

    if (id === adminId && dados.ativo === false) {
        throw new AppError('Você não pode desativar a sua própria conta.', 400, 'CANNOT_DEACTIVATE_SELF');
    }
    if (id === adminId && dados.cargo && dados.cargo !== 'ADMIN') {
        throw new AppError('Você não pode alterar o seu próprio cargo.', 400, 'CANNOT_CHANGE_OWN_ROLE');
    }
    if (dados.email) {
        const emailExists = await query(
            'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
            [dados.email, id]
        );
        if (emailExists.length > 0) {
            throw new AppError(
                'Este e-mail já está em uso por outro usuário.', 409, 'EMAIL_ALREADY_EXISTS'
            );
        }
    }

    const campos = [];
    const params = [];

    if (dados.nome  !== undefined) { campos.push('nome = ?');  params.push(dados.nome); }
    if (dados.email !== undefined) { campos.push('email = ?'); params.push(dados.email.toLowerCase()); }
    if (dados.cargo !== undefined) { campos.push('cargo = ?'); params.push(dados.cargo); }
    if (dados.ativo !== undefined) { campos.push('ativo = ?'); params.push(dados.ativo ? 1 : 0); }
    if (dados.setor !== undefined) { campos.push('setor = ?'); params.push(dados.setor || null); }

    params.push(id);
    await query(`UPDATE users SET ${campos.join(', ')} WHERE id = ?`, params);

    const usuarioDepois = await buscarUsuarioPorId(id);

    await registrarLog({
        usuarioId:   adminId,
        acao:        'EDITAR_USUARIO',
        descricao:   `Usuário ID ${id} editado.`,
        dadosAntes:  usuarioAntes,
        dadosDepois: usuarioDepois,
        ipAddress,
    });

    logger.info(`✏️ Usuário editado: ID ${id} | Admin: ${adminId}`);
    return usuarioDepois;
}

async function excluirUsuario(id, adminId, ipAddress) {
    if (id === adminId) {
        throw new AppError('Você não pode excluir a sua própria conta.', 400, 'CANNOT_DELETE_SELF');
    }
    const usuario = await buscarUsuarioPorId(id);
    if (!usuario.ativo) {
        throw new AppError('Usuário já está inativo.', 400, 'USER_ALREADY_INACTIVE');
    }
    await query('UPDATE users SET ativo = 0 WHERE id = ?', [id]);
    await registrarLog({
        usuarioId:  adminId,
        acao:       'EXCLUIR_USUARIO',
        descricao:  `Usuário ID ${id} desativado. E-mail: ${usuario.email}`,
        dadosAntes: usuario,
        ipAddress,
    });
    logger.info(`🗑️ Usuário desativado: ID ${id} | Admin: ${adminId}`);
    return { message: `Usuário ${usuario.nome} desativado com sucesso.` };
}

async function reativarUsuario(id, adminId, ipAddress) {
    const usuario = await buscarUsuarioPorId(id);
    if (usuario.ativo) {
        throw new AppError('Usuário já está ativo.', 400, 'USER_ALREADY_ACTIVE');
    }
    await query('UPDATE users SET ativo = 1 WHERE id = ?', [id]);
    const usuarioAtualizado = await buscarUsuarioPorId(id);
    await registrarLog({
        usuarioId:   adminId,
        acao:        'EDITAR_USUARIO',
        descricao:   `Usuário ID ${id} reativado.`,
        dadosAntes:  usuario,
        dadosDepois: usuarioAtualizado,
        ipAddress,
    });
    return usuarioAtualizado;
}

async function alterarSenha(userId, senhaAtual, novaSenha, ipAddress) {
    const rows = await query(
        'SELECT id, nome, email, senha_hash FROM users WHERE id = ? LIMIT 1', [userId]
    );
    const usuario = rows[0];
    if (!usuario) {
        throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }
    const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha_hash);
    if (!senhaCorreta) {
        throw new AppError('Senha atual incorreta.', 401, 'WRONG_CURRENT_PASSWORD');
    }
    const mesmaSenha = await bcrypt.compare(novaSenha, usuario.senha_hash);
    if (mesmaSenha) {
        throw new AppError('A nova senha não pode ser igual à senha atual.', 400, 'SAME_PASSWORD');
    }
    const rounds   = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const novoHash = await bcrypt.hash(novaSenha, rounds);
    await query('UPDATE users SET senha_hash = ? WHERE id = ?', [novoHash, userId]);
    await registrarLog({
        usuarioId: userId,
        acao:      'EDITAR_USUARIO',
        descricao: `Senha alterada pelo próprio usuário: ${usuario.email}`,
        ipAddress,
    });
    return { message: 'Senha alterada com sucesso.' };
}

async function estatisticasUsuarios() {
    const [totais] = await query(`
        SELECT
            COUNT(*)                    AS total,
            SUM(ativo = 1)              AS ativos,
            SUM(ativo = 0)              AS inativos,
            SUM(cargo = 'ADMIN')        AS admins,
            SUM(cargo = 'OPERADOR')     AS operadores,
            SUM(cargo = 'VISUALIZADOR') AS visualizadores,
            SUM(setor = 'FRIOS')        AS frios,
            SUM(setor = 'SECOS')        AS secos
        FROM users
    `);
    return {
        total:          parseInt(totais.total)          || 0,
        ativos:         parseInt(totais.ativos)         || 0,
        inativos:       parseInt(totais.inativos)       || 0,
        admins:         parseInt(totais.admins)         || 0,
        operadores:     parseInt(totais.operadores)     || 0,
        visualizadores: parseInt(totais.visualizadores) || 0,
        frios:          parseInt(totais.frios)          || 0,
        secos:          parseInt(totais.secos)          || 0,
    };
}

function formatUser(row) {
    return {
        id:            row.id,
        nome:          row.nome,
        email:         row.email,
        cargo:         row.cargo,
        setor:         row.setor,
        ativo:         row.ativo === 1 || row.ativo === true,
        criado_em:     row.criado_em,
        atualizado_em: row.atualizado_em,
    };
}

module.exports = {
    listarUsuarios,
    buscarUsuarioPorId,
    criarUsuario,
    editarUsuario,
    excluirUsuario,
    reativarUsuario,
    alterarSenha,
    estatisticasUsuarios,
};