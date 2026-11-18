const { z } = require('zod');

const environmentSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    TRUST_PROXY_HOPS: z.enum(['0', '1', '2']).default('1').transform(Number),
    DB_TYPE: z.enum(['sqlite', 'postgres']).default('postgres'),
    ALLOW_PRODUCTION_SQLITE: z.enum(['true', 'false']).default('false'),
    DB_USER: z.string().optional(),
    DB_PASSWORD: z.string().optional(),
    DB_SERVER: z.string().optional(),
    DB_NAME: z.string().optional(),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
    DB_SSL: z.enum(['true', 'false']).default('false'),
    DB_SSL_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).default('true'),
    DATABASE_URL: z.string().optional(),
    CORS_ORIGINS: z.string().optional(),
    PUBLIC_APP_URL: z.string().url().optional(),
    SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
    SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(168).default(8),
    SESSION_WARNING_SECONDS: z.coerce.number().int().min(10).max(300).default(30),
    METRICS_ENABLED: z.enum(['true', 'false']).default('false'),
    METRICS_TOKEN: z.string().min(32).optional(),
    API_RATE_LIMIT_5M: z.coerce.number().int().min(1500).max(100000).default(30000),
    LOGIN_IP_RATE_LIMIT_15M: z.coerce.number().int().min(50).max(10000).default(500),
    INTEGRATION_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(60).max(10000).default(600),
    INTEGRATION_BALANCE_STALE_HOURS: z.coerce.number().int().min(1).max(720).default(36)
}).superRefine((env, context) => {
    if (env.SESSION_WARNING_SECONDS >= env.SESSION_IDLE_MINUTES * 60) {
        context.addIssue({
            code: 'custom',
            path: ['SESSION_WARNING_SECONDS'],
            message: 'Session warning must be shorter than the idle timeout.'
        });
    }
    if (env.METRICS_ENABLED === 'true' && !env.METRICS_TOKEN) {
        context.addIssue({
            code: 'custom',
            path: ['METRICS_TOKEN'],
            message: 'METRICS_TOKEN is required when metrics are enabled.'
        });
    }
    if (env.NODE_ENV !== 'production') return;
    if (env.DB_TYPE === 'sqlite' && env.ALLOW_PRODUCTION_SQLITE !== 'true') {
        context.addIssue({
            code: 'custom',
            path: ['ALLOW_PRODUCTION_SQLITE'],
            message: 'Production SQLite requires explicit opt-in.'
        });
    }
    for (const key of ['CORS_ORIGINS', 'PUBLIC_APP_URL']) {
        if (!env[key]) context.addIssue({ code: 'custom', path: [key], message: `${key} is required in production.` });
    }
    if (env.DB_TYPE === 'postgres' && !env.DATABASE_URL) {
        for (const key of ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_NAME']) {
            if (!env[key]) context.addIssue({ code: 'custom', path: [key], message: `${key} is required in production.` });
        }
    }
    if (env.PUBLIC_APP_URL && !env.PUBLIC_APP_URL.startsWith('https://')) {
        context.addIssue({ code: 'custom', path: ['PUBLIC_APP_URL'], message: 'Production URL must use HTTPS.' });
    }
});

const validateEnvironment = (source = process.env) => {
    const parsed = environmentSchema.safeParse(source);
    if (!parsed.success) {
        const details = parsed.error.issues
            .map(issue => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
            .join('; ');
        throw new Error(`INVALID_ENVIRONMENT: ${details}`);
    }
    return parsed.data;
};

module.exports = { validateEnvironment };
