import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ClipboardList, Eye, RefreshCw } from 'lucide-react';
import { useAuth } from './AuthContext';
import { api } from './services/api';
import { ModulePageHeader } from './components/ModulePageHeader';
import { ExportExcelButton } from './components/ExportExcelButton';
import { PaginationControls } from './components/PaginationControls';
import { AsyncState } from './components/AsyncState';
import { AuditLogDetails } from './audit/AuditLogDetails';
import { actorLabel, auditDate, outcomeLabel } from './audit/auditFormat';
import type { AuditEntry, AuditFilters, AuditList, AuditPolicy } from './audit/types';

const emptyFilters: AuditFilters = { user: '', module: '', action: '', outcome: '', from: '', to: '', held: '' };
export const AdminAuditLogs = () => {
  const { user } = useAuth();
  const allowed = user?.role === 'admin';
  const [draft, setDraft] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const filterString = params.toString();
  params.set('page', String(page)); params.set('pageSize', '25');
  const policy = useQuery({ queryKey: ['audit-policy'], queryFn: () => api.get<AuditPolicy>('/api/admin/audit-logs/policy'), enabled: allowed, refetchInterval: 60_000 });
  const list = useQuery({ queryKey: ['audit-list', filterString, page], queryFn: () => api.get<AuditList>('/api/admin/audit-logs?' + params.toString()), enabled: allowed, placeholderData: previous => previous });
  const download = useMutation({ mutationFn: async () => {
    const blob = await api.download('/api/admin/audit-logs/export?' + filterString);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'Log_Kayitlari.csv';
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } });
  const field = (key: keyof AuditFilters, value: string) => setDraft(current => ({ ...current, [key]: value }));
  const validDates = !draft.from || !draft.to || draft.from <= draft.to;
  if (!allowed) return <AsyncState kind="error" title="Bu alana erişiminiz yok" message="Log kayıtlarını yalnız sistem yöneticisi görüntüleyebilir." />;
  return <section className="audit-page">
    <ModulePageHeader title="Log Kayıtları" description="Kullanıcı işlemlerini, güvenlik olaylarını ve saklama durumunu takip edin." icon={<ClipboardList />} tone="violet" actions={<button type="button" className="btn-secondary" disabled={list.isFetching || policy.isFetching} onClick={() => { void list.refetch(); void policy.refetch(); }}><RefreshCw size={17} /> Yenile</button>} />
    <div className="audit-policy-bar"><span>Genel kayıtlar <b>180 gün</b></span><span>Kritik kayıtlar <b>1 yıl</b></span><span>Temizlik <b>Günlük</b></span><small>Son başarılı kontrol: {auditDate(policy.data?.last_purge?.created_at)}</small></div>
    {policy.error && <p className="audit-error" role="alert">Saklama bilgileri alınamadı. Yenileyerek tekrar deneyin.</p>}
    {policy.data?.cleanup_overdue && <p className="audit-notice" role="status">Otomatik temizlik kontrolü henüz yapılmamış veya gecikmiş. Arka plan hizmetinin çalışması kontrol edilmelidir.</p>}
    {!!policy.data?.unfinished_count && <p className="audit-notice" role="status">{policy.data.unfinished_count} kaydın sonucu henüz doğrulanmamış. İnceleme için sonuç filtresinden “Sonuç bekleniyor” seçin.</p>}
    <form className="premium-card audit-filters" onSubmit={event => { event.preventDefault(); if (validDates) { setFilters({ ...draft, user: draft.user.trim() }); setPage(1); } }}>
      <label>Kullanıcı veya sicil<input className="form-control" value={draft.user} maxLength={100} onChange={event => field('user', event.target.value)} placeholder="Ad veya sicil ara" /></label>
      <label>Modül<select className="form-control" aria-label="Modül" value={draft.module} onChange={event => field('module', event.target.value)}><option value="">Tüm modüller</option>{policy.data?.modules.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>İşlem<select className="form-control" aria-label="İşlem" value={draft.action} onChange={event => field('action', event.target.value)}><option value="">Tüm işlemler</option>{policy.data?.actions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <label>Sonuç<select className="form-control" aria-label="Sonuç" value={draft.outcome} onChange={event => field('outcome', event.target.value)}><option value="">Tüm sonuçlar</option>{Object.entries(outcomeLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Başlangıç tarihi<input className="form-control" type="date" value={draft.from} max={draft.to || undefined} onChange={event => field('from', event.target.value)} /></label>
      <label>Bitiş tarihi<input className="form-control" type="date" value={draft.to} min={draft.from || undefined} onChange={event => field('to', event.target.value)} /></label>
      <label className="audit-held-filter"><input type="checkbox" checked={draft.held === 'true'} onChange={event => field('held', event.target.checked ? 'true' : '')} /> Yalnız korunan kayıtlar</label>
      <div className="audit-filter-actions"><button type="button" className="btn-secondary" onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); }}>Temizle</button><button type="submit" className="btn-primary" disabled={!validDates || list.isFetching}>Filtrele</button></div>
      {!validDates && <p className="audit-error" role="alert">Başlangıç tarihi bitiş tarihinden sonra olamaz.</p>}
    </form>
    <div className="audit-summary" aria-label="Filtrelenen kayıt özeti"><span><b>{list.data?.summary.total ?? 0}</b> kayıt</span><span><b>{list.data?.summary.failed ?? 0}</b> başarısız / reddedilen</span><span><b>{list.data?.summary.held ?? 0}</b> korunan</span></div>
    <section className="premium-card audit-records"><header><h2>İşlem Günlüğü</h2><ExportExcelButton disabled={!list.data?.items.length || list.isFetching || list.isError || download.isPending} label={download.isPending ? 'Hazırlanıyor…' : "Excel'e Aktar"} onClick={() => download.mutate()} /></header>
      {download.error && <p role="alert" className="audit-error">{download.error.message}</p>}
      {list.isPending ? <AsyncState kind="loading" title="Log kayıtları yükleniyor" /> : list.error ? <AsyncState kind="error" title="Log kayıtları alınamadı" message={list.error.message} onRetry={() => void list.refetch()} /> : !list.data?.items.length ? <p className="audit-empty">Bu filtrelere uygun log kaydı bulunamadı.</p> : <>
        <div className="audit-table-scroll"><table className="audit-table"><thead><tr><th>Tarih / saat</th><th>Kullanıcı</th><th>Modül</th><th>İşlem</th><th>Sonuç</th><th>Açıklama</th><th>Detay</th></tr></thead><tbody>{list.data.items.map(entry => <tr key={entry.source + ':' + entry.id}>
          <td data-label="Tarih / saat">{auditDate(entry.created_at)}</td><td data-label="Kullanıcı"><strong>{actorLabel(entry)}</strong>{entry.actor_employee_id && <small>Sicil {entry.actor_employee_id}</small>}</td>
          <td data-label="Modül">{entry.module_label}</td><td data-label="İşlem">{entry.action_label}</td><td data-label="Sonuç"><span className={'audit-result audit-result-' + entry.outcome}>{outcomeLabel[entry.outcome]}</span>{entry.held_at && <small>Koruma altında</small>}</td><td data-label="Açıklama">{entry.description}</td>
          <td data-label="Detay"><button type="button" className="btn-icon" aria-label={actorLabel(entry) + ' ' + entry.action_label + ' log kaydını aç'} onClick={() => setSelected(entry)}><Eye size={18} /></button></td>
        </tr>)}</tbody></table></div>
        <PaginationControls pagination={list.data.pagination} onPageChange={setPage} />
      </>}
    </section>
    <p className="audit-footnote">Saatler Türkiye saatidir. Veri okuma, otomatik yenilemeleri de içerebilir; sayfanın açıldığını göstermez. Anonim yanıtlar ve kişisel başvuru içerikleri bu günlükle kullanıcıya bağlanmaz. Süre dolumu, asıl eğitim ve personel kayıtlarını silmez.</p>
    {selected && <AuditLogDetails key={selected.source + ':' + selected.id} entry={selected} onClose={() => setSelected(null)} />}
  </section>;
};
