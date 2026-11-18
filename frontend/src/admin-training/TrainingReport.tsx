import { useDeferredValue, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Filter,
  Gauge,
  Trash2,
} from 'lucide-react';
import { API_BASE } from '../config';
import { ExportExcelButton } from '../components/ExportExcelButton';
import { PaginationControls } from '../components/PaginationControls';
import { queryKeys } from '../queryClient';
import { api } from '../services/api';
import type { AdminStatsRow, PaginatedResponse } from '../types';
import { getTrainingOutcome } from './trainingStatus';
import { useAppFeedback } from '../components/AppFeedback';
import { LoadingIndicator } from '../components/LoadingIndicator';

interface TrainingReportProps {
  trainingCount: number;
  onChanged: () => void | Promise<void>;
}

type TrainingStatsResponse = PaginatedResponse<AdminStatsRow> & {
  summary: { total: number; completed: number; cancelled: number; overdue: number; passed: number };
};

const EMPTY_ROWS: AdminStatsRow[] = [];
type TrainingReportStatus = '' | 'assigned' | 'pending' | 'completed' | 'passed' | 'expired' | 'cancelled';

const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('tr-TR') : '-';
const booleanLabel = (value?: number | boolean | null) => (
  value === true || Number(value) === 1 ? 'Evet' : 'Hayır'
);

interface TrainingReportColumn {
  key: string;
  label: string;
  value: (row: AdminStatsRow) => string | number;
  render?: (row: AdminStatsRow) => ReactNode;
}

const TRAINING_REPORT_COLUMNS: TrainingReportColumn[] = [
  { key: 'name', label: 'Çalışan', value: (row) => row.name },
  { key: 'employee_id', label: 'Sicil No', value: (row) => row.employee_id },
  { key: 'department', label: 'Bölüm', value: (row) => row.department || '-' },
  { key: 'position', label: 'Pozisyon', value: (row) => row.position || '-' },
  { key: 'title', label: 'Eğitim', value: (row) => row.title },
  { key: 'category', label: 'Kategori', value: (row) => row.category || '-' },
  { key: 'training_profile', label: 'Profil', value: (row) => row.training_profile || '-' },
  { key: 'delivery_method', label: 'Yöntem', value: (row) => row.delivery_method || '-' },
  { key: 'version_no', label: 'Versiyon', value: (row) => row.version_no ?? '-' },
  { key: 'is_mandatory', label: 'Zorunlu', value: (row) => booleanLabel(row.is_mandatory) },
  { key: 'minimum_watch_percent', label: 'Minimum İzleme', value: (row) => row.minimum_watch_percent ?? '-' },
  { key: 'trainer_name', label: 'Eğitmen', value: (row) => row.trainer_name || '-' },
  { key: 'trainer_title', label: 'Eğitmen Ünvanı', value: (row) => row.trainer_title || '-' },
  { key: 'duration', label: 'Süre', value: (row) => row.duration || '-' },
  { key: 'validity_period', label: 'Geçerlilik', value: (row) => row.validity_period ?? '-' },
  {
    key: 'status',
    label: 'Durum',
    value: (row) => getTrainingOutcome(row).label,
    render: (row) => {
      const outcome = getTrainingOutcome(row);
      return <span className={`badge ${outcome.className}`}>{outcome.label}</span>;
    },
  },
  { key: 'quiz_score', label: 'Puan', value: (row) => row.quiz_score ?? '-' },
  { key: 'pass_score', label: 'Baraj', value: (row) => row.pass_score ?? '-' },
  { key: 'watched_seconds', label: 'İzlenen Saniye', value: (row) => row.watched_seconds ?? 0 },
  { key: 'quiz_attempts', label: 'Quiz Deneme', value: (row) => row.quiz_attempts ?? 0 },
  { key: 'requires_rewatch', label: 'Tekrar İzleme Gerekli', value: (row) => booleanLabel(row.requires_rewatch) },
  { key: 'assigned_at', label: 'Atama Tarihi', value: (row) => formatDate(row.assigned_at) },
  { key: 'completed_at', label: 'Bitirme Tarihi', value: (row) => formatDate(row.completed_at) },
  { key: 'reference_id', label: 'Sertifika Ref', value: (row) => row.reference_id || '-' },
  { key: 'confirmed_at', label: 'Onay Tarihi', value: (row) => formatDate(row.confirmed_at) },
];

const MOBILE_DETAIL_COLUMNS = TRAINING_REPORT_COLUMNS.filter(
  (column) => !['name', 'title', 'status'].includes(column.key),
);

interface TrainingReportRowActionsProps {
  row: AdminStatsRow;
  onDelete: (assignmentId: number) => void;
  onDownload: (path: string, filename: string) => void;
}

function TrainingReportRowActions({ row, onDelete, onDownload }: TrainingReportRowActionsProps) {
  const assignmentId = row.assignment_id;

  return (
    <div className="training-report-row-actions">
      <button type="button" className="btn-icon" title="Eğitim kanıt raporu PDF" aria-label={`${row.name} eğitim kanıt raporunu indir`} onClick={() => onDownload(`/api/admin/assignments/${assignmentId}/evidence.pdf`, `egitim-kanit-raporu-${assignmentId}.pdf`)}><FileText size={17} /></button>
      <button type="button" className="btn-icon" title="Sertifika PDF" aria-label={`${row.name} sertifikasını indir`} onClick={() => onDownload(`/api/admin/assignments/${assignmentId}/certificate.pdf`, `sertifika-${assignmentId}.pdf`)}><Award size={17} /></button>
      {row.status !== 'cancelled' && (
        <button type="button" className="btn-icon danger" title="Atamayı kaldır" aria-label={`${row.name} eğitim atamasını kaldır`} onClick={() => onDelete(assignmentId)}><Trash2 size={17} /></button>
      )}
    </div>
  );
}

export function TrainingReport({ trainingCount, onChanged }: TrainingReportProps) {
  const feedback = useAppFeedback();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [status, setStatus] = useState<TrainingReportStatus>('');
  const [department, setDepartment] = useState('');
  const [page, setPage] = useState(1);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const buildParams = () => {
    const params = new URLSearchParams({
      sort: 'assigned_at',
      order: 'desc',
    });
    if (deferredSearch) params.set('search', deferredSearch);
    if (status) params.set('status', status);
    if (department) params.set('department', department);
    return params;
  };
  const statsQuery = useQuery({
    queryKey: [...queryKeys.adminStats, { page, search: deferredSearch, status, department }],
    queryFn: () => {
      const params = buildParams();
      params.set('page', String(page));
      params.set('pageSize', '25');
      return api.get<TrainingStatsResponse>(`/api/admin/stats?${params.toString()}`);
    },
    placeholderData: (previous) => previous,
  });
  const overviewQuery = useQuery({
    queryKey: [...queryKeys.adminStats, 'overview'],
    queryFn: () => api.get<TrainingStatsResponse>(
      '/api/admin/stats?page=1&pageSize=1&sort=assigned_at&order=desc',
    ),
  });
  const optionsQuery = useQuery({
    queryKey: [...queryKeys.adminStats, 'options'],
    queryFn: () => api.get<{ departments: string[] }>('/api/admin/stats/options'),
    staleTime: 5 * 60_000,
  });
  const attentionQuery = useQuery({
    queryKey: [...queryKeys.adminStats, 'attention', 'overdue'],
    queryFn: () => api.get<TrainingStatsResponse>(
      '/api/admin/stats?page=1&pageSize=5&status=expired&sort=due_date&order=asc',
    ),
  });
  const filteredRows = statsQuery.data?.items || EMPTY_ROWS;
  const departments = optionsQuery.data?.departments || [];
  const summary = overviewQuery.data?.summary || { total: 0, completed: 0, cancelled: 0, overdue: 0, passed: 0 };
  const activeTotal = Math.max(summary.total - summary.cancelled, 0);
  const completionRate = activeTotal
    ? Math.round((summary.completed / activeTotal) * 100)
    : 0;
  const pendingCount = Math.max(activeTotal - summary.completed, 0);
  const attentionRows = attentionQuery.data?.items || EMPTY_ROWS;
  const attentionCount = attentionQuery.data?.summary.overdue || 0;

  const showAssignmentDetails = (nextStatus: TrainingReportStatus) => {
    setStatus(nextStatus);
    setPage(1);
    setFiltersVisible(true);
    window.requestAnimationFrame(() => {
      document.getElementById('training-assignment-records')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const showTrainingCatalog = () => {
    document.getElementById('training-catalog')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const download = async (path: string, filename: string) => {
    try {
      const response = await fetch(`${API_BASE}${path}`);
      if (!response.ok) throw new Error('Dosya indirilemedi');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      feedback.notifyError(error instanceof Error ? error.message : 'Dosya indirilemedi');
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (assignmentId: number) =>
      api.delete(`/api/admin/assignments/${assignmentId}`),
    onSuccess: onChanged,
    onError: (error: Error) => feedback.notifyError(error.message),
  });
  const deleteAssignment = async (assignmentId: number) => {
    if (!await feedback.confirm({
      title: 'Eğitim atamasını kaldır',
      message: 'Bu eğitim ataması kullanıcıdan kaldırılacak.',
      confirmLabel: 'Atamayı Kaldır',
      danger: true,
    })) return;
    deleteMutation.mutate(assignmentId);
  };

  const exportRows = async () => {
    const params = buildParams();
    const rows = await api.listAll<AdminStatsRow>(`/api/admin/stats?${params.toString()}`);
    if (!rows.length) return feedback.notifyInfo('Dışa aktarılacak veri bulunamadı.');
    const headers = TRAINING_REPORT_COLUMNS.map((column) => column.label);
    const values = rows.map((row) => (
      TRAINING_REPORT_COLUMNS.map((column) => column.value(row)).join(';')
    ));
    const url = URL.createObjectURL(new Blob([`\uFEFF${[headers.join(';'), ...values].join('\n')}`], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Eğitim_Raporu_${new Date().toLocaleDateString('tr-TR')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="training-dashboard-stack">
      <section className="training-dashboard-overview" aria-labelledby="training-dashboard-title">
        <div className="training-dashboard-intro">
          <div>
            <h3 id="training-dashboard-title">Eğitim Durumu</h3>
            <p>Mevcut eğitim ve atama kayıtlarından güncel görünüm</p>
          </div>
        </div>
        <div className="training-dashboard-summary-grid">
          {[
            { label: 'Tamamlama Oranı', value: `%${completionRate}`, detail: `${summary.completed}/${activeTotal} tamamlandı`, tone: 'violet', icon: <Gauge size={20} />, onDetails: () => showAssignmentDetails('completed') },
            { label: 'Aktif Eğitim', value: trainingCount, detail: 'atanabilir içerik', tone: 'lavender', icon: <BookOpen size={20} />, onDetails: showTrainingCatalog },
            { label: 'Başarılı', value: summary.passed, detail: 'başarılı tamamlama', tone: 'teal', icon: <CheckCircle2 size={20} />, onDetails: () => showAssignmentDetails('passed') },
            { label: 'Tamamlanmayan', value: pendingCount, detail: 'açık atama', tone: 'lavender', icon: <ClipboardCheck size={20} />, onDetails: () => showAssignmentDetails('pending') },
            { label: 'Süresi Geçen', value: summary.overdue, detail: 'dikkat gerektiriyor', tone: 'coral', icon: <AlertTriangle size={20} />, onDetails: () => showAssignmentDetails('expired') },
          ].map((item) => (
            <article key={item.label} className={`training-dashboard-metric ${item.tone}`}>
              <div className="training-dashboard-metric-heading">
                <span>{item.label}</span>
                <span className="training-dashboard-metric-icon" aria-hidden="true">{item.icon}</span>
              </div>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
              <button type="button" className="training-dashboard-detail-button" onClick={item.onDetails}>
                Detayları Gör <ArrowRight size={14} />
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="training-attention-panel" aria-labelledby="training-attention-title">
        <div className="training-attention-header">
          <div>
            <h3 id="training-attention-title"><AlertTriangle size={19} /> Dikkat Gerektiren Atamalar</h3>
            <p>Süresi geçmiş ve henüz tamamlanmamış atamalar</p>
          </div>
          {attentionCount > 0 && (
            <button
              type="button"
              className="btn-secondary training-attention-show-all"
              onClick={() => {
                showAssignmentDetails('expired');
              }}
            >
              Tümünü Göster
            </button>
          )}
        </div>
        {attentionQuery.isLoading ? (
          <LoadingIndicator compact label="Dikkat gerektiren kayıtlar kontrol ediliyor" />
        ) : attentionQuery.isError ? (
          <div className="training-attention-state error">Dikkat gerektiren kayıtlar yüklenemedi.</div>
        ) : attentionRows.length ? (
          <div className="training-attention-list">
            {attentionRows.map((row) => (
              <article key={row.assignment_id} className="training-attention-item">
                <span className="training-attention-indicator" aria-hidden="true"><AlertTriangle size={17} /></span>
                <div>
                  <strong>{row.title}</strong>
                  <small>{row.name} · #{row.employee_id}</small>
                </div>
                <div className="training-attention-date">
                  <span>Süresi geçti</span>
                  <small>{formatDate(row.due_date)}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="training-attention-state success">
            <CheckCircle2 size={18} /> Süresi geçmiş açık atama bulunmuyor.
          </div>
        )}
      </section>
      <section id="training-assignment-records" className="premium-card training-report-card">
        <div className="training-report-header">
          <div><h3 id="training-assignment-records-title" className="training-report-title">Atama Kayıtları</h3><p className="training-report-description">Atama, izleme, sınav ve sertifika bilgilerinin tamamı</p></div>
          <div className="training-report-actions">
            <button type="button" className={`btn-secondary ${filtersVisible ? 'active' : ''}`} onClick={() => setFiltersVisible((value) => !value)}><Filter size={17} /> Filtreler</button>
            <ExportExcelButton onClick={() => void exportRows()} />
          </div>
        </div>
        {filtersVisible && (
          <div className="training-report-filter-grid training-report-filter-panel">
            <input className="form-control" aria-label="Eğitim raporunda ara" placeholder="Çalışan, sicil veya eğitim ara..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <select className="form-control" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(1); }}><option value="">Tüm bölümler</option>{departments.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select className="form-control" value={status} onChange={(event) => { setStatus(event.target.value as TrainingReportStatus); setPage(1); }}>
              <option value="">Tüm durumlar</option>
              <option value="assigned">Devam eden</option>
              <option value="pending">Tamamlanmayan</option>
              <option value="completed">Tamamlanan</option>
              <option value="passed">Başarılı</option>
              <option value="expired">Süresi geçen</option>
              <option value="cancelled">Kaldırılan</option>
            </select>
          </div>
        )}
        {statsQuery.isLoading ? <LoadingIndicator compact label="Eğitim raporu yükleniyor" /> : (
          <>
            <div className="table-container desktop-only training-report-table-wrap" role="region" aria-labelledby="training-assignment-records-title" tabIndex={0}>
              <table className="training-report-table">
                <thead>
                  <tr>
                    {TRAINING_REPORT_COLUMNS.map((column) => <th key={column.key} scope="col" data-column={column.key}>{column.label}</th>)}
                    <th scope="col">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.assignment_id}>
                      {TRAINING_REPORT_COLUMNS.map((column) => (
                        <td key={column.key}>{column.render ? column.render(row) : column.value(row)}</td>
                      ))}
                      <td><TrainingReportRowActions row={row} onDelete={deleteAssignment} onDownload={download} /></td>
                    </tr>
                  ))}
                  {!filteredRows.length && <tr><td colSpan={TRAINING_REPORT_COLUMNS.length + 1} className="training-report-empty">Bu filtrelerle eşleşen atama bulunamadı.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mobile-only training-report-mobile-list">
              {filteredRows.map((row) => {
                const outcome = getTrainingOutcome(row);
                return (
                  <div key={row.assignment_id} className="mobile-data-card training-report-mobile-card">
                    <div>
                      <div><strong>{row.name}</strong><small>#{row.employee_id} · {row.department || '-'}</small></div>
                      <span className={`badge ${outcome.className}`}>{outcome.label}</span>
                    </div>
                    <div>{row.title}</div>
                    <details className="training-report-mobile-details">
                      <summary>Tüm atama bilgileri</summary>
                      <div className="training-report-mobile-detail-list">
                        {MOBILE_DETAIL_COLUMNS.map((column) => (
                          <div className="mobile-data-row" key={column.key}>
                            <span className="mobile-data-label">{column.label}</span>
                            <b className="mobile-data-value">{column.value(row)}</b>
                          </div>
                        ))}
                      </div>
                    </details>
                    <TrainingReportRowActions row={row} onDelete={deleteAssignment} onDownload={download} />
                  </div>
                );
              })}
              {!filteredRows.length && <div className="training-report-empty">Bu filtrelerle eşleşen atama bulunamadı.</div>}
            </div>
          </>
        )}
        <PaginationControls pagination={statsQuery.data?.pagination} onPageChange={setPage} />
      </section>
    </div>
  );
}
