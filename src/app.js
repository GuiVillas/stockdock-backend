const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');

const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const logger           = require('./utils/logger');
const { sanitizeInputs } = require('./middleware/sanitize.middleware');

const authRoutes   = require('./modules/auth/auth.routes');
const palletRoutes = require('./modules/pallets/pallet.routes');
const userRoutes   = require('./modules/users/user.routes');
const logRoutes    = require('./modules/logs/log.routes');
const lojaRoutes   = require('./modules/lojas/loja.routes');

const app = express();

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

const corsOptions = {
    origin: process.env.NODE_ENV === 'production'
        ? process.env.ALLOWED_ORIGINS?.split(',') || []
        : '*',
    methods:          ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders:   ['Content-Type', 'Authorization'],
    exposedHeaders:   ['X-Total-Count', 'X-Page', 'X-Limit'],
    credentials:      true,
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

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

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max:      10,
    message: {
        success: false,
        message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        code:    'AUTH_RATE_LIMIT_EXCEEDED',
    },
});

app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInputs);

app.use(morgan('combined', {
    stream: { write: (message) => logger.http(message.trim()) },
    skip:   (req) => req.url === '/health',
}));

app.get('/health', (req, res) => {
    res.status(200).json({
        success:   true,
        status:    'online',
        service:   'StockDock API',
        version:   '1.0.0',
        uptime:    `${Math.floor(process.uptime())}s`,
        timestamp: new Date().toISOString(),
    });
});

app.use('/api/v1/auth',    authLimiter, authRoutes);
app.use('/api/v1/pallets', palletRoutes);
app.use('/api/v1/users',   userRoutes);
app.use('/api/v1/logs',    logRoutes);
app.use('/api/v1/lojas',   lojaRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;