import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, History, Info, Search } from 'lucide-react';
import { API_BASE } from '../config';
import { ExportExcelButton } from '../components/ExportExcelButton';
import { useAppFeedback } from '../components/AppFeedback';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { queryKeys } from '../queryClient';
import { api } from '../services/api';
import type { PolyvalencePeriod } from '../types';
import { PolyvalenceModal } from './PolyvalenceModal';
import { ReportDashboard } from './ReportDashboard';
import { PolyvalenceReportDetails } from './PolyvalenceReportDetails';
import { formatDate, statusLabel } from './utils';
import type { AuditLog, OpenPeriodGap, PolyvalenceDashboard, ReportPeriodGroup } from './types';

type Props = {
  periods: PolyvalencePeriod[]; groups: ReportPeriodGroup[]; openGaps: OpenPeriodGap[];
  activeMembershipCount: number; canManage: boolean; onError: (message: string) => void;
};
const periodKey = (period: PolyvalencePeriod) => String(period.start_date).slice(0, 10) + '_' + String(period.end_date).slice(0, 10);

async function downloadReport(periodId: number, mode: 'matrix' | 'detail') {
  const response = await fetch(API_BASE + '/api/polyvalence/admin/periods/' + periodId + '/export.csv?mode=' + mode);
  if (!response.ok) throw new Error('Rapor indirilemedi');
  const blob = await response.blob();
  const filename = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1];
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename ? decodeURIComponent(filename) : 'polivalans-' + periodId + '-' + mode + '.csv';
  link.click(); URL.revokeObjectURL(link.href);
}

export function PolyvalenceReportsPanel(props: Props) {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const [selected, setSelected] = useState<PolyvalencePeriod | null>(null);
  const [scope, setScope] = useState('all');
  const [position, setPosition] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<'active' | 'past'>('active');
  const [department, setDepartment] = useState('all');
  const [search, setSearch] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
  const selectedGroup = selected ? props.groups.find(item => item.key === periodKey(selected)) : null;
  const scopedPeriod = selected ? scope === String(selected.department_id)
    ? props.periods.find(item => item.id === selected.id) || selected
    : props.periods.find(item => item.id === selectedGroup?.departments.find(department => String(department.id) === scope)?.period_id) : null;
  const periodId = scopedPeriod?.id;
  const dashboardQuery = useQuery({
    queryKey: ['admin', 'polyvalence', 'report-dashboard', selected && periodKey(selected), periodId || 'all', position],
    queryFn: () => {
      const params = new URLSearchParams({ position });
      if (periodId) params.set('period_id', String(periodId));
      else if (selected) params.set('group_key', periodKey(selected));
      return api.get<PolyvalenceDashboard>('/api/polyvalence/admin/report-dashboard?' + params);
    },
    enabled: Boolean(selected && (periodId || (props.canManage && scope === 'all'))),
    refetchInterval: selected?.status === 'open' ? 60_000 : false,
  });
  const syncMutation = useMutation({
    mutationFn: (id: number) => api.post<{ added_members: number; added_skills: number; added_assessments: number; reopened_tasks: number }>('/api/polyvalence/admin/periods/' + id + '/sync-open', {}),
    onSuccess: async result => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalencePeriods }),
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceOpenGaps }),
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceReportGroups }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'polyvalence', 'report-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'polyvalence', 'period-report'] }),
      ]);
      feedback.notifySuccess('Döneme dahil edildi: ' + result.added_members + ' çalışan, ' + result.added_skills + ' beceri, ' + result.added_assessments + ' değerlendirme. Yeniden açılan görev: ' + result.reopened_tasks);
    },
    onError: error => props.onError(error.message),
  });
  const closeMutation = useMutation({
    mutationFn: (id: number) => api.post('/api/polyvalence/admin/periods/' + id + '/close', {}),
    onSuccess: async () => {
      setSelected(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalencePeriods }),
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceSetup }),
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceReportGroups }),
        queryClient.invalidateQueries({ queryKey: queryKeys.polyvalenceOpenGaps }),
      ]);
      feedback.notifySuccess('Dönem kapatıldı. Zamanı gelen sonraki takvim, otomatik kontrolde açılır.');
    },
    onError: error => props.onError(error.message),
  });
  const confirmClose = async (period: PolyvalencePeriod) => {
    if (await feedback.confirm({ title: 'Dönemi kapat', confirmLabel: 'Dönemi kapat',
      message: `${period.department_name} / ${period.name} kapatılacak. Puanlar korunur ve bu dönem artık düzenlenemez. Onaylıyor musunuz?` })) closeMutation.mutate(period.id);
  };
  const auditMutation = useMutation({
    mutationFn: (id: number) => api.get<AuditLog[] | { logs: AuditLog[] }>('/api/polyvalence/admin/periods/' + id + '/audit'),
    onSuccess: result => setAuditLogs(Array.isArray(result) ? result : result.logs || []),
    onError: error => props.onError(error.message),
  });
  const departments = [...new Map(props.periods.map(item => [item.department_id, item.department_name || '—'])).entries()];
  const filtered = props.periods.filter(item => {
    const active = item.status === 'open' || item.status === 'draft';
    return (periodFilter === 'active' ? active : !active)
      && (department === 'all' || String(item.department_id) === department)
      && (item.name + ' ' + item.department_name).toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'));
  });
  const openReport = (period: PolyvalencePeriod) => { setSelected(period); setScope(String(period.department_id)); setPosition('all'); };
  const dashboard = dashboardQuery.data;

  if (!selected) return <div className="poly-section-stack">
    <div className="poly-report-filters">
      {props.canManage && <label className="poly-field">Bölüm<select value={department} onChange={event => setDepartment(event.target.value)}><option value="all">Tüm bölümler</option>{departments.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
      <label className="poly-search-field"><Search size={18} /><input aria-label="Dönem veya bölüm ara" value={search} onChange={event => setSearch(event.target.value)} placeholder="Dönem veya bölüm ara…" /></label>
    </div>
    <nav className="poly-workspace-nav" aria-label="Dönem durumu">
      <button type="button" aria-current={periodFilter === 'active' ? 'page' : undefined} onClick={() => setPeriodFilter('active')}>Açık ve planlanan dönemler · {props.periods.filter(item => item.status === 'open' || item.status === 'draft').length}</button>
      <button type="button" aria-current={periodFilter === 'past' ? 'page' : undefined} onClick={() => setPeriodFilter('past')}>Geçmiş dönemler · {props.periods.filter(item => item.status === 'closed' || item.status === 'cancelled').length}</button>
    </nav>
    {props.canManage && props.openGaps.length > 0 && <div className="poly-open-gap-list">{props.openGaps.map(item => <article key={item.period_id}><AlertTriangle size={18} /><div><strong>{item.department_name} · {item.period_name}</strong><small>{item.missing_members} çalışan, {item.missing_skills} beceri ve {item.missing_assessments} değerlendirme satırı henüz dönemde değil.</small></div><button type="button" className="btn-secondary poly-command" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate(item.period_id)}>Döneme dahil et</button></article>)}</div>}
    <section className="poly-surface"><div className="poly-table-scroll" role="region" aria-label="Değerlendirme dönemleri" tabIndex={0}>
      <table className="poly-data-table"><thead><tr><th>Dönem</th><th>Bölüm</th><th>Son tarih</th><th>Tamamlanma</th><th>Durum</th><th>İşlem</th></tr></thead>
        <tbody>{filtered.map(period => {
          const total = Number(period.task_total || 0), completed = Number(period.task_completed || 0);
          return <tr key={period.id}><td><strong>{period.name}</strong><small>{formatDate(period.start_date)} – {formatDate(period.end_date)}</small></td><td>{period.department_name}</td><td>{formatDate(period.due_date)}</td>
            <td><small>{completed} / {total} değerlendirici görevi</small><progress className="poly-progress" max={Math.max(total, 1)} value={completed} aria-label={period.name + ' görev tamamlanma oranı'} /></td>
            <td><span className={'poly-status poly-status-' + period.status}>{statusLabel[period.status]}</span></td>
            <td><div className="poly-table-actions"><button type="button" className="poly-text-button" onClick={() => openReport(period)} aria-label={period.department_name + ' ' + period.name + ' raporunu aç'}>Raporu aç <ArrowRight size={16} /></button>{props.canManage && period.status === 'open' && <button type="button" className="btn-secondary poly-command" disabled={closeMutation.isPending || !total || completed !== total} title={!total || completed !== total ? 'Tüm değerlendirici görevleri tamamlandığında kapatılabilir.' : undefined} onClick={() => void confirmClose(period)}>Dönemi kapat</button>}</div></td></tr>;
        })}</tbody>
      </table>
      {!filtered.length && <p className="poly-empty">Bu filtrelerde dönem bulunamadı.{props.canManage && !props.periods.length ? ' Yönetim bölümündeki değerlendirme takvimini yapılandırın.' : ''}</p>}
    </div><p className="poly-notice"><Info size={17} /> Açık dönemlerde raporlar değerlendirmeler kaydedildikçe güncellenir. Kapalı dönemler değiştirilemez.</p></section>
  </div>;

  return <div className="poly-section-stack poly-report-modern">
    <button type="button" className="poly-text-button poly-back-link" onClick={() => { setSelected(null); setPosition('all'); }}><ArrowLeft size={17} /> Dönemlere dön</button>
    <div className="poly-workspace-heading"><div><h2>{scope === 'all' ? 'Tüm bölümler' : scopedPeriod?.department_name}</h2><p>Polivalans Raporu · {selected.name} · {formatDate(selected.start_date)} – {formatDate(selected.end_date)}</p></div>
      {props.canManage && (selectedGroup?.departments.length || 0) > 1 && <label className="poly-field">Rapor kapsamı<select value={scope} onChange={event => { setScope(event.target.value); setPosition('all'); }}>
        <option value="all">Tüm bölümler</option>{selectedGroup?.departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>}
    </div>
    {dashboard && <section className="poly-report-completion"><div><strong>Değerlendirme ilerlemesi</strong><small>{dashboard.summary.completed_employees} / {dashboard.summary.total_employees} çalışan tüm becerilerde değerlendirildi</small></div><progress className="poly-progress" max="100" value={dashboard.summary.completion_percent} aria-label="Çalışan değerlendirme ilerlemesi" /><strong>%{dashboard.summary.completion_percent}</strong><span>Son tarih: {formatDate(scopedPeriod?.due_date || selectedGroup?.due_date || selected.due_date)}</span></section>}
    <div className="poly-report-filters"><label className="poly-field">Pozisyon<select value={position} onChange={event => setPosition(event.target.value)}><option value="all">Tüm pozisyonlar</option>{dashboard?.positions.map(item => <option key={item.key} value={item.key}>{item.name}</option>)}</select></label>
      {periodId && <div className="poly-table-actions"><button type="button" className="btn-secondary poly-command" disabled={auditMutation.isPending} onClick={() => auditMutation.mutate(periodId)}><History size={16} /> Tarihçe</button>
        <ExportExcelButton label="Detay raporu" onClick={() => void downloadReport(periodId, 'detail').catch(error => props.onError(error.message))} /><ExportExcelButton label="Matris raporu" onClick={() => void downloadReport(periodId, 'matrix').catch(error => props.onError(error.message))} /></div>}
    </div>
    {dashboardQuery.isPending && <LoadingIndicator compact label="Rapor hazırlanıyor" />}
    {dashboardQuery.error && <div className="poly-alert" role="alert">{dashboardQuery.error.message}<button type="button" onClick={() => void dashboardQuery.refetch()}>Tekrar dene</button></div>}
    {dashboard && <ReportDashboard dashboard={dashboard} />}
    {periodId && <PolyvalenceReportDetails key={periodId} periodId={periodId} position={position} canManage={props.canManage} onError={props.onError} />}
    {auditLogs && <PolyvalenceModal title={selected.name + ' Tarihçesi'} onClose={() => setAuditLogs(null)}><div className="poly-audit-list">
      {auditLogs.map(log => <article key={log.id}><History size={16} /><div><strong>{log.action}</strong><small>{log.actor_name || 'Sistem'} · {formatDate(log.created_at)}</small>{log.reason && <p>{log.reason}</p>}{(log.old_value || log.new_value) && <details><summary>Kayıt detayları</summary><pre>{log.new_value || log.old_value}</pre></details>}</div></article>)}
      {!auditLogs.length && <p className="poly-empty">Bu dönem için tarihçe bulunmuyor.</p>}
    </div></PolyvalenceModal>}
  </div>;
}
