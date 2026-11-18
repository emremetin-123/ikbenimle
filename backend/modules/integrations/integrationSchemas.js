const net = require('node:net');
const { z } = require('zod');

const INTEGRATION_SCOPES = [
    'employees:write',
    'leave-balances:write',
    'leave-requests:read',
    'leave-requests:ack',
    'payrolls:write'
];

const nullableDateTime = z.union([
    z.string().datetime({ offset: true }),
    z.null()
]).optional();

const connectionBodySchema = z.object({
    name: z.string().trim().min(2).max(120),
    provider: z.enum(['logo_bridge', 'generic_bridge']).default('generic_bridge'),
    is_enabled: z.boolean().default(false),
    employee_sync_enabled: z.boolean().default(true),
    leave_balance_sync_enabled: z.boolean().default(true),
    leave_request_export_enabled: z.boolean().default(true),
    leave_export_trigger: z.enum(['created', 'approved']).default('created')
}).strict();

const connectionIdParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const keyIdParamsSchema = z.object({
    id: z.coerce.number().int().positive(),
    keyId: z.coerce.number().int().positive()
}).strict();

const apiKeyBodySchema = z.object({
    name: z.string().trim().min(2).max(120),
    scopes: z.array(z.enum(INTEGRATION_SCOPES)).min(1).max(INTEGRATION_SCOPES.length),
    ip_allowlist: z.array(
        z.string().trim().refine(value => net.isIP(value) !== 0, 'Geçerli bir IP adresi girin.')
    ).max(20).default([]),
    expires_at: nullableDateTime
}).strict();

const adminListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['pending', 'leased', 'retry', 'completed', 'dead_letter']).optional(),
    connection_id: z.coerce.number().int().positive().optional()
}).strict();

const employeeSchema = z.object({
    external_employee_id: z.string().trim().min(1).max(100),
    employee_id: z.string().trim().min(1).max(50),
    name: z.string().trim().min(2).max(255),
    department: z.string().trim().min(1).max(255),
    position: z.union([z.string().trim().max(255), z.null()]).default(null),
    manager_employee_id: z.union([z.string().trim().min(1).max(50), z.null()]).default(null),
    status: z.enum(['active', 'passive']).default('active'),
    email: z.union([z.string().trim().email().max(255), z.null()]).optional(),
    phone: z.union([z.string().trim().max(50), z.null()]).optional(),
    birth_date: z.union([
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        z.null()
    ]).optional(),
    source_updated_at: nullableDateTime
}).strict();

const employeeBatchSchema = z.object({
    employees: z.array(employeeSchema).min(1).max(100)
}).strict();

const leaveBalanceSchema = z.object({
    external_employee_id: z.string().trim().min(1).max(100),
    balance_days: z.number().min(-365).max(2000),
    as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source_updated_at: nullableDateTime
}).strict();

const leaveBalanceBatchSchema = z.object({
    balances: z.array(leaveBalanceSchema).min(1).max(500)
}).strict();

const outboxQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

const outboxParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const outboxAckSchema = z.object({
    status: z.enum(['succeeded', 'failed']),
    external_reference: z.union([z.string().trim().max(255), z.null()]).optional(),
    error_code: z.union([z.string().trim().max(100), z.null()]).optional(),
    error_message: z.union([z.string().trim().max(500), z.null()]).optional(),
    retry_after_seconds: z.coerce.number().int().min(30).max(86400).optional()
}).strict();

module.exports = {
    INTEGRATION_SCOPES,
    connectionBodySchema,
    connectionIdParamsSchema,
    keyIdParamsSchema,
    apiKeyBodySchema,
    adminListQuerySchema,
    employeeBatchSchema,
    leaveBalanceBatchSchema,
    outboxQuerySchema,
    outboxParamsSchema,
    outboxAckSchema
};
