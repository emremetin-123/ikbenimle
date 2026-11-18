const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { authenticateToken, requirePermission } = require('../../middleware/auth');
const { createUserRepository } = require('./userRepository');
const { createUserService } = require('./userService');
const { createUserController } = require('./userController');
const { validate } = require('../../core/validation');

const optionalText = (max) => z.union([z.string().trim().max(max), z.null()]).optional();
const userBaseSchema = z.object({
    employee_id: z.string().trim().min(1).max(50),
    name: z.string().trim().min(2).max(255),
    department: z.string().trim().min(1).max(255),
    position: optionalText(255),
    manager_id: z.union([z.coerce.number().int().positive(), z.literal(''), z.null()]).optional(),
    status: z.enum(['active', 'passive']).optional(),
    permissions: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
    role: z.enum(['employee', 'admin']).optional(),
    phone: optionalText(50),
    address: optionalText(1000),
    emergency_contact_name: optionalText(255),
    emergency_contact_phone: optionalText(50),
    blood_type: optionalText(20),
    birth_date: optionalText(30),
    email: z.union([z.string().trim().email().max(255), z.literal(''), z.null()]).optional(),
    clothing_top: optionalText(50),
    clothing_bottom: optionalText(50),
    shoe_size: optionalText(20)
});
const createUserSchema = userBaseSchema.extend({
    password: z.string().min(10).max(200)
}).strict();
const updateUserSchema = userBaseSchema.extend({
    department: optionalText(255),
    password: z.union([z.literal(''), z.string().min(10).max(200)]).optional()
}).strict();
const userListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional(),
    department: z.string().trim().max(255).optional(),
    status: z.enum(['active', 'passive']).optional(),
    sort: z.enum(['name', 'employee_id', 'department', 'position']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc')
}).strict();
const optionListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(255).optional()
}).strict();
const userIdParamsSchema = z.object({
    id: z.coerce.number().int().positive()
}).strict();

const hasPrivilegedPermissions = (permissions = []) => (
    permissions.some(permission => permission.startsWith('manage_'))
);

const canApplyUserPrivileges = (actor, target, payload) => {
    if (actor?.role === 'admin') return true;
    if (target?.role === 'admin') return false;
    return payload.role !== 'admin' && !hasPrivilegedPermissions(payload.permissions || []);
};

module.exports = function createAdminUserRoutes(db) {
    const router = express.Router();
    const userController = createUserController(
        createUserService(createUserRepository(db))
    );

    // Tüm kullanıcılar
    router.get(
        '/users',
        authenticateToken,
        requirePermission('manage_users'),
        validate({ query: userListQuerySchema }),
        userController.list
    );
    router.get(
        '/users/options',
        authenticateToken,
        requirePermission('manage_users'),
        validate({ query: optionListQuerySchema }),
        userController.options
    );
    router.get(
        '/users/form-options',
        authenticateToken,
        requirePermission('manage_users'),
        userController.formOptions
    );

    // Kullanıcı oluştur
    router.post('/users', authenticateToken, requirePermission('manage_users'), validate({ body: createUserSchema }), async (req, res) => {
        const { employee_id, name, department, position, manager_id, status, permissions, password, role,
            phone, address, emergency_contact_name, emergency_contact_phone,
            blood_type, birth_date, email, clothing_top, clothing_bottom, shoe_size } = req.body;
        try {
            if (!canApplyUserPrivileges(req.user, null, req.body)) {
                return res.status(403).json({ error: 'Yalnizca sistem yoneticisi yonetim yetkisi verebilir.' });
            }
            const password_hash = await bcrypt.hash(password, 10);
            const userId = await db.transaction(async (tx) => {
                const userResult = await tx.run(
                    'INSERT INTO users (employee_id, name, department, position, manager_id, status, permissions, password_hash, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [employee_id, name, department, position || null, manager_id || null, status || 'active', permissions ? JSON.stringify(permissions) : null, password_hash, role || 'employee']
                );
                const createdUserId = userResult.lastID;
                await tx.run(`
                    INSERT INTO personal_info (
                        user_id, phone, address, emergency_contact_name, emergency_contact_phone,
                        blood_type, birth_date, email, clothing_top, clothing_bottom, shoe_size
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [createdUserId, phone || null, address || null, emergency_contact_name || null, emergency_contact_phone || null,
                        blood_type || null, birth_date || null, email || null, clothing_top || null, clothing_bottom || null, shoe_size || null]
                );
                return createdUserId;
            });
            res.json({ success: true, userId });
        } catch (err) {
            console.error('Error creating user:', err.message);
            res.status(500).json({ error: 'Kullanıcı oluşturulamadı.' });
        }
    });

    // Kullanıcı güncelle
    router.put('/users/:id', authenticateToken, requirePermission('manage_users'), validate({ params: userIdParamsSchema, body: updateUserSchema }), async (req, res) => {
        const { id } = req.params;
        const { employee_id, name, department, position, manager_id, status, permissions, password, role,
            phone, address, emergency_contact_name, emergency_contact_phone,
            blood_type, birth_date, email, clothing_top, clothing_bottom, shoe_size } = req.body;
        try {
            const targetUser = await db.get('SELECT id, role FROM users WHERE id = ?', [id]);
            if (!targetUser) return res.status(404).json({ error: 'Kullanici bulunamadi.' });
            if (!canApplyUserPrivileges(req.user, targetUser, req.body)) {
                return res.status(403).json({ error: 'Yalnizca sistem yoneticisi yonetim yetkilerini degistirebilir.' });
            }
            if (manager_id && String(manager_id) === String(id)) {
                return res.status(400).json({ error: 'Kullanici kendi ust amiri olamaz' });
            }
            const newPasswordHash = password && password.trim() ? await bcrypt.hash(password, 10) : null;
            await db.transaction(async (tx) => {
                await tx.run(
                    'UPDATE users SET employee_id = ?, name = ?, department = ?, position = ?, manager_id = ?, status = ?, permissions = ?, role = ?'
                        + (newPasswordHash ? ', password_hash = ? WHERE id = ?' : ' WHERE id = ?'),
                    newPasswordHash
                        ? [employee_id, name, department || null, position || null, manager_id || null, status || 'active', permissions ? JSON.stringify(permissions) : null, role || 'employee', newPasswordHash, id]
                        : [employee_id, name, department || null, position || null, manager_id || null, status || 'active', permissions ? JSON.stringify(permissions) : null, role || 'employee', id]
                );
                const personalValues = [
                    phone || null, address || null, emergency_contact_name || null, emergency_contact_phone || null,
                    blood_type || null, birth_date || null, email || null, clothing_top || null, clothing_bottom || null,
                    shoe_size || null, id
                ];
                const personalUpdate = await tx.run(`
                    UPDATE personal_info SET
                        phone = ?, address = ?, emergency_contact_name = ?, emergency_contact_phone = ?,
                        blood_type = ?, birth_date = ?, email = ?, clothing_top = ?, clothing_bottom = ?, shoe_size = ?
                    WHERE user_id = ?`,
                personalValues);
                if (personalUpdate.changes === 0) {
                    await tx.run(`
                        INSERT INTO personal_info (
                            user_id, phone, address, emergency_contact_name, emergency_contact_phone,
                            blood_type, birth_date, email, clothing_top, clothing_bottom, shoe_size
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [id, ...personalValues.slice(0, -1)]);
                }
                await tx.run(
                    'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
                    [id]
                );
            });
            res.json({ success: true });
        } catch (err) {
            console.error('Update user error:', err);
            res.status(500).json({ error: 'Kullanıcı güncellenemedi.' });
        }
    });

    // Kullanıcı sil
    router.delete('/users/:id', authenticateToken, requirePermission('manage_users'), validate({ params: userIdParamsSchema }), async (req, res) => {
        try {
            if (String(req.params.id) === String(req.user.id)) {
                return res.status(400).json({ error: 'Aktif hesabınızı silemezsiniz.' });
            }
            await db.transaction(async (tx) => {
                await tx.run('UPDATE users SET status = ? WHERE id = ?', ['passive', req.params.id]);
                await tx.run(
                    'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL',
                    [req.params.id]
                );
            });
            res.json({ success: true, archived: true });
        } catch (err) {
            res.status(500).json({ error: 'Kullanıcı pasifleştirilemedi.' });
        }
    });

    return router;
};
