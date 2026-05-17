/**
 * StockDock - Wrapper para controllers assíncronos
 * 
 * Elimina a necessidade de try/catch em cada controller.
 * Qualquer erro lançado dentro de um controller async
 * será automaticamente capturado e passado para o
 * middleware de erro global (next(error)).
 * 
 * Uso:
 *   router.get('/rota', asyncHandler(meuController));
 */

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;