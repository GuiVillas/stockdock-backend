/**
 * StockDock - Configuração Express
 * 
 * Responsabilidade: Montar todos os middlewares
 * globais e registrar as rotas da aplicação.
 * NÃO inicia o servidor (isso é papel do server.js).
 */
const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { sanitizeInputs } = require('./middleware/sanitize.middleware');
const logger       = require('./utils/logger');

// ---------------------------------------------------
// Rotas (serão criadas nas próximas partes)
// ---------------------------------------------------
const authRoutes   = require('./modules/auth/auth.routes');
const palletRoutes = require('./modules/pallets/pallet.routes');
const userRoutes   = require('./modules/users/user.routes');
const logRoutes    = require('./modules/logs/log.routes');

const app = express();

app.set('trust proxy', 1);

// ---------------------------------------------------
// SEGURANÇA: Helmet define headers HTTP seguros
// Protege contra XSS, clickjacking, sniffing, etc.
// ---------------------------------------------------
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc:   ["'self'"],
            scriptSrc:  ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// ---------------------------------------------------
// CORS: Permite apenas origens conhecidas
// Em produção, substitua '*' pelo IP/domínio do app
// ---------------------------------------------------
const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || []
        : '*',
    methods:            ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders:     ['Content-Type', 'Authorization'],
    exposedHeaders:     ['X-Total-Count', 'X-Page', 'X-Limit'],
    credentials:        true,
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// ---------------------------------------------------
// RATE LIMITING: Proteção contra brute force e DDoS
// 100 requests por 15 minutos por IP (padrão)
// ---------------------------------------------------
const globalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        success: false,
        message: 'Muitas requisições. Tente novamente em 15 minutos.',
        code:    'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders:   false,
});

// Rate limit mais restrito especificamente para login
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max:      10,              // apenas 10 tentativas de login
    message: {
        success: false,
        message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        code:    'AUTH_RATE_LIMIT_EXCEEDED',
    },
});

app.use(globalLimiter);

// ---------------------------------------------------
// PARSE: Habilita leitura de JSON e URL encoded
// ---------------------------------------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInputs);

// ---------------------------------------------------
// LOGGING HTTP: Morgan envia logs para o Winston
// ---------------------------------------------------
app.use(morgan('combined', {
    stream: {
        write: (message) => logger.http(message.trim()),
    },
    // Não loga health check para não poluir os logs
    skip: (req) => req.url === '/health',
}));

// ---------------------------------------------------
// HEALTH CHECK: Endpoint para monitoramento
// Usado por Docker, load balancers, etc.
// ---------------------------------------------------
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        status:  'online',
        service: 'StockDock API',
        version: '1.0.0',
        uptime:  `${Math.floor(process.uptime())}s`,
        timestamp: new Date().toISOString(),
    });
});

// ---------------------------------------------------
// ROTAS PRINCIPAIS
// Prefixo /api/v1 para versionamento da API
// ---------------------------------------------------
app.use('/api/v1/auth',    authLimiter, authRoutes);
app.use('/api/v1/pallets', palletRoutes);
app.use('/api/v1/users',   userRoutes);
app.use('/api/v1/logs',    logRoutes);

// ---------------------------------------------------
// TRATAMENTO DE ERROS GLOBAL
// Deve ser registrado APÓS as rotas
// ---------------------------------------------------
app.use(notFoundHandler);   // 404 para rotas não encontradas
app.use(errorHandler);      // Handler central de erros

module.exports = app;