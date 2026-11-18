import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Search, X } from 'lucide-react';
import { ModalShell } from '../components/ModalShell';
import { AsyncState } from '../components/AsyncState';
import { PaginationControls } from '../components/PaginationControls';
import { api } from '../services/api';
import type { NotificationSubscription } from './types';

const dateLabel = (value: string) => {
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });
};
const deviceLabel = (value: string | null) => {
  if (!value) return 'Cihaz bilgisi yok';
  if (!value.startsWith('Mozilla/')) return value;
  const platform = /iPhone|iPad/.test(value) ? 'iOS' : /Android/.test(value) ? 'Android' : /Windows/.test(value) ? 'Windows' : /Macintosh/.test(value) ? 'macOS' : 'Diğer';
  const browser = /Edg\//.test(value) ? 'Edge' : /Chrome\//.test(value) ? 'Chrome' : /Firefox\//.test(value) ? 'Firefox' : /Safari\//.test(value) ? 'Safari' : 'Tarayıcı';
  return `${platform} · ${browser}`;
};

export function NotificationSubscribersModal({ initialStatus, onClose }: { initialStatus: 'all' | 'active'; onClose: () => void }) {
  const [status, setStatus] = useState<'all' | 'active' | 'passive'>(initialStatus);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'notifications', 'subscriptions', page, status, search],
    queryFn: () => api.list<NotificationSubscription>('/api/notifications/admin/subscriptions?' + new URLSearchParams({ page: String(page), pageSize: '20', status, search })),
  });
  return <ModalShell onClose={onClose} ariaLabel="Bildirim abonelikleri" className="admin-action-modal notify-modal notify-subscribers-modal">
    <div className="admin-modal-header"><div><h3>Bildirim abonelikleri</h3><p>Her satır bir cihaz aboneliğidir; aynı kullanıcı birden fazla cihazla görünebilir.</p></div><button type="button" className="admin-modal-close" aria-label="Kapat" onClick={onClose}><X size={18} /></button></div>
    <p className="notify-subscriber-help">Aktif, bildirim gönderimine açık aboneliktir; cihazın şu anda çevrimiçi olduğu veya bildirimi okuduğu anlamına gelmez.</p>
    <form className="notify-subscriber-filters" onSubmit={event => { event.preventDefault(); setPage(1); setSearch(draft.trim()); }}>
      <label className="notify-search"><Search size={16} /><input aria-label="Abonelerde kullanıcı, sicil veya bölüm ara" placeholder="Kullanıcı, sicil veya bölüm ara" value={draft} maxLength={100} onChange={event => setDraft(event.target.value)} /></label>
      <select aria-label="Abonelik durumu" className="notify-status-filter" value={status} onChange={event => { setStatus(event.target.value as typeof status); setPage(1); }}><option value="all">Tüm abonelikler</option><option value="active">Aktif cihazlar</option><option value="passive">Pasif abonelikler</option></select>
      <button type="submit" className="notify-primary-btn">Ara</button>
      <button type="button" className="notify-ghost-btn" aria-label="Abonelikleri yenile" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={17} /></button>
    </form>
    {query.isLoading ? <AsyncState kind="loading" title="Abonelikler yükleniyor" /> : query.isError ? <AsyncState kind="error" title="Abonelikler alınamadı" onRetry={() => void query.refetch()} /> : !query.data?.items.length ? <AsyncState kind="empty" title="Bu filtrede abonelik bulunamadı" /> : <>
      <p className="notify-subscriber-help">{query.data.pagination.total} cihaz aboneliği</p>
      <div className="notify-subscriber-list">{query.data.items.map(item => <article className="notify-subscriber-card" key={item.id}>
        <div><strong>{item.name || 'Kullanıcı #' + item.user_id}</strong><small>Sicil: {item.employee_id || '—'} · {item.department || 'Bölüm belirtilmemiş'}</small>{item.user_status !== 'active' && <small>Kullanıcı hesabı aktif değil</small>}</div>
        <span className={'notify-pill ' + (item.is_active ? 'active' : 'passive')}>{item.is_active ? 'Aktif' : 'Pasif'}</span>
        <dl><div><dt>Cihaz / tarayıcı</dt><dd>{deviceLabel(item.device_label)}</dd></div><div><dt>Abonelik tarihi</dt><dd>{dateLabel(item.created_at)}</dd></div><div><dt>Son abonelik güncellemesi</dt><dd>{dateLabel(item.updated_at)}</dd></div></dl>
      </article>)}</div>
      <PaginationControls pagination={query.data.pagination} onPageChange={setPage} />
    </>}
  </ModalShell>;
}
