export const boolValue = (value?: number | boolean) => value === true || value === 1;

export const statusLabel: Record<string, string> = {
  draft: 'Taslak',
  open: 'Açık',
  closed: 'Kapalı',
  cancelled: 'İptal',
  pending: 'Bekliyor',
  in_progress: 'Devam ediyor',
  completed: 'Tamamlandı',
};

export const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('tr-TR') : '-';
