import type { IntegrationApiKey, IntegrationConnection, IntegrationJob, IntegrationScope } from './types';

// API timestamps without an offset are database UTC timestamps.
export const timestamp = (value: string) => new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value.replace(' ', 'T') + 'Z');
export const formatDate = (value?: string | null) => value ? timestamp(value).toLocaleString('tr-TR') : 'Henüz yok';
export const keyExpired = (key: IntegrationApiKey) => Boolean(key.expires_at && timestamp(key.expires_at).getTime() <= Date.now());
export const connectionSummary = (connection: IntegrationConnection | null) => {
  if (!connection) return { label: 'Henüz kaydedilmedi', description: 'Veri akışlarını seçip bağlantıyı oluşturun.', tone: 'neutral' as const };
  if (!connection.is_enabled) return { label: 'Bağlantı kapalı', description: 'Veri aktarımını başlatmak için bağlantıyı etkinleştirin.', tone: 'neutral' as const };
  if (!connection.active_key_count) return { label: 'Kurulum bekliyor', description: 'Bağlanacak uygulama için güvenli erişim anahtarı oluşturun.', tone: 'warning' as const };
  if (connection.last_error_code) return { label: 'Kontrol gerekiyor', description: 'Son aktarımda hata oluştu. Aktarım geçmişini kontrol edin.', tone: 'danger' as const };
  if (connection.last_success_at) return { label: 'Bağlantı çalışıyor', description: 'Veriler başarıyla aktarılıyor.', tone: 'success' as const };
  if (connection.last_seen_at) return { label: 'Bağlantı doğrulandı', description: 'İlk veri aktarımı bekleniyor.', tone: 'info' as const };
  return { label: 'İlk bağlantı bekleniyor', description: 'Kurulum bilgilerini bağlanacak uygulamanın yazılımcısıyla paylaşın.', tone: 'warning' as const };
};
export const jobLabels: Record<IntegrationJob['status'], string> = {
  pending: 'Bekliyor', leased: 'İşleniyor', retry: 'Tekrar denenecek', completed: 'Aktarıldı', dead_letter: 'Denemeler durdu',
};
export const scopeLabels: Record<IntegrationScope, string> = {
  'payrolls:write': 'Bordrolar',
  'employees:write': 'Çalışanlar', 'leave-balances:write': 'İzin bakiyesi',
  'leave-requests:read': 'İzin talepleri', 'leave-requests:ack': 'İzin talepleri',
};
export const scopeSummary = (scopes: IntegrationScope[]) => Array.from(
  new Set(scopes.map(scope => scopeLabels[scope]))
).join(' · ');
const actions: Record<string, string> = {
  'connection.created': 'Bağlantı oluşturuldu', 'connection.updated': 'Bağlantı ayarları değiştirildi',
  'api_key.created': 'API anahtarı oluşturuldu', 'api_key.revoked': 'API anahtarı iptal edildi',
  'payrolls.upsert': 'Bordro PDF aktarımı',
  'employees.upsert': 'Çalışan bilgileri aktarımı', 'leave_balances.upsert': 'İzin bakiyesi aktarımı',
  'leave_requests.claim': 'İzin talepleri alındı', 'leave_requests.ack': 'İzin aktarımı sonucu',
  'leave_request.created': 'İzin talebi oluşturuldu', 'leave_request.approved': 'İzin talebi onaylandı',
};
export const actionLabel = (action: string) => actions[action] || 'Entegrasyon işlemi';
export const directionLabels: Record<string, string> = { admin: 'Yönetim', inbound: 'Portala gelen veri', outbound: 'Portaldan gönderilen veri' };
export const resultLabels: Record<string, string> = { success: 'Başarılı', succeeded: 'Başarılı', failed: 'Başarısız' };
