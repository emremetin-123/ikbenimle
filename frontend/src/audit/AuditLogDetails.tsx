import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, X } from 'lucide-react';
import { api } from '../services/api';
import { ModalShell } from '../components/ModalShell';
import { AsyncState } from '../components/AsyncState';
import { useAppFeedback } from '../components/AppFeedback';
import type { AuditEntry } from './types';
import { actorLabel, auditDate, expiryDate, fieldLabel, outcomeLabel } from './auditFormat';

export function AuditLogDetails({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  const client = useQueryClient();
  const feedback = useAppFeedback();
  const [reason, setReason] = useState('');
  const path = '/api/admin/audit-logs/' + entry.source + '/' + entry.id;
  const query = useQuery({ queryKey: ['audit-detail', entry.source, entry.id], queryFn: () => api.get<AuditEntry>(path) });
  const mutation = useMutation({
    mutationFn: (release: boolean) => api.post(path + (release ? '/release' : '/hold'), release ? {} : { reason: reason.trim() }),
    onSuccess: async () => {
      await Promise.all([client.invalidateQueries({ queryKey: ['audit-detail', entry.source, entry.id] }), client.invalidateQueries({ queryKey: ['audit-list'] })]);
      setReason('');
    }
  });
  const data = query.data;
  const release = async () => {
    if (await feedback.confirm({ title: 'Kaydın korumasını kaldır', message: 'Saklama süresi dolmuşsa kayıt sonraki otomatik temizlikte silinir.', confirmLabel: 'Korumayı kaldır', danger: true })) mutation.mutate(true);
  };
  return <ModalShell onClose={() => { if (!mutation.isPending) onClose(); }} labelledBy="audit-detail-title" overlayClassName="audit-detail-overlay" surfaceClassName="premium-card audit-detail-modal">
    <header className="audit-detail-header"><h2 id="audit-detail-title">Log Kaydı Detayı</h2><button type="button" className="btn-icon" disabled={mutation.isPending} onClick={onClose} aria-label="Log detayını kapat"><X size={20} /></button></header>
    {query.isPending ? <AsyncState kind="loading" title="Log kaydı yükleniyor" /> : query.error ? <AsyncState kind="error" title="Log kaydı açılamadı" message={query.error.message} onRetry={() => void query.refetch()} /> : data && <>
      <dl className="audit-detail-grid">
        <div><dt>Tarih / saat</dt><dd>{auditDate(data.created_at)}</dd></div><div><dt>Kullanıcı</dt><dd>{actorLabel(data)}{data.actor_employee_id ? ' · Sicil ' + data.actor_employee_id : ''}</dd></div>
        <div><dt>Modül / işlem</dt><dd>{data.module_label} · {data.action_label}</dd></div><div><dt>Sonuç</dt><dd><span className={'audit-result audit-result-' + data.outcome}>{outcomeLabel[data.outcome]}</span>{data.http_status ? ' · HTTP ' + data.http_status : ''}</dd></div>
        <div><dt>İlgili kayıt</dt><dd>{data.resource_id || '—'}</dd></div><div><dt>IP adresi</dt><dd>{data.ip_address || '—'}</dd></div>
        <div><dt>Saklama</dt><dd>{data.retention_days} gün{data.hold_reason ? ' · Koruma altında' : ' · Süre sonu ' + expiryDate(data)}</dd></div>
        <div><dt>İşlem kimliği</dt><dd>{data.id}</dd></div>
        {data.request_id && <div><dt>İstek kimliği</dt><dd>{data.request_id}</dd></div>}
      </dl>
      {data.outcome === 'pending' && <p className="audit-notice">İşlemin başlangıcı kaydedilmiş, sonucu henüz doğrulanmamış. Bu kayıt başarı anlamına gelmez.</p>}
      {!!data.details?.changed_fields?.length && <p className="audit-notice"><strong>İstekte bulunan alanlar:</strong> {data.details.changed_fields.map(key => fieldLabel[key] || key).join(', ')}. Alan içerikleri bu günlüğe kopyalanmaz.</p>}
      {data.details?.before && <p className="audit-notice">Önceki puan: {data.details.before.level_value ?? 'Değerlendirilmemiş'} · {data.outcome === 'success' && data.details.level_value != null ? 'Kaydedilen puan: ' + data.details.level_value : 'İstenen puan: ' + (data.details.level ?? '—')}</p>}
      <section className="audit-hold-section"><h3><ShieldCheck size={18} /> Saklama koruması</h3>
        {data.hold_reason ? <><p>{data.hold_reason}</p><small>{data.held_by_name} · {auditDate(data.held_at)}</small><button type="button" className="btn-secondary" disabled={mutation.isPending} onClick={() => void release()}>Korumayı kaldır</button></> : <form onSubmit={event => { event.preventDefault(); mutation.mutate(false); }}>
          <p>İncelemesi devam eden kayıtları, gerekçesiyle otomatik silme dışında tutabilirsiniz. Korunan kayıtlar düzenli gözden geçirilmelidir.</p>
          <label htmlFor="audit-hold-reason">Koruma gerekçesi</label><textarea id="audit-hold-reason" className="form-control" rows={3} minLength={10} maxLength={500} required value={reason} onChange={event => setReason(event.target.value)} disabled={mutation.isPending} />
          <button type="submit" className="btn-secondary" disabled={mutation.isPending || reason.trim().length < 10}>Korumaya al</button>
        </form>}
        {mutation.error && <p role="alert" className="audit-error">{mutation.error.message}</p>}
      </section>
    </>}
  </ModalShell>;
}
