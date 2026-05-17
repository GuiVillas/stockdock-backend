/**
 * StockDock - Middleware de Controle de Permissões
 * 
 * Deve ser usado APÓS o middleware authenticate.
 * Verifica se o usuário possui o cargo necessário
 * para acessar determinada rota.
 * 
 * Hierarquia de cargos:
 *   ADMIN > OPERADOR > VISUALIZADOR
 * 
 * Uso:
 *   router.delete('/:id', authenticate, authorize('ADMIN'), controller);
 *   router.post('/',      authenticate, authorize('ADMIN', 'OPERADOR'), controller);
 */

const { AppError } = require('./error.middleware');

const CARGO_HIERARCHY = {
    'VISUALIZADOR': 1,
    'OPERADOR':     2,
    'ADMIN':        3,
};

/**
 * Verifica se o usuário possui um dos cargos permitidos
 * @param  {...string} allowedRoles - Cargos permitidos
 */
function authorize(...allowedRoles) {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new AppError(
                    'Usuário não autenticado.',
                    401,
                    'NOT_AUTHENTICATED'
                );
            }

            const userCargo  = req.user.cargo;
            const isAllowed  = allowedRoles.includes(userCargo);

            if (!isAllowed) {
                throw new AppError(
                    `Acesso negado. Esta ação requer cargo: ${allowedRoles.join(' ou ')}.`,
                    403,
                    'INSUFFICIENT_PERMISSIONS'
                );
            }

            next();

        } catch (error) {
            next(error);
        }
    };
}

/**
 * Verifica se o usuário tem nível hierárquico mínimo
 * Ex: authorizeLevel('OPERADOR') permite OPERADOR e ADMIN
 */
function authorizeLevel(minimumRole) {
    return (req, res, next) => {
        try {
            if (!req.user) {
                throw new AppError('Usuário não autenticado.', 401, 'NOT_AUTHENTICATED');
            }

            const userLevel    = CARGO_HIERARCHY[req.user.cargo]    || 0;
            const minimumLevel = CARGO_HIERARCHY[minimumRole] || 0;

            if (userLevel < minimumLevel) {
                throw new AppError(
                    `Acesso negado. Nível mínimo requerido: ${minimumRole}.`,
                    403,
                    'INSUFFICIENT_PERMISSIONS'
                );
            }

            next();

        } catch (error) {
            next(error);
        }
    };
}

module.exports = { authorize, authorizeLevel };