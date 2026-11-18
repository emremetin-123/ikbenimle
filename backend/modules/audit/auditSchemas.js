const { z } = require('zod');
const { MODULES, ACTIONS } = require('./auditPolicy');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === value;
}, 'Geçerli bir tarih girin.');
const filterShape = {
    user: z.string().trim().max(100).optional(),
    module: z.enum(Object.keys(MODULES)).optional(), action: z.enum(Object.keys(ACTIONS)).optional(),
    source: z.enum(['activity', 'security']).optional(),
    outcome: z.enum(['success', 'denied', 'error', 'pending', 'aborted']).optional(),
    from: date.optional(), to: date.optional(), held: z.enum(['true']).optional(),
    page: z.coerce.number().int().min(1).max(1_000_000).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional()
};
const auditQuery = z.object(filterShape).strict().refine(value => !value.from || !value.to || value.from <= value.to, { message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.', path: ['from'] });
const auditParams = z.object({ source: z.enum(['activity', 'security']), id: z.string().max(64).regex(/^(?:[1-9]\d*|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/) }).strict();
const holdBody = z.object({ reason: z.string().trim().min(10).max(500) }).strict();
const emptyBody = z.object({}).strict();
module.exports = { auditQuery, auditParams, holdBody, emptyBody };
