import { ModulePageHeader } from './components/ModulePageHeader';
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bot, HeartPulse, X } from 'lucide-react';
import { API_BASE } from './config';
import { ExportExcelButton } from './components/ExportExcelButton';
import { PaginationControls } from './components/PaginationControls';
import { queryKeys } from './queryClient';
import { api } from './services/api';
import type { PaginationMeta } from './types';
import { ModalShell } from './components/ModalShell';

type MoodRow = {
  mood_date: string;
  mood_id: string;
  mood_label: string;
  mood_score: number;
  response_count: number;
  reason_key?: string | null;
  reason_label?: string | null;
  department?: string | null;
};

type MoodSummary = {
  total: number;
  average_score: number;
  callbacks: number;
  anonymity_threshold: number;
  suppressed: boolean;
  mood_counts: Record<string, number>;
  reason_counts: Record<string, number>;
  departments: Record<string, {
    total: number;
    average_score: number;
    tired_or_sad: number;
  }>;
};

type MoodResponse = {
  items: MoodRow[];
  pagination: PaginationMeta;
  summary: MoodSummary;
  departments: string[];
};

type CallbackRequest = {
  id: number;
  requested_date: string;
  status: string;
  employee_id: string;
  name: string;
  department?: string | null;
  position?: string | null;
};

type CallbackResponse = {
  items: CallbackRequest[];
  pagination: PaginationMeta;
};

const defaultFrom = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);
const errorMessage = (error: unknown, fallback: string) => (
  error instanceof Error ? error.message : fallback
);

export const AdminMoodAnalytics = () => {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(today());
  const [department, setDepartment] = useState('');
  const [page, setPage] = useState(1);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);

  const reportQuery = useQuery({
    queryKey: [...queryKeys.adminMoodAnalytics, from, to, department, page],
    queryFn: () => {
      const query = new URLSearchParams({
        from,
        to,
        page: String(page),
        pageSize: '25',
        sort: 'mood_date',
        order: 'desc',
      });
      if (department) query.set('department', department);
      return api.get<MoodResponse>(`/api/mood-check/admin?${query.toString()}`);
    },
  });
  const callbackQuery = useQuery({
    queryKey: [...queryKeys.adminMoodAnalytics, 'callbacks', from, to, department],
    queryFn: () => {
      const query = new URLSearchParams({
        from,
        to,
        page: '1',
        pageSize: '25',
        sort: 'requested_date',
        order: 'desc',
      });
      if (department) query.set('department', department);
      return api.get<CallbackResponse>(`/api/mood-check/admin/callbacks?${query.toString()}`);
    },
  });

  const analysisMutation = useMutation({
    mutationFn: () => api.post<{ analysis: string }>('/api/mood-check/admin/analyze', {
      from,
      to,
      department,
    }),
  });

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };
  const downloadCsv = () => {
    const query = new URLSearchParams({ from, to });
    if (department) query.set('department', department);
    window.open(`${API_BASE}/api/mood-check/admin/export?${query.toString()}`, '_blank');
  };
  const analyze = () => {
    analysisMutation.reset();
    setAnalysisModalOpen(true);
    analysisMutation.mutate();
  };

  const data = reportQuery.data;
  const summary = data?.summary;

  return (
    <>
      <ModulePageHeader title="Duygu Durumu Analizi" description="Kimliksiz departman eğilimlerini ve ayrı geri aranma taleplerini izleyin." icon={<HeartPulse />} tone="violet" actions={<>
          <ExportExcelButton className="module-desktop-only" onClick={downloadCsv} disabled={!summary?.total} />
          <button
            type="button"
            className="btn-primary"
            onClick={analyze}
            disabled={analysisMutation.isPending || !summary?.total}
          >
            <Bot size={17} />
            AI Analiz Et
          </button>
      </>} />
      <div className="premium-card mood-admin-card">
      <div className="mood-filter-grid">
        <label>
          Başlangıç
          <input
            className="form-control"
            type="date"
            value={from}
            max={to}
            onChange={event => updateFilter(setFrom, event.target.value)}
          />
        </label>
        <label>
          Bitiş
          <input
            className="form-control"
            type="date"
            value={to}
            min={from}
            onChange={event => updateFilter(setTo, event.target.value)}
          />
        </label>
        <label>
          Departman
          <select
            className="form-control"
            value={department}
            onChange={event => updateFilter(setDepartment, event.target.value)}
          >
            <option value="">Tüm departmanlar</option>
            {(data?.departments || []).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      {reportQuery.isError && (
        <div className="feedback-status-message">
          {errorMessage(reportQuery.error, 'Duygu durumu raporu alınamadı.')}
        </div>
      )}

      {summary && (
        <div className="mood-summary-grid">
          <article>
            <span>Kayıt</span>
            <strong>{summary.total}</strong>
          </article>
          <article>
            <span>Ortalama Skor</span>
            <strong>{summary.average_score.toFixed(2)}</strong>
          </article>
          <article>
            <span>Arama Talebi</span>
            <strong>{summary.callbacks}</strong>
          </article>
        </div>
      )}

      <div className="module-mobile-only mood-report-export">
        <ExportExcelButton onClick={downloadCsv} disabled={!summary?.total} />
      </div>
      <div className="mood-table-wrap">
        <table className="mood-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Departman</th>
              <th>Duygu</th>
              <th>Skor</th>
              <th>Sebep</th>
              <th>Yanıt Sayısı</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map(row => (
              <tr key={[
                row.mood_date,
                row.department,
                row.mood_id,
                row.reason_key || 'none',
              ].join(':')}>
                <td data-label="Tarih">{row.mood_date}</td>
                <td data-label="Departman">{row.department || '-'}</td>
                <td data-label="Duygu">{row.mood_label}</td>
                <td data-label="Skor">{row.mood_score}</td>
                <td data-label="Sebep">{row.reason_label || '-'}</td>
                <td data-label="Yanıt">{row.response_count}</td>
              </tr>
            ))}
            {reportQuery.isLoading && (
              <tr className="mood-table-message">
                <td colSpan={6}>Duygu verileri yükleniyor...</td>
              </tr>
            )}
            {!reportQuery.isLoading && !reportQuery.isError && !data?.items.length && (
              <tr className="mood-table-message">
                <td colSpan={6}>Seçili aralıkta gösterilebilecek duygu verisi yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {summary?.suppressed && (
        <div className="feedback-status-message">
          Seçili aralıkta en az {summary.anonymity_threshold} yanıt içeren
          departman-gün grubu bulunmadığı için duygu detayları gösterilmiyor.
        </div>
      )}
      {data && (
        <PaginationControls pagination={data.pagination} onPageChange={setPage} />
      )}

      <section className="mood-callback-section">
        <div className="mood-admin-head">
          <div>
            <h3>Geri Aranma Talepleri</h3>
            <p>Bu liste duygu ve sebep verilerinden bağımsızdır.</p>
          </div>
        </div>
        <div className="mood-table-wrap">
          <table className="mood-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Çalışan</th>
                <th>Departman</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {(callbackQuery.data?.items || []).map(request => (
                <tr key={request.id}>
                  <td data-label="Tarih">{request.requested_date}</td>
                  <td data-label="Çalışan">{request.name}</td>
                  <td data-label="Departman">{request.department || '-'}</td>
                  <td data-label="Durum">{request.status === 'pending' ? 'Bekliyor' : request.status}</td>
                </tr>
              ))}
              {callbackQuery.isLoading && (
                <tr className="mood-table-message">
                  <td colSpan={4}>Geri aranma talepleri yükleniyor...</td>
                </tr>
              )}
              {!callbackQuery.isLoading && !callbackQuery.data?.items.length && (
                <tr className="mood-table-message">
                  <td colSpan={4}>Seçili aralıkta geri aranma talebi yok.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {analysisModalOpen && (
        <ModalShell onClose={() => setAnalysisModalOpen(false)} labelledBy="mood-ai-analysis-title" className="admin-action-modal mood-ai-analysis-modal">
            <div className="admin-modal-header">
              <div>
                <h3 id="mood-ai-analysis-title"><Bot size={20} /> AI Duygu Analizi</h3>
                <p>Seçili tarih aralığı ve departman verileri değerlendiriliyor.</p>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setAnalysisModalOpen(false)}
                title="Kapat"
              >
                <X size={18} />
              </button>
            </div>
            {analysisMutation.isPending ? (
              <div className="mood-ai-processing">
                <div className="mood-ai-orb" aria-hidden="true">
                  <span /><span /><span />
                </div>
                <div>
                  <h4>Veriler işleniyor</h4>
                  <p>Departman sinyalleri ve duygu eğilimleri analiz ediliyor.</p>
                </div>
              </div>
            ) : analysisMutation.isError ? (
              <div className="feedback-status-message">
                {errorMessage(analysisMutation.error, 'AI analizi alınamadı.')}
              </div>
            ) : (
              <div className="mood-ai-result">
                {analysisMutation.data?.analysis}
              </div>
            )}
        </ModalShell>
      )}
      </div>
    </>
  );
};
