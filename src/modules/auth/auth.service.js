/**
 * StockDock - Auth Service
 * 
 * Responsabilidade: Regras de negócio da autenticação.
 * Não conhece req/res — apenas recebe dados e retorna resultados.
 * Isso permite testar a lógica sem depender do Express.
 */

const bcrypt  = require('bcryptjs');
const { query, withTransaction } = require('../../config/database');
const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} = require('../../config/jwt');
const { AppError } = require('../../middleware/error.middleware');
const logger       = require('../../utils/logger');

// ---------------------------------------------------
// Login: valida credenciais e retorna tokens
// ---------------------------------------------------
async function login(email, senha, ipAddress) {
    // 1. Busca usuário pelo email
    // Usamos prepared statement (?) — proteção contra SQL Injection
    const users = await query(
        `SELECT id, nome, email, senha_hash, cargo, ativo
         FROM users
         WHERE email = ?
         LIMIT 1`,
        [email]
    );

    const user = users[0];

    // 2. Verifica se usuário existe
    // IMPORTANTE: Mesma mensagem para "não encontrado" e "senha errada"
    // Isso evita que atacantes descubram quais emails estão cadastrados
    if (!user) {
        logger.warn(`⚠️  Tentativa de login com email não cadastrado: ${email} | IP: ${ipAddress}`);
        throw new AppError(
            'E-mail ou senha incorretos.',
            401,
            'INVALID_CREDENTIALS'
        );
    }

    // 3. Verifica se a conta está ativa
    if (!user.ativo) {
        logger.warn(`⚠️  Tentativa de login em conta desativada: ${email} | IP: ${ipAddress}`);
        throw new AppError(
            'Conta desativada. Entre em contato com o administrador.',
            403,
            'ACCOUNT_DISABLED'
        );
    }

    // 4. Compara a senha com o hash salvo no banco
    // bcrypt.compare é seguro contra timing attacks
    const senhaCorreta = await bcrypt.compare(senha, user.senha_hash);

    if (!senhaCorreta) {
        logger.warn(`⚠️  Senha incorreta para: ${email} | IP: ${ipAddress}`);
        throw new AppError(
            'E-mail ou senha incorretos.',
            401,
            'INVALID_CREDENTIALS'
        );
    }

    // 5. Gera os tokens JWT
    const accessToken  = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // 6. Registra o log de login
    await registrarLog({
        usuarioId:  user.id,
        acao:       'LOGIN',
        descricao:  `Login realizado com sucesso. Cargo: ${user.cargo}`,
        ipAddress,
    });

    logger.info(`✅ Login: ${user.email} (${user.cargo}) | IP: ${ipAddress}`);

    // 7. Retorna dados do usuário e tokens
    // NUNCA retornar senha_hash para o cliente
    return {
        user: {
            id:    user.id,
            nome:  user.nome,
            email: user.email,
            cargo: user.cargo,
        },
        tokens: {
            access_token:  accessToken,
            refresh_token: refreshToken,
            token_type:    'Bearer',
            expires_in:    process.env.JWT_EXPIRES_IN || '8h',
        },
    };
}

// ---------------------------------------------------
// Logout: registra o log de saída
// O token é invalidado no lado do cliente (app Android)
// Para invalidação server-side, seria necessário uma
// blacklist de tokens (Redis) — opcional para v2
// ---------------------------------------------------
async function logout(userId, ipAddress) {
    // Verifica se usuário existe
    const users = await query(
        'SELECT id, nome, email FROM users WHERE id = ? AND ativo = 1',
        [userId]
    );

    if (!users[0]) {
        throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    const user = users[0];

    // Registra log de logout
    await registrarLog({
        usuarioId: userId,
        acao:      'LOGOUT',
        descricao: 'Logout realizado.',
        ipAddress,
    });

    logger.info(`👋 Logout: ${user.email} | IP: ${ipAddress}`);

    return { message: 'Logout realizado com sucesso.' };
}

// ---------------------------------------------------
// Refresh Token: renova o access token
// ---------------------------------------------------
async function refreshToken(token, ipAddress) {
    // 1. Verifica se o refresh token é válido
    const decoded = verifyRefreshToken(token);

    if (!decoded) {
        throw new AppError(
            'Refresh token inválido ou expirado. Faça login novamente.',
            401,
            'INVALID_REFRESH_TOKEN'
        );
    }

    // Garante que é um refresh token
    if (decoded.type !== 'refresh') {
        throw new AppError('Tipo de token inválido.', 401, 'WRONG_TOKEN_TYPE');
    }

    // 2. Busca usuário atualizado do banco
    // (garante que conta não foi desativada desde o último login)
    const users = await query(
        'SELECT id, nome, email, cargo, ativo FROM users WHERE id = ? LIMIT 1',
        [decoded.sub]
    );

    const user = users[0];

    if (!user || !user.ativo) {
        throw new AppError(
            'Usuário não encontrado ou desativado.',
            401,
            'USER_NOT_FOUND'
        );
    }

    // 3. Gera novo access token com dados atualizados
    const newAccessToken = generateAccessToken(user);

    logger.info(`🔄 Token renovado: ${user.email} | IP: ${ipAddress}`);

    return {
        access_token: newAccessToken,
        token_type:   'Bearer',
        expires_in:   process.env.JWT_EXPIRES_IN || '8h',
    };
}

// ---------------------------------------------------
// Retorna os dados do usuário logado
// Chamado pelo endpoint /me
// ---------------------------------------------------
async function getMe(userId) {
    const users = await query(
        `SELECT id, nome, email, cargo, ativo, criado_em
         FROM users
         WHERE id = ? AND ativo = 1
         LIMIT 1`,
        [userId]
    );

    const user = users[0];

    if (!user) {
        throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    return user;
}

// ---------------------------------------------------
// Função interna: registra log de auditoria
// Usada por login e logout (e por outros módulos)
// ---------------------------------------------------
async function registrarLog({ usuarioId, acao, descricao, ipAddress, dadosAntes, dadosDepois }) {
    try {
        await query(
            `INSERT INTO logs (usuario_id, acao, descricao, dados_antes, dados_depois, ip_address)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                usuarioId,
                acao,
                descricao || null,
                dadosAntes  ? JSON.stringify(dadosAntes)  : null,
                dadosDepois ? JSON.stringify(dadosDepois) : null,
                ipAddress  || null,
            ]
        );
    } catch (logError) {
        // Log de auditoria nunca deve derrubar a operação principal
        logger.error(`⚠️  Falha ao registrar log: ${logError.message}`);
    }
}

module.exports = { login, logout, refreshToken, getMe, registrarLog };