/**
 * StockDock - User Service
 *
 * Responsabilidade: regras de negócio
 * relacionadas ao gerenciamento de usuários.
 *
 * Apenas ADMIN acessa este módulo,
 * exceto a troca de senha (próprio usuário).
 */

const bcrypt             = require('bcryptjs');
const { query }          = require('../../config/database');
const { AppError }       = require('../../middleware/error.middleware');
const { registrarLog }   = require('../auth/auth.service');
const logger             = require('../../utils/logger');

// ---------------------------------------------------
// LISTAR usuários com filtros e paginação
// ---------------------------------------------------
async function listarUsuarios(filtros) {
    const { busca, cargo, ativo, page, limit, order_by, order } = filtros;

    const conditions = [];
    const params     = [];

    // Filtro por busca (nome ou email)
    if (busca) {
        conditions.push('(nome LIKE ? OR email LIKE ?)');
        const termo = `%${busca}%`;
        params.push(termo, termo);
    }

    // Filtro por cargo
    if (cargo) {
        conditions.push('cargo = ?');
        params.push(cargo);
    }

    // Filtro por status ativo/inativo
    if (ativo !== undefined) {
        conditions.push('ativo = ?');
        params.push(ativo === 'true' ? 1 : 0);
    }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

    // Whitelist de colunas para ordenação
    const allowedOrderBy = {
        'nome':       'nome',
        'email':      'email',
        'cargo':      'cargo',
        'criado_em':  'criado_em',
    };

    const orderByColumn = allowedOrderBy[order_by] || 'criado_em';
    const orderDir      = order === 'desc' ? 'DESC' : 'ASC';

    // Contagem total para paginação
    const countRows = await query(
        `SELECT COUNT(*) AS total FROM users ${whereClause}`,
        params
    );
    const total = parseInt(countRows[0].total);

    // Query principal
    const offset  = (page - 1) * limit;

    const usuarios = await query(
        `SELECT
            id, nome, email, cargo,
            ativo, criado_em, atualizado_em
         FROM users
         ${whereClause}
         ORDER BY ${orderByColumn} ${orderDir}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return {
        usuarios: usuarios.map(formatUser),
        pagination: { total, page, limit },
    };
}

// ---------------------------------------------------
// BUSCAR usuário por ID
// ---------------------------------------------------
async function buscarUsuarioPorId(id) {
    const rows = await query(
        `SELECT id, nome, email, cargo, ativo, criado_em, atualizado_em
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [id]
    );

    if (!rows[0]) {
        throw new AppError(
            `Usuário ID ${id} não encontrado.`,
            404,
            'USER_NOT_FOUND'
        );
    }

    return formatUser(rows[0]);
}

// ---------------------------------------------------
// CRIAR usuário (apenas ADMIN)
// ---------------------------------------------------
async function criarUsuario(dados, adminId, ipAddress) {
    const { nome, email, senha, cargo } = dados;

    // 1. Verifica se email já está em uso
    const existing = await query(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [email]
    );

    if (existing.length > 0) {
        throw new AppError(
            'Este e-mail já está cadastrado no sistema.',
            409,
            'EMAIL_ALREADY_EXISTS'
        );
    }

    // 2. Gera hash da senha
    const rounds    = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const senhaHash = await bcrypt.hash(senha, rounds);

    // 3. Insere no banco
    const result = await query(
        `INSERT INTO users (nome, email, senha_hash, cargo, setor)
        VALUES (?, ?, ?, ?, ?)`,
        [nome, email.toLowerCase(), senhaHash, cargo, dados.setor || null]
    );

    const novoUsuario = await buscarUsuarioPorId(result.insertId);

    // 4. Registra log de auditoria
    await registrarLog({
        usuarioId:   adminId,
        acao:        'CRIAR_USUARIO',
        descricao:   `Usuário criado: ${email} | Cargo: ${cargo}`,
        dadosDepois: { id: novoUsuario.id, nome, email, cargo },
        ipAddress,
    });

    logger.info(`👤 Usuário criado: ${email} (${cargo}) | Admin: ${adminId}`);

    return novoUsuario;
}

// ---------------------------------------------------
// EDITAR usuário (apenas ADMIN)
// ---------------------------------------------------
async function editarUsuario(id, dados, adminId, ipAddress) {
    // 1. Verifica se usuário existe
    const usuarioAntes = await buscarUsuarioPorId(id);

    // 2. Impede desativar o próprio admin logado
    if (id === adminId && dados.ativo === false) {
        throw new AppError(
            'Você não pode desativar a sua própria conta.',
            400,
            'CANNOT_DEACTIVATE_SELF'
        );
    }

    // 3. Impede rebaixar o próprio cargo
    if (id === adminId && dados.cargo && dados.cargo !== 'ADMIN') {
        throw new AppError(
            'Você não pode alterar o seu próprio cargo.',
            400,
            'CANNOT_CHANGE_OWN_ROLE'
        );
    }

    // 4. Verifica duplicidade de email
    if (dados.email) {
        const emailExists = await query(
            'SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1',
            [dados.email, id]
        );
        if (emailExists.length > 0) {
            throw new AppError(
                'Este e-mail já está em uso por outro usuário.',
                409,
                'EMAIL_ALREADY_EXISTS'
            );
        }
    }

    // 5. Monta os campos dinamicamente
    const campos = [];
    const params = [];

    if (dados.nome !== undefined) {
        campos.push('nome = ?');
        params.push(dados.nome);
    }
    if (dados.email !== undefined) {
        campos.push('email = ?');
        params.push(dados.email.toLowerCase());
    }
    if (dados.cargo !== undefined) {
        campos.push('cargo = ?');
        params.push(dados.cargo);
    }
    if (dados.ativo !== undefined) {
        campos.push('ativo = ?');
        params.push(dados.ativo ? 1 : 0);
    }
    if (dados.setor !== undefined) {
        campos.push('setor = ?');
        params.push(dados.setor || null);
    }

    params.push(id);

    // 6. Executa UPDATE
    await query(
        `UPDATE users SET ${campos.join(', ')} WHERE id = ?`,
        params
    );

    const usuarioDepois = await buscarUsuarioPorId(id);

    // 7. Registra log
    await registrarLog({
        usuarioId:   adminId,
        acao:        'EDITAR_USUARIO',
        descricao:   `Usuário ID ${id} editado.`,
        dadosAntes:  usuarioAntes,
        dadosDepois: usuarioDepois,
        ipAddress,
    });

    logger.info(`✏️  Usuário editado: ID ${id} | Admin: ${adminId}`);

    return usuarioDepois;
}

// ---------------------------------------------------
// EXCLUIR usuário (soft delete — apenas desativa)
// Nunca deleta de verdade para preservar logs
// ---------------------------------------------------
async function excluirUsuario(id, adminId, ipAddress) {
    // Impede excluir a si mesmo
    if (id === adminId) {
        throw new AppError(
            'Você não pode excluir a sua própria conta.',
            400,
            'CANNOT_DELETE_SELF'
        );
    }

    const usuario = await buscarUsuarioPorId(id);

    // Verifica se já está inativo
    if (!usuario.ativo) {
        throw new AppError(
            'Usuário já está inativo.',
            400,
            'USER_ALREADY_INACTIVE'
        );
    }

    // Desativa o usuário (soft delete)
    await query(
        'UPDATE users SET ativo = 0 WHERE id = ?',
        [id]
    );

    await registrarLog({
        usuarioId:  adminId,
        acao:       'EXCLUIR_USUARIO',
        descricao:  `Usuário ID ${id} desativado. E-mail: ${usuario.email}`,
        dadosAntes: usuario,
        ipAddress,
    });

    logger.info(`🗑️  Usuário desativado: ID ${id} | Admin: ${adminId}`);

    return { message: `Usuário ${usuario.nome} desativado com sucesso.` };
}

// ---------------------------------------------------
// REATIVAR usuário desativado (apenas ADMIN)
// ---------------------------------------------------
async function reativarUsuario(id, adminId, ipAddress) {
    const usuario = await buscarUsuarioPorId(id);

    if (usuario.ativo) {
        throw new AppError(
            'Usuário já está ativo.',
            400,
            'USER_ALREADY_ACTIVE'
        );
    }

    await query('UPDATE users SET ativo = 1 WHERE id = ?', [id]);

    const usuarioAtualizado = await buscarUsuarioPorId(id);

    await registrarLog({
        usuarioId:   adminId,
        acao:        'EDITAR_USUARIO',
        descricao:   `Usuário ID ${id} reativado. E-mail: ${usuario.email}`,
        dadosAntes:  usuario,
        dadosDepois: usuarioAtualizado,
        ipAddress,
    });

    logger.info(`✅ Usuário reativado: ID ${id} | Admin: ${adminId}`);

    return usuarioAtualizado;
}

// ---------------------------------------------------
// ALTERAR SENHA (pelo próprio usuário logado)
// ---------------------------------------------------
async function alterarSenha(userId, senhaAtual, novaSenha, ipAddress) {
    // 1. Busca usuário com hash para comparar
    const rows = await query(
        'SELECT id, nome, email, senha_hash FROM users WHERE id = ? LIMIT 1',
        [userId]
    );

    const usuario = rows[0];

    if (!usuario) {
        throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    // 2. Verifica a senha atual
    const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.senha_hash);

    if (!senhaCorreta) {
        throw new AppError(
            'Senha atual incorreta.',
            401,
            'WRONG_CURRENT_PASSWORD'
        );
    }

    // 3. Impede reutilizar a mesma senha
    const mesmaSenha = await bcrypt.compare(novaSenha, usuario.senha_hash);

    if (mesmaSenha) {
        throw new AppError(
            'A nova senha não pode ser igual à senha atual.',
            400,
            'SAME_PASSWORD'
        );
    }

    // 4. Gera novo hash e atualiza
    const rounds  = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const novoHash = await bcrypt.hash(novaSenha, rounds);

    await query(
        'UPDATE users SET senha_hash = ? WHERE id = ?',
        [novoHash, userId]
    );

    // 5. Registra log (sem expor hashes)
    await registrarLog({
        usuarioId: userId,
        acao:      'EDITAR_USUARIO',
        descricao: `Senha alterada pelo próprio usuário: ${usuario.email}`,
        ipAddress,
    });

    logger.info(`🔐 Senha alterada: ID ${userId} (${usuario.email})`);

    return { message: 'Senha alterada com sucesso.' };
}

// ---------------------------------------------------
// ESTATÍSTICAS de usuários para o Dashboard
// ---------------------------------------------------
async function estatisticasUsuarios() {
    const [totais] = await query(
        `SELECT
            COUNT(*)                    AS total,
            SUM(ativo = 1)              AS ativos,
            SUM(ativo = 0)              AS inativos,
            SUM(cargo = 'ADMIN')        AS admins,
            SUM(cargo = 'OPERADOR')     AS operadores,
            SUM(cargo = 'VISUALIZADOR') AS visualizadores
         FROM users`
    );

    return {
        total:          parseInt(totais.total)          || 0,
        ativos:         parseInt(totais.ativos)         || 0,
        inativos:       parseInt(totais.inativos)       || 0,
        admins:         parseInt(totais.admins)         || 0,
        operadores:     parseInt(totais.operadores)     || 0,
        visualizadores: parseInt(totais.visualizadores) || 0,
    };
}

// ---------------------------------------------------
// Helper: formata usuário para resposta
// Remove campos sensíveis (senha_hash)
// ---------------------------------------------------
function formatUser(row) {
    return {
        id:           row.id,
        nome:         row.nome,
        email:        row.email,
        cargo:        row.cargo,
        ativo:        row.ativo === 1 || row.ativo === true,
        criado_em:    row.criado_em,
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