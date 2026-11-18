import type { AdminStatsRow } from '../types';

export interface TrainingOutcome {
  className: 'badge-completed' | 'badge-error' | 'badge-pending' | 'badge-cancelled';
  label: 'Tamamlandı' | 'Başarılı' | 'Başarısız' | 'Atandı' | 'Süresi Geçti' | 'Kaldırıldı';
}

export function getTrainingOutcome(row: AdminStatsRow): TrainingOutcome {
  if (row.status === 'cancelled') {
    return { className: 'badge-cancelled', label: 'Kaldırıldı' };
  }

  if (row.status !== 'completed') {
    if (row.due_date && new Date(row.due_date).getTime() < Date.now()) {
      return { className: 'badge-error', label: 'Süresi Geçti' };
    }
    return { className: 'badge-pending', label: 'Atandı' };
  }

  const requiresQuiz = !(row.requires_quiz === false || Number(row.requires_quiz) === 0);
  if (!requiresQuiz) {
    return { className: 'badge-completed', label: 'Tamamlandı' };
  }

  const passed = row.quiz_score !== null
    && Number(row.quiz_score) >= Number(row.pass_score || 0);
  return passed
    ? { className: 'badge-completed', label: 'Başarılı' }
    : { className: 'badge-error', label: 'Başarısız' };
}
