import type { AuditEntry, AuditOutcome } from './types';
export const outcomeLabel: Record<AuditOutcome, string> = { success: 'Başarılı', denied: 'Reddedildi', error: 'Hata', pending: 'Sonuç bekleniyor', aborted: 'Bağlantı kesildi' };
export const actorLabel = (entry: AuditEntry) => entry.actor_name || (entry.actor_id ? 'Kullanıcı #' + entry.actor_id : 'Kimliği doğrulanmadı');
export const auditDate = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value.replace(' ', 'T').replace(/Z$/, '') + 'Z');
  return Number.isNaN(+date) ? '—' : date.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'medium' });
};
export const expiryDate = (entry: AuditEntry) => {
  const date = new Date(entry.created_at.replace(' ', 'T').replace(/Z$/, '') + 'Z');
  return auditDate(new Date(+date + entry.retention_days * 86_400_000).toISOString());
};
export const fieldLabel: Record<string, string> = { title: 'Başlık', description: 'Açıklama', category: 'Kategori', name: 'Ad soyad', department: 'Bölüm', position: 'Pozisyon', phone: 'Telefon', address: 'Adres', birth_date: 'Doğum tarihi', email: 'E-posta', permissions: 'Yetkiler', role: 'Rol', status: 'Durum', decision: 'Karar', level: 'Yetkinlik seviyesi', can_train: 'Eğitim verebilir', target_level: 'Hedef seviye', awards_badge: 'Rozet', certificate_enabled: 'Sertifika', is_active: 'Aktiflik', is_archived: 'Arşiv durumu' };
