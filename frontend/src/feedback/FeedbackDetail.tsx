import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../AuthContext';
import { ModulePageHeader } from '../components/ModulePageHeader';
import { FeedbackSummary } from './FeedbackSummary';
import { FeedbackConversation } from './FeedbackConversation';
import { dateText, feedbackKeys, feedbackStatus, statusText, typeText, type FeedbackItem } from './feedbackModel';

export function FeedbackDetail({ id, participating, onBack }: { id: number; participating: boolean; onBack: () => void }) {
    const { user } = useAuth();
    const detailQuery = useQuery({
        queryKey: [...feedbackKeys.detail(id), user?.id],
        queryFn: ({ signal }) => api.get<FeedbackItem>(`/api/feedback/${id}/detail`, { signal }),
    });
    const item = detailQuery.data;
    return <div className="fb-workspace">
        <button type="button" className="fb-back" onClick={onBack}><ArrowLeft size={18} />{participating ? 'Dahil olduklarıma dön' : 'Gönderdiklerime dön'}</button>
        {detailQuery.isPending && <p role="status">Talep yükleniyor…</p>}
        {detailQuery.isError && <div role="alert" className="fb-card"><p>{detailQuery.error.message}</p><button className="fb-button" onClick={() => void detailQuery.refetch()}>Tekrar dene</button></div>}
        {item && <>
            <ModulePageHeader title={item.title} description={`#${item.id} · ${typeText(item.type)} · ${dateText(item.created_at)}`} icon={<MessageSquare />} actions={<><span>{statusText(feedbackStatus(item))}</span>{participating && <span>Rolüm: {item.viewer_role === 'assignee' ? 'Sorumlu' : 'Katılımcı'}</span>}</>} />
            <div className="fb-meta-strip"><span>Sorumlu: <strong>{item.assigned_to_name || 'Henüz atanmadı'}</strong></span><span>Hedef tarih: <strong>{dateText(item.due_date)}</strong></span><span>Son güncelleme: {dateText(item.updated_at || item.created_at, true)}</span></div>
            <div className="fb-detail-grid"><FeedbackSummary item={item} own={item.viewer_role === 'owner'} /><FeedbackConversation key={item.id} item={item} /></div>
        </>}
    </div>;
}
