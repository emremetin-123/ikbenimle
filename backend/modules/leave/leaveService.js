const { AppError } = require('../../core/http');
const { parsePagination, paginatedResponse } = require('../../core/pagination');
const { enqueueLeaveRequest } = require('../integrations/integrationOutboxService');
const { createLeaveRepository } = require('./leaveRepository');
const { LEAVE_TYPE_LABELS, LEAVE_TYPES, VALID_STATUSES } = require('./leaveConstants');

const normalizeKey = (value = '') => String(value)
    .toLocaleUpperCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const resolveLeaveType = value => {
    const direct = LEAVE_TYPES.find(type => type === value);
    if (direct) return direct;
    const entry = Object.entries(LEAVE_TYPE_LABELS)
        .find(([labelKey]) => labelKey === normalizeKey(value));
    if (entry) return entry[1];
    throw new AppError(400, 'INVALID_LEAVE_TYPE', 'Geçerli bir izin nedeni seçin.');
};

const toDate = value => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoDate = date => date.toISOString().slice(0, 10);
const roundDuration = value => Math.round(value * 10) / 10;

const calculateDuration = (startDate, endDate, requestedType) => {
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs <= 0) {
        throw new AppError(
            400,
            'INVALID_LEAVE_DATE_RANGE',
            'Bitiş tarihi başlangıç tarihinden sonra olmalıdır.'
        );
    }

    const sameCalendarDay = toIsoDate(startDate) === toIsoDate(endDate);
    const diffHours = diffMs / (1000 * 60 * 60);
    if (requestedType === 'Saat' || (sameCalendarDay && diffHours < 6)) {
        return { duration_type: 'Saat', duration_value: roundDuration(diffHours) };
    }

    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    const dayCount = Math.floor((endDay.getTime() - startDay.getTime()) / 86_400_000) + 1;
    return { duration_type: 'Gün', duration_value: dayCount };
};

const normalizeStatus = status => {
    if (status === 'pending') return 'İletildi';
    if (status === 'approved') return 'Onaylandı';
    if (status === 'rejected') return 'Reddedildi';
    return status || 'İletildi';
};

const createLeaveRequestService = (repository, dependencies = {}) => {
    if (typeof dependencies.transaction !== 'function') {
        throw new Error('LEAVE_TRANSACTION_REQUIRED');
    }
    const inTransaction = dependencies.transaction;
    const enqueue = dependencies.enqueue || enqueueLeaveRequest;

    return {
        leaveTypes: LEAVE_TYPES,

        async createRequest(user, payload) {
            const leaveType = resolveLeaveType(payload.leave_type);
            const startDate = toDate(payload.start_datetime);
            const endDate = toDate(payload.end_datetime);
            const returnDate = toDate(payload.return_datetime);

            if (!startDate || !endDate || !returnDate) {
                throw new AppError(
                    400,
                    'INVALID_LEAVE_DATES',
                    'Başlangıç, bitiş ve iş başı tarihleri geçerli olmalıdır.'
                );
            }
            if (returnDate < endDate) {
                throw new AppError(
                    400,
                    'INVALID_RETURN_DATE',
                    'İş başı tarihi izin bitişinden önce olamaz.'
                );
            }

            const duration = calculateDuration(startDate, endDate, payload.duration_type);
            return inTransaction(async (txRepository, transactionContext) => {
                const description = payload.description || null;
                const result = await txRepository.create({
                    userId: user.id,
                    leaveType,
                    requesterName: user.name || null,
                    startDate: toIsoDate(startDate),
                    endDate: toIsoDate(endDate),
                    startDateTime: startDate.toISOString(),
                    endDateTime: endDate.toISOString(),
                    returnDateTime: returnDate.toISOString(),
                    durationType: duration.duration_type,
                    durationValue: duration.duration_value,
                    description,
                    status: 'İletildi'
                });
                const request = {
                    id: result.lastID,
                    leave_type: leaveType,
                    start_datetime: startDate.toISOString(),
                    end_datetime: endDate.toISOString(),
                    return_datetime: returnDate.toISOString(),
                    duration_type: duration.duration_type,
                    duration_value: duration.duration_value,
                    description,
                    status: 'İletildi',
                    created_at: new Date().toISOString()
                };
                await enqueue(transactionContext, 'created', request, user);
                return { id: result.lastID, ...duration, status: 'İletildi' };
            });
        },

        async listUserRequests(userId, query) {
            const pagination = parsePagination(query);
            const result = await repository.listUser(userId, query, pagination);
            return paginatedResponse(
                result.items,
                result.total,
                pagination.page,
                pagination.pageSize
            );
        },

        async listAllRequests(query) {
            const pagination = parsePagination(query);
            const result = await repository.listAll(query, pagination);
            return paginatedResponse(
                result.items,
                result.total,
                pagination.page,
                pagination.pageSize
            );
        },

        async updateStatus(id, status, actionedBy) {
            const resolvedStatus = normalizeStatus(status);
            if (!VALID_STATUSES.includes(resolvedStatus)) {
                throw new AppError(400, 'INVALID_LEAVE_STATUS', 'Geçerli bir durum seçin.');
            }
            return inTransaction(async (txRepository, transactionContext) => {
                const result = await txRepository.updateStatus(id, resolvedStatus, actionedBy);
                if (!result.changes) {
                    throw new AppError(
                        404,
                        'LEAVE_REQUEST_NOT_FOUND',
                        'İzin talebi bulunamadı.'
                    );
                }
                if (normalizeKey(resolvedStatus) === 'ONAYLANDI') {
                    const request = await txRepository.findForIntegration(id);
                    await enqueue(transactionContext, 'approved', request, {
                        id: request.user_id,
                        employee_id: request.employee_id,
                        name: request.user_name
                    });
                }
                return { success: true, status: resolvedStatus };
            });
        }
    };
};

const createLeaveRequestServiceForDb = (db, dependencies = {}) => createLeaveRequestService(
    createLeaveRepository(db),
    {
        ...dependencies,
        transaction: work => db.transaction(
            tx => work(createLeaveRepository(tx), tx)
        )
    }
);

module.exports = {
    calculateDuration,
    createLeaveRequestService,
    createLeaveRequestServiceForDb
};
