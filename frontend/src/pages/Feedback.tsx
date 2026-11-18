import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Plus, Users, ArrowLeft } from 'lucide-react';
import { ModulePageHeader } from '../components/ModulePageHeader';
import { useAuth } from '../AuthContext';
import { api } from '../services/api';
import { FeedbackTable } from '../feedback/FeedbackTable';
import { FeedbackDetail } from '../feedback/FeedbackDetail';
import { feedbackKeys, type FeedbackItem } from '../feedback/feedbackModel';
import { FeedbackFormModal } from './feedback/FeedbackFormModal';
import { useFeedbackForms } from './feedback/useFeedbackForms';

export const Feedback = () => {
    const { user } = useAuth();
    const [participating, setParticipating] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    useEffect(() => { window.scrollTo({ top: 0 }); }, [selectedId, participating]);
    const forms = useFeedbackForms(() => { setParticipating(false); setSelectedId(null); });
    const mineQuery = useQuery({ queryKey: [...feedbackKeys.mine, user?.id], queryFn: ({ signal }) => api.get<FeedbackItem[]>('/api/feedback/mine', { signal }) });
    const participatingQuery = useQuery({ queryKey: [...feedbackKeys.participating, user?.id], queryFn: ({ signal }) => api.get<FeedbackItem[]>('/api/feedback/participating', { signal }) });
    const query = participating ? participatingQuery : mineQuery;
    if (selectedId !== null) return <div className="fb-page"><FeedbackDetail key={selectedId} id={selectedId} participating={participating} onBack={() => setSelectedId(null)} /></div>;
    return <div className="employee-feedback-page fb-page">
        <ModulePageHeader title={participating ? 'Dahil Olduklarım' : 'Öneri ve Şikâyet'}
            description={participating ? 'Sorumlu veya katılımcı olduğunuz talepleri takip edin.' : 'Gönderdiğiniz talepleri ve süreçlerini takip edin.'}
            icon={participating ? <Users /> : <MessageSquare />} actions={<>
                {participating ? <button type="button" className="fb-button fb-header-neutral" onClick={() => setParticipating(false)}><ArrowLeft size={18} />Gönderdiklerim</button> : <>
                    <button type="button" className="fb-button fb-create-suggestion" onClick={() => forms.openForm('oneri')}><Plus size={19} />Öneri Oluştur</button>
                    <button type="button" className="fb-button fb-create-complaint" onClick={() => forms.openForm('sikayet')}><MessageSquare size={19} />Şikâyet Oluştur</button>
                </>}
                <button type="button" className="fb-button fb-header-neutral fb-included-button" aria-pressed={participating} onClick={() => setParticipating(true)}><Users size={19} />Dahil Olduklarım{participatingQuery.isSuccess && <span className="fb-count-badge" aria-label={`${participatingQuery.data.length} dahil olduğunuz talep`}>{participatingQuery.data.length}</span>}</button>
            </>} />
        {forms.status && !forms.open && <p className="fb-notice" role="status">{forms.status}</p>}
        {query.isPending && <p className="fb-card" role="status">Talepler yükleniyor…</p>}
        {query.isError && <div className="fb-card" role="alert"><p>Talepler yüklenemedi.</p><button type="button" className="fb-button" onClick={() => void query.refetch()}>Tekrar dene</button></div>}
        {query.isSuccess && <FeedbackTable key={participating ? 'participating' : 'mine'} title={participating ? 'Dahil olduğum talepler' : 'Gönderdiklerim'} items={query.data} mode={participating ? 'participating' : 'mine'} userId={user?.id} onSelect={item => setSelectedId(item.id)} />}
        <FeedbackFormModal open={forms.open} formTab={forms.formTab} status={forms.status} busy={forms.busy}
            aiLoading={forms.aiLoading} complaintForm={forms.complaintForm} suggestionForm={forms.suggestionForm}
            setComplaintForm={forms.setComplaintForm} setSuggestionForm={forms.setSuggestionForm} onClose={forms.closeForm}
            onComplaintSubmit={forms.onComplaintSubmit} onSuggestionSubmit={forms.onSuggestionSubmit} improveText={forms.improveText} />
    </div>;
};
