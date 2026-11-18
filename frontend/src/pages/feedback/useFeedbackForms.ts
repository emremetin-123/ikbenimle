import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import type { ComplaintForm, SuggestionForm } from './FeedbackFormModal';
import type { FormTab } from './feedbackSupport';

const emptySuggestion = (): SuggestionForm => ({ title: '', department: '', currentSituation: '', proposedSituation: '', category: '', investment: '', estimatedCost: '', is_anonymous: false, file: null });
export function useFeedbackForms(onCreated: () => void) {
    const client = useQueryClient();
    const [open, setOpen] = useState(false);
    const [formTab, setFormTab] = useState<FormTab>('oneri');
    const [status, setStatus] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [aiLoading, setAiLoading] = useState<string | null>(null);
    const [complaintForm, setComplaintForm] = useState<ComplaintForm>({ title: '', content: '', is_anonymous: false });
    const [suggestionForm, setSuggestionForm] = useState(emptySuggestion);
    const sending = useRef(false);
    const openForm = (tab: FormTab) => { setFormTab(tab); setStatus(null); setOpen(true); };
    const closeForm = () => { if (!busy && !aiLoading) setOpen(false); };
    const submit = async (event: FormEvent, suggestion: boolean) => {
        event.preventDefault();
        if (sending.current || aiLoading) return;
        sending.current = true; setBusy(true); setStatus(null);
        try {
            const anonymous = suggestion ? suggestionForm.is_anonymous : complaintForm.is_anonymous;
            if (suggestion) {
                const { file, title, is_anonymous, ...details } = suggestionForm;
                const data = new FormData();
                data.set('type', 'suggestion'); data.set('title', title.trim());
                data.set('content', `Öneri Kategorisi: ${details.category}`);
                data.set('details', JSON.stringify(details)); data.set('is_anonymous', String(is_anonymous));
                if (file) data.set('file', file);
                await api.upload('/api/feedback/suggestion', data);
                setSuggestionForm(emptySuggestion());
            } else {
                await api.post('/api/feedback', { type: 'complaint', ...complaintForm });
                setComplaintForm({ title: '', content: '', is_anonymous: false });
            }
            setOpen(false);
            setStatus(anonymous ? 'Anonim bildiriminiz iletildi. Kimliğiniz saklanmadığı için Gönderdiklerim listesinde yer almaz.' : 'Talebiniz başarıyla iletildi.');
            onCreated(); await client.invalidateQueries({ queryKey: ['feedback'] });
        } catch (error) { setStatus(error instanceof Error ? error.message : 'Talep gönderilemedi.'); }
        finally { sending.current = false; setBusy(false); }
    };
    const improveText = async (field: string, text: string, context: string, apply: (text: string) => void) => {
        if (!text.trim()) { setStatus('Önce düzenlenecek metni yazın.'); return; }
        setAiLoading(field); setStatus(null);
        try {
            const result = await api.post<{ improvedText: string }>('/api/feedback/improve-text', { text: text.trim(), context });
            apply(result.improvedText); setStatus('Metin düzenlendi. Göndermeden önce kontrol edebilirsiniz.');
        } catch (error) { setStatus(error instanceof Error ? error.message : 'Metin düzenlenemedi.'); }
        finally { setAiLoading(null); }
    };
    return { open, formTab, status, busy, aiLoading, complaintForm, suggestionForm, setComplaintForm, setSuggestionForm, openForm, closeForm, improveText,
        onComplaintSubmit: (e: FormEvent) => void submit(e, false), onSuggestionSubmit: (e: FormEvent) => void submit(e, true) };
}
