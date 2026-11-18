require('dotenv').config();

const { validateEnvironment } = require('./config/environment');
const environment = validateEnvironment();

const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const pino = require('pino');
const pinoHttp = require('pino-http');
const path = require('path');
const setupDb = require('./database');
const { assertNoPendingMigrations } = require('./migrations');
const { apiLimiter } = require('./middleware/rateLimits');
const { authorizeUpload } = require('./middleware/uploadAccess');
const { avatarThumbnail } = require('./middleware/avatarThumbnail');
const { badgeThumbnail } = require('./middleware/badgeThumbnail');
const { privateFileHandler } = require('./middleware/privateFiles');
const {
    metricsMiddleware,
    metricsHandler,
    metricsAccess,
    setBackupMetrics
} = require('./middleware/metrics');
const { readBackupHealth } = require('./services/backupHealthService');
const { requestContextMiddleware } = require('./core/requestContext');
const { errorContractMiddleware } = require('./middleware/errorContract');

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employee');
const adminRoutes = require('./routes/admin');
const announcementRoutes = require('./routes/announcements');
const personalInfoRoutes = require('./routes/personalInfo');
const {
    createAdminFeedbackRouter,
    createEmployeeFeedbackRouter
} = require('./routes/feedback');
const leaveRoutes = require('./routes/leave');
const directoryRoutes = require('./routes/directory');
const newsRoutes = require('./routes/news');
const careersRoutes = require('./routes/careers');
const knowledgeRoutes = require('./routes/knowledge');
const surveyRoutes = require('./routes/surveys');
const mealMenuRoutes = require('./routes/mealMenus');
const moodRoutes = require('./routes/mood');
const notificationRoutes = require('./routes/notifications');
const chatbotRoutes = require('./routes/chatbot');
const serviceRouteRoutes = require('./routes/serviceRoutes');
const polyvalenceRoutes = require('./routes/polyvalence');
const weatherRoutes = require('./routes/weather');
const reminderRoutes = require('./routes/reminders');
const machineIntegrationRoutes = require('./modules/integrations/machineIntegrationRoutes');
const { startMoodReminderScheduler } = require('./services/pushNotificationService');
const { authenticateToken, setAuthDatabase } = require('./middleware/auth');
const { AppError } = require('./core/http');
const { createAuditMiddleware } = require('./modules/audit/auditMiddleware');
const { isPrivateActivity } = require('./modules/audit/auditPolicy');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            '*.password',
            '*.password_hash',
            '*.token',
            '*.vapid_private_key',
            '*.gemini_api_key'
        ],
        censor: '[REDACTED]'
    }
});

const app = express();
app.set('trust proxy', environment.TRUST_PROXY_HOPS);
app.disable('x-powered-by');
app.use(pinoHttp({
    logger,
    autoLogging: { ignore: req => isPrivateActivity(req.url) },
    genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const requestId = typeof incoming === 'string' && incoming.length <= 100
            ? incoming
            : crypto.randomUUID();
        res.setHeader('X-Request-Id', requestId);
        return requestId;
    }
}));
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'same-origin' },
    contentSecurityPolicy: false
}));

const allowedOrigins = String(
    process.env.CORS_ORIGINS
    || 'https://ikbenimle.com,https://www.ikbenimle.com,http://localhost:5173'
)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('CORS_ORIGIN_DENIED'));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'X-CSRF-Token',
        'X-Request-Id',
        'Authorization',
        'Idempotency-Key'
    ]
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(requestContextMiddleware);
app.use(errorContractMiddleware);
app.use(metricsMiddleware);
app.use('/api', apiLimiter);

app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));
app.get('/health/backup', async (_req, res) => {
    const status = await readBackupHealth();
    setBackupMetrics(status);
    res.status(status.healthy ? 200 : 503).json(status);
});
app.get('/internal/metrics', metricsAccess, metricsHandler);

setupDb().then(async (db) => {
    await assertNoPendingMigrations(db);
    setAuthDatabase(db);
    const auditLog = createAuditMiddleware(db);
    app.use(auditLog.middleware);

    app.use(
        '/uploads',
        authenticateToken,
        authorizeUpload(db),
        avatarThumbnail(path.join(__dirname, 'uploads')),
        badgeThumbnail(db, path.join(__dirname, 'uploads')),
        privateFileHandler(path.join(__dirname, 'uploads'))
    );

    app.get('/health/ready', async (_req, res) => {
        try {
            await db.get('SELECT 1 AS ok');
            res.json({ status: 'ready' });
        } catch {
            res.status(503).json({ status: 'not_ready' });
        }
    });

    app.use('/api', authRoutes(db));
    app.use('/api', employeeRoutes(db));
    app.use('/api/admin', adminRoutes(db));
    app.use('/api/announcements', announcementRoutes(db));
    app.use('/api/admin/announcements', announcementRoutes(db));
    app.use('/api/personal-info', personalInfoRoutes(db));
    app.use('/api', personalInfoRoutes(db));
    app.use('/api/feedback', createEmployeeFeedbackRouter(db));
    app.use('/api/admin/feedback', createAdminFeedbackRouter(db));
    app.use('/api/leave-requests', leaveRoutes(db));
    app.use('/api/directory', directoryRoutes(db));
    app.use('/api/news', newsRoutes(db));
    app.use('/api/admin/news', newsRoutes(db));
    app.use('/api/careers', careersRoutes(db));
    app.use('/api/knowledge', knowledgeRoutes(db));
    app.use('/api/admin/knowledge', knowledgeRoutes(db, 'admin'));
    app.use('/api/surveys', surveyRoutes(db));
    app.use('/api/admin/surveys', surveyRoutes(db, 'admin'));
    app.use('/api/meal-menu', mealMenuRoutes(db));
    app.use('/api/admin/meal-menu', mealMenuRoutes(db, 'admin'));
    app.use('/api/service-routes', serviceRouteRoutes(db));
    app.use('/api/admin/service-routes', serviceRouteRoutes(db, 'admin'));
    app.use('/api/polyvalence', polyvalenceRoutes(db));
    app.use('/api/mood-check', moodRoutes(db));
    app.use('/api/notifications', notificationRoutes(db));
    app.use('/api/chatbot', chatbotRoutes(db));
    app.use('/api/weather', weatherRoutes());
    app.use('/api/reminders', reminderRoutes(db));
    app.use('/api/integrations/v1', machineIntegrationRoutes(db));

    const stopScheduler = process.env.SCHEDULER_ENABLED !== 'false'
        ? startMoodReminderScheduler(db)
        : () => undefined;

    app.use((req, res) => res.status(404).json({
        error: 'NOT_FOUND',
        message: 'İstenen kaynak bulunamadı.',
        request_id: req.id
    }));
    app.use((err, req, res, _next) => {
        const uploadErrors = new Set([
            'Eğitim görseli JPEG, PNG, GIF veya WebP olmalıdır',
            'Yalnızca bir rozet görseli yüklenebilir; en fazla 10 MB olabilir',
            'Yalnızca bir kapak görseli yüklenebilir',
            'Kapak görseli en fazla 10 MB olabilir',
            'Geçersiz eğitim dosyası alanı',
            'Sadece video dosyalari kabul edilir',
            'Sadece video, PDF, sunum, dokuman veya gorsel dosyalari kabul edilir',
            'Sadece video veya PDF dosyalari kabul edilir',
            'Sadece PDF veya resim dosyalari kabul edilir',
            'Sadece resim dosyalari kabul edilir',
            'Dosya içeriği bildirilen dosya türüyle eşleşmiyor'
        ]);
        if (uploadErrors.has(err?.message)) {
            return res.status(400).json({ error: err.message });
        }
        if (err?.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Dosya boyutu çok büyük.' });
        }
        if (err?.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Çok fazla dosya yüklendi.' });
        }
        if (err?.message === 'CORS_ORIGIN_DENIED') {
            return res.status(403).json({ error: 'CORS_ORIGIN_DENIED' });
        }
        if (err instanceof AppError) {
            return res.status(err.status).json({
                error: err.code,
                message: err.message,
                ...(err.details === undefined ? {} : { details: err.details }),
                request_id: req.id
            });
        }
        req.log?.error({ err }, 'Unhandled request error');
        return res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', request_id: req.id });
    });

    const port = Number(process.env.PORT || 5000);
    const server = app.listen(port, () => logger.info({ port }, 'Server started'));
    let shuttingDown = false;
    const shutdown = async (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info({ signal }, 'Graceful shutdown started');
        stopScheduler();
        server.close(async () => {
            try {
                await auditLog.drain();
                await db.close();
                logger.info('Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                logger.error({ err: error }, 'Database shutdown failed');
                process.exit(1);
            }
        });
        setTimeout(() => process.exit(1), 15000).unref();
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
}).catch((err) => {
    logger.fatal({ err }, 'Database initialization failed');
    process.exit(1);
});
