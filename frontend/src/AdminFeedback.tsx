import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowLeftRight, CheckCheck, Download, FileText, RotateCcw, Users } from 'lucide-react';
import { useAuth } from './AuthContext';
import { api } from './services/api';
import { ModulePageHeader } from './components/ModulePageHeader';
import { ExportExcelButton } from './components/ExportExcelButton';
import { PaginationControls } from './components/PaginationControls';
import { FeedbackTable } from './feedback/FeedbackTable';
import { FeedbackSummary } from './feedback/FeedbackSummary';
import { FeedbackConversation } from './feedback/FeedbackConversation';
import { FeedbackAssignment } from './admin-feedback/FeedbackAssignment';
import { FeedbackDecision } from './admin-feedback/FeedbackDecision';
import { closed, dateText, feedbackKeys, feedbackStages, feedbackStatus, statusText, typeText, type FeedbackItem, type FeedbackThread } from './feedback/feedbackModel';
import { downloadFeedbackFormPdf, downloadFeedbackResultPdf, downloadFeedbacksExcel } from './admin-feedback/feedbackSupport';

export const AdminFeedback = () => {
    const { user } = useAuth();
    const client = useQueryClient();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({ search: '', type: '', status: '' });
    const search = useDeferredValue(filters.search);
    const [filterReset, setFilterReset] = useState(0);
    const [selected, setSelected] = useState<FeedbackItem | null>(null);
    const [view, setView] = useState<'routing' | 'detail'>('routing');
    const [decisionOpen, setDecisionOpen] = useState(false);
    const [message, setMessage] = useState('');
    useEffect(() => { window.scrollTo({ top: 0 }); }, [selected?.id, view]);
    const params = new URLSearchParams({ page: String(page), pageSize: '25', sort: 'created_at', order: 'desc' });
    if (search.trim()) params.set('search', search.trim());
    if (filters.type) params.set('type', filters.type);
    if (filters.status) params.set('status', filters.status);
    const list = useQuery({ queryKey: ['admin', 'feedback', user?.id, params.toString()], queryFn: ({ signal }) => api.list<FeedbackItem>(`/api/admin/feedback?${params}`, { signal }), placeholderData: previous => previous });
    const detail = useQuery({ queryKey: ['admin', 'feedback', 'detail', selected?.id, user?.id], queryFn: ({ signal }) => api.get<FeedbackItem>(`/api/admin/feedback/${selected!.id}/detail`, { signal }), enabled: selected !== null });
    const item = detail.data || selected;
    const thread = useQuery({ queryKey: [...feedbackKeys.thread(item?.id || 0, true), user?.id], queryFn: () => api.get<FeedbackThread>(`/api/admin/feedback/${item!.id}/thread`), enabled: item !== null });
    const reopenMutation = useMutation({
        mutationFn: (id: number) => api.put(`/api/admin/feedback/${id}/status`, { status: 'in_review' }),
        onSuccess: async () => { setMessage('Kayıt yeniden incelemeye açıldı.'); await Promise.all([client.invalidateQueries({ queryKey: ['admin', 'feedback'] }), client.invalidateQueries({ queryKey: ['feedback'] })]); },
        onError: (error: Error) => setMessage(error.message),
    });
    const exportMutation = useMutation({ mutationFn: async () => downloadFeedbacksExcel(await api.listAll<FeedbackItem>('/api/admin/feedback?sort=created_at&order=desc')), onError: (error: Error) => setMessage(error.message) });
    const openItem = (record: FeedbackItem) => { setSelected(record); setView('routing'); setMessage(''); };
    const back = () => { setSelected(null); setDecisionOpen(false); setMessage(''); };
    const chooseStage = (status: string) => { setFilterReset(value => value + 1); setFilters({ search: '', type: '', status }); setPage(1); back(); };
    return <div className="fb-page fb-admin">
        {selected && view === 'detail' && item ? <>
            <button className="fb-back" onClick={back}><ArrowLeft size={18} />Kayıtlara dön</button>
            <ModulePageHeader title={item.title} description={`#${item.id} · ${typeText(item.type)} · ${item.user_name || 'Anonim'}`} icon={<FileText />} actions={<span>{statusText(feedbackStatus(item))}</span>} />
            {message && <p role="status" className="fb-notice">{message}</p>}
            {detail.isError && <p className="fb-error" role="alert">Güncel talep bilgisi alınamadı. <button onClick={() => void detail.refetch()}>Tekrar dene</button></p>}
            <div className="fb-meta-strip"><span>Sorumlu: <strong>{item.assigned_to_name || 'Atanmadı'}</strong></span><span>Hedef: {dateText(item.due_date)}</span>
                {closed(item.status) && <button className="fb-button" disabled={reopenMutation.isPending || !detail.isSuccess} onClick={() => reopenMutation.mutate(item.id)}><RotateCcw size={17} />Kaydı yeniden aç</button>}
            </div>
            <div className="fb-actions fb-admin-detail-actions">
                <button className="fb-button" disabled={closed(item.status)} onClick={() => setView('routing')}><Users size={18} />Yönlendirme ve katılım</button>
                <button className="fb-button" disabled={!thread.isSuccess} onClick={() => { if (thread.data) void downloadFeedbackFormPdf(item, thread.data).catch((e: Error) => setMessage(e.message)); }}><FileText size={17} />Form PDF</button>
                <button className="fb-button" disabled={!thread.isSuccess} onClick={() => { if (thread.data) void downloadFeedbackResultPdf(item, thread.data).catch((e: Error) => setMessage(e.message)); }}><Download size={17} />Sonuç PDF</button>
                {!closed(item.status) && <button className="fb-button fb-primary" disabled={!detail.isSuccess} onClick={() => { setMessage(''); setDecisionOpen(true); }}><CheckCheck size={18} />Sonuçlandır</button>}
            </div>
            <div className="fb-detail-grid"><FeedbackSummary item={item} /><div>{item.decision_note && <details className="fb-card fb-history"><summary>Yalnız yönetici · İç karar notu</summary><p className="fb-prose">{item.decision_note}</p></details>}<FeedbackConversation key={item.id} item={item} admin /></div></div>
            {decisionOpen && <FeedbackDecision key={item.id} item={item} onClose={() => setDecisionOpen(false)} />}
        </> : <>
            <ModulePageHeader title="Geri Bildirimler" description="Talepleri yönlendirin, görüşleri takip edin ve sonuçlandırın." icon={<ArrowLeftRight />} />
            {message && <p role="status" className="fb-notice">{message}</p>}
            <nav className="fb-stage-filters" aria-label="Talep aşaması">{[['', 'Tümü'], ...feedbackStages].map(([key, text]) => <button key={key} type="button" className="fb-button" aria-pressed={filters.status === key} onClick={() => chooseStage(key)}>{text}</button>)}</nav>
            <div className={`fb-admin-grid ${item ? 'fb-admin-routing-open' : ''}`}>
                <div className="fb-admin-list">
                    {list.isPending && <p role="status" className="fb-card">Talepler yükleniyor…</p>}
                    {list.isError && <div role="alert" className="fb-card"><p>Talepler yüklenemedi.</p><button className="fb-button" onClick={() => void list.refetch()}>Tekrar dene</button></div>}
                    {list.data && <FeedbackTable key={filterReset} title="Talepler" items={list.data.items} mode="admin" activeStatus={filters.status} busy={list.isPlaceholderData} selectedId={item?.id} onSelect={openItem} actions={<ExportExcelButton label={exportMutation.isPending ? 'Hazırlanıyor…' : "Excel'e Aktar"} disabled={exportMutation.isPending || !list.data?.pagination.total} onClick={() => exportMutation.mutate()} />} onFilterChange={values => { setFilters(values); setPage(1); setSelected(null); }} />}
                    <PaginationControls pagination={list.data?.pagination} onPageChange={number => { setPage(number); back(); }} />
                    {list.data && <p className="fb-muted">Toplam {list.data.pagination.total} kayıt</p>}
                </div>
                {item && <div><FeedbackAssignment key={item.id} item={item} onClose={back} onSaved={() => { setView('detail'); setMessage('Yönlendirme kaydedildi.'); }} /><button className="fb-button fb-primary fb-full-width" onClick={() => setView('detail')}>Talep detayını aç →</button></div>}
            </div>
        </>}
    </div>;
};
