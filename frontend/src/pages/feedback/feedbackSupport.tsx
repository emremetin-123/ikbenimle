import { API_BASE } from '../../config';
/* eslint-disable react-refresh/only-export-components */
type MainTab = 'form' | 'mine' | 'participating';
type FormTab = 'oneri' | 'sikayet';

type FeedbackItem = {
    id: number;
    user_id?: number | null;
    type: string;
    title: string;
    content: string;
    details?: string | null;
    file_path?: string | null;
    status?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    assigned_department?: string | null;
    assigned_to_user_id?: number | null;
    assigned_to_name?: string | null;
    assigned_to_department?: string | null;
    due_date?: string | null;
    decision?: string | null;
    public_response?: string | null;
    user_name?: string | null;
    department?: string | null;
    position?: string | null;
};

type FeedbackParticipant = {
    id: number;
    name?: string | null;
    department?: string | null;
    position?: string | null;
    created_at?: string | null;
};

type FeedbackComment = {
    id: number;
    user_name?: string | null;
    department?: string | null;
    position?: string | null;
    comment: string;
    is_public?: number | boolean;
    created_at?: string | null;
};

type FeedbackHistory = {
    id: number;
    user_name?: string | null;
    old_status?: string | null;
    new_status: string;
    note?: string | null;
    created_at?: string | null;
};

type FeedbackThread = {
    participants: FeedbackParticipant[];
    comments: FeedbackComment[];
    history: FeedbackHistory[];
};

const AiEditIcon = () => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2.75l1.35 4.1a2.8 2.8 0 0 0 1.78 1.78l4.12 1.37-4.12 1.37a2.8 2.8 0 0 0-1.78 1.78L12 17.25l-1.35-4.1a2.8 2.8 0 0 0-1.78-1.78L4.75 10l4.12-1.37a2.8 2.8 0 0 0 1.78-1.78L12 2.75z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M19 15.5l.55 1.55c.12.36.4.64.76.76L22 18.35l-1.69.54a1.2 1.2 0 0 0-.76.76L19 21.25l-.55-1.6a1.2 1.2 0 0 0-.76-.76L16 18.35l1.69-.54c.36-.12.64-.4.76-.76L19 15.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
);

const AiEditButton = ({
    field,
    activeField,
    onClick,
}: {
    field: string;
    activeField: string | null;
    onClick: () => void;
}) => (
    <button
        type="button"
        className="ai-edit-button"
        title="Yapay zeka ile düzenle"
        aria-label="Yapay zeka ile düzenle"
        onClick={onClick}
        disabled={activeField !== null}
    >
        {activeField === field ? <span className="ai-edit-spinner" /> : <AiEditIcon />}
    </button>
);

type SuggestionDetails = {
    department?: string;
    currentSituation?: string;
    proposedSituation?: string;
    category?: string;
    investment?: string;
    estimatedCost?: string;
};

const DEPARTMENTS = ['İnsan Kaynakları', 'Kalite', 'Muhasebe', 'Metod', 'Üretim', 'Satış/Pazarlama', 'MPL', 'Satın Alma', 'Bilgi İşlem', 'Mali İşler'];
const CATEGORIES = ['İş Sağlığı ve Güvenliği', 'Enerji Tasarrufu', 'Kalite', 'Maliyet Tasarrufu', 'İş Kolaylığı / Ergonomi', 'Alan Tasarrufu', 'Verimlilik', 'Malzeme Tasarrufu', 'Doküman', 'Diğer (Standartlaştırma)'];

const statusLabels: Record<string, string> = {
    pending: 'Beklemede',
    assigned: 'Atandı',
    in_review: 'İncelemede',
    approved: 'Uygun',
    rejected: 'Uygun Değil',
    needs_revision: 'Eksik Var',
    completed: 'Tamamlandı',
};

const feedbackTypeLabel = (value?: string | null) => {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('sikayet') || normalized.includes('şikayet') || normalized.includes('complaint')) return 'Şikayet';
    return 'Öneri';
};

const statusLabel = (value?: string | null) => statusLabels[String(value || '')] || value || 'Beklemede';

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
};

const parseDetails = (item?: FeedbackItem | null): SuggestionDetails | null => {
    if (!item?.details) return null;
    try {
        return JSON.parse(item.details);
    } catch {
        return null;
    }
};

const fileHref = (path?: string | null) => {
    if (!path) return '';
    return path.startsWith('http') ? path : `${API_BASE}${path}`;
};

export {
    AiEditButton,
    CATEGORIES,
    DEPARTMENTS,
    feedbackTypeLabel,
    fileHref,
    formatDateTime,
    parseDetails,
    statusLabel,
};
export type {
    FeedbackComment,
    FeedbackHistory,
    FeedbackItem,
    FeedbackParticipant,
    FeedbackThread,
    FormTab,
    MainTab,
    SuggestionDetails,
};
