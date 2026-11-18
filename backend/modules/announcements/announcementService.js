const fs = require('fs');
const path = require('path');
const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');

const dateKey = (value) => {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
};

const parseTargetDepartments = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
    const raw = String(value).trim();
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map(item => String(item).trim()).filter(Boolean);
        }
    } catch {
        // Legacy rows can contain one department as plain text.
    }
    return raw.split(',').map(item => item.trim()).filter(Boolean);
};

const isTargetedToDepartment = (announcement, department) => {
    const targets = parseTargetDepartments(announcement.target_department);
    if (!targets.length) return true;
    const normalized = String(department || '').toLocaleLowerCase('tr-TR');
    return targets.some(target => target.toLocaleLowerCase('tr-TR') === normalized);
};

function createAnnouncementService(repository, {
    db,
    media,
    pushService,
    now = () => new Date()
}) {
    return {
        async list(query, { admin, userId }) {
            const pagination = parsePagination(query);
            if (admin) {
                const result = await repository.listAdmin({ query, pagination });
                return paginatedResponse(
                    result.items,
                    result.total,
                    pagination.page,
                    pagination.pageSize
                );
            }
            const today = dateKey(now());
            const [user, rows] = await Promise.all([
                repository.findUserDepartment(userId),
                repository.listVisibleCandidates(query, today)
            ]);
            const visible = rows.filter(row =>
                dateKey(row.visible_until) >= today
                && isTargetedToDepartment(row, user?.department)
            );
            return paginatedResponse(
                visible.slice(pagination.startRow - 1, pagination.endRow),
                visible.length,
                pagination.page,
                pagination.pageSize
            );
        },
        async listDepartments() {
            const rows = await repository.listDepartments();
            return rows.map(row => row.department).filter(Boolean);
        },
        async create(body, file, userId) {
            const targetDepartments = [...new Set(parseTargetDepartments(body.target_department))];
            const visibleUntil = dateKey(body.visible_until);
            let attachmentPath = null;
            let attachmentPublicId = null;
            if (file) {
                if (media.useCloudinary) {
                    const uploaded = await media.uploadToCloudinary(
                        file.buffer,
                        'announcements',
                        { resource_type: 'auto', use_filename: true }
                    );
                    attachmentPath = uploaded.url;
                    attachmentPublicId = uploaded.public_id;
                } else {
                    attachmentPath = `/uploads/announcements/${file.filename}`;
                }
            }
            await repository.create({
                title: body.title,
                content: body.content,
                attachmentPath,
                attachmentName: file?.originalname || null,
                attachmentType: file?.mimetype || null,
                attachmentPublicId,
                targetDepartment: targetDepartments.length
                    ? JSON.stringify(targetDepartments)
                    : null,
                visibleUntil,
                createdBy: userId
            });

            const variables = {
                title: body.title,
                department: targetDepartments.join(', ')
            };
            const options = { tag: `announcement-${Date.now()}` };
            const pushPromise = targetDepartments.length
                ? Promise.all(targetDepartments.map(department =>
                    pushService.sendTemplatedToDepartment(
                        db,
                        department,
                        'announcement_created',
                        { ...variables, department },
                        { tag: `${options.tag}-${department}` }
                    )
                ))
                : pushService.sendTemplatedToAll(
                    db,
                    'announcement_created',
                    variables,
                    options
                );
            pushPromise.catch(error => console.error('Announcement push error:', error.message));
        },
        async remove(id) {
            const { row, changes } = await repository.remove(id);
            if (!changes) {
                throw new AppError(404, 'ANNOUNCEMENT_NOT_FOUND', 'Duyuru bulunamadı.');
            }
            if (row?.attachment_public_id) {
                const resourceType = row.attachment_type === 'application/pdf' ? 'raw' : 'image';
                await media.deleteFromCloudinary(row.attachment_public_id, {
                    resource_type: resourceType
                });
            } else if (row?.attachment_path?.startsWith('/uploads/')) {
                const filePath = path.join(
                    __dirname,
                    '..',
                    '..',
                    row.attachment_path.replace(/^\//, '')
                );
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
        }
    };
}

module.exports = {
    createAnnouncementService,
    dateKey,
    parseTargetDepartments
};
