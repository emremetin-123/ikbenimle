import type { FeedbackItem } from '../types';
export type { FeedbackItem } from '../types';
export type { FeedbackThread } from '../admin-feedback/feedbackSupport';

export const feedbackStages = [['pending', 'Alındı'], ['assigned', 'Atandı'], ['in_review', 'İnceleniyor']] as const;
export const feedbackDecisions = [
    ['approved', 'Onaylandı'], ['rejected', 'Reddedildi'],
    ['needs_revision', 'Revizyon istendi'], ['deferred', 'Ertelendi'],
] as const;
export const feedbackStatuses = [...feedbackStages, ...feedbackDecisions, ['completed', 'Tamamlandı']] as const;
export const statusText = (value?: string | null) => feedbackStatuses.find(([key]) => key === value)?.[1]
    || ({ resolved: 'Tamamlandı', waiting_opinion: 'Görüş bekleniyor', in_progress: 'Uygulamaya alındı' }[value || ''] ?? 'Alındı');
export const closed = (value?: string | null) => ['resolved', 'completed', 'rejected'].includes(value || '');
export const feedbackStatus = (item: FeedbackItem) => item.display_status || item.status || 'pending';
export const typeKey = (value?: string | null) => /şik|sik|complaint/i.test(value || '') ? 'complaint' : 'suggestion';
export const typeText = (value?: string | null) => typeKey(value) === 'complaint' ? 'Şikâyet' : 'Öneri';
export const detailsOf = (item?: FeedbackItem | null): Record<string, string> | null => {
    try { return item?.details ? JSON.parse(item.details) : null; } catch { return null; }
};
export const dateText = (value?: string | null, time = false) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('tr-TR', { dateStyle: 'short', ...(time ? { timeStyle: 'short' as const } : {}) });
};
export const roleText = (item: FeedbackItem, userId?: number) => Number(item.assigned_to_user_id) === userId ? 'Sorumlu' : 'Katılımcı';
export const feedbackKeys = {
    mine: ['feedback', 'mine'] as const,
    participating: ['feedback', 'participating'] as const,
    detail: (id: number) => ['feedback', 'detail', id] as const,
    thread: (id: number, admin = false) => ['feedback', 'thread', admin ? 'admin' : 'employee', id] as const,
};
