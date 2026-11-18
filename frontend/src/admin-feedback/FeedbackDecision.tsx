import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCheck, LockKeyhole, X } from 'lucide-react';
import { ModalShell } from '../components/ModalShell';
import { api } from '../services/api';
import { feedbackDecisions } from '../feedback/feedbackModel';
import type { FeedbackItem } from '../types';

export function FeedbackDecision({ item, onClose }: { item: FeedbackItem; onClose: () => void }) {
    const client = useQueryClient();
    const [decision, setDecision] = useState(feedbackDecisions.find(([value]) => value === item.decision)?.[0] ?? 'approved');
    const [response, setResponse] = useState(item.public_response || '');
    const [note, setNote] = useState(item.decision_note || '');
    const mutation = useMutation({
        mutationFn: () => api.put(`/api/admin/feedback/${item.id}/decision`, { status: decision === 'rejected' ? 'rejected' : 'resolved', decision, decision_note: note.trim(), public_response: response.trim() }),
        onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: ['admin', 'feedback'] }), client.invalidateQueries({ queryKey: ['feedback'] })]); onClose(); },
    });
    const close = () => { if (!mutation.isPending) onClose(); };
    return <ModalShell labelledBy="fb-decision-title" className="fb-modal" onClose={close}>
        <div className="fb-section-heading"><h2 id="fb-decision-title">Kaydı sonuçlandır</h2><button className="fb-icon-button" aria-label="Sonuç penceresini kapat" onClick={close} disabled={mutation.isPending}><X size={20} /></button></div>
        <p className="fb-muted">#{item.id} · {item.title}</p>
        <form className="fb-form" onSubmit={e => { e.preventDefault(); if (response.trim() && !mutation.isPending) mutation.mutate(); }}>
            <fieldset disabled={mutation.isPending} className="fb-form-fields">
                <label className="fb-field">Karar<select value={decision} onChange={e => {
                    const selected = feedbackDecisions.find(([value]) => value === e.target.value);
                    if (selected) setDecision(selected[0]);
                }} required>{feedbackDecisions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="fb-field">Çalışana gönderilecek yanıt<textarea rows={5} maxLength={5000} required value={response} onChange={e => setResponse(e.target.value)} /></label>
                <p className="fb-muted">Bu yanıt çalışan ve katılımcılar tarafından görülebilir.</p>
                <details className="fb-history"><summary><LockKeyhole size={17} />İç karar notu ekle</summary><label className="fb-field">Yalnız yöneticiye açık not<textarea maxLength={5000} rows={3} value={note} onChange={e => setNote(e.target.value)} /></label></details>
                <p className="fb-notice">{decision === 'rejected' ? 'Kayıt reddedildi olarak kapatılacak.' : 'Seçilen karar ve resmi yanıt kaydedilerek süreç kapatılacak.'} Yeni yorum veya atama için yeniden açılması gerekecek.</p>
                <div className="fb-actions"><button type="button" className="fb-button" onClick={close}>Vazgeç</button><button type="submit" className="fb-button fb-primary" disabled={!response.trim()}><CheckCheck size={18} />{mutation.isPending ? 'Kaydediliyor…' : 'Yanıtı gönder ve kapat'}</button></div>
            </fieldset>
            {mutation.isError && <p className="fb-error" role="alert">{mutation.error.message}</p>}
        </form>
    </ModalShell>;
}
