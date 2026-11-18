import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, UserPlus } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../AuthContext';
import { PaginationControls } from '../components/PaginationControls';
import { closed, detailsOf, feedbackKeys, type FeedbackItem, type FeedbackThread } from '../feedback/feedbackModel';
import type { AdminUser } from '../types';

export function FeedbackAssignment({ item, onClose, onSaved }: { item: FeedbackItem; onClose: () => void; onSaved: () => void }) {
    const { user } = useAuth();
    const thread = useQuery({ queryKey: [...feedbackKeys.thread(item.id, true), user?.id], queryFn: () => api.get<FeedbackThread>(`/api/admin/feedback/${item.id}/thread`) });
    return <aside className="fb-card fb-routing" aria-label="Yönlendirme ve katılım">
        <div className="fb-section-heading"><h2>Yönlendirme ve katılım</h2><button className="fb-icon-button" type="button" onClick={onClose} aria-label="Yönlendirme panelini kapat"><X size={20} /></button></div>
        <p className="fb-prose"><strong>#{item.id} · {item.title}</strong></p>
        {thread.isPending && <p role="status">Katılımcılar yükleniyor…</p>}
        {thread.isError && <div role="alert"><p>Katılımcılar yüklenemedi.</p><button className="fb-button" onClick={() => void thread.refetch()}>Tekrar dene</button></div>}
        {thread.data && <AssignmentForm key={item.id} item={item} thread={thread.data} onSaved={onSaved} />}
    </aside>;
}

function AssignmentForm({ item, thread, onSaved }: { item: FeedbackItem; thread: FeedbackThread; onSaved: () => void }) {
    const client = useQueryClient();
    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search);
    const [page, setPage] = useState(1);
    const [assignee, setAssignee] = useState(String(item.assigned_to_user_id || ''));
    const [department, setDepartment] = useState(item.assigned_department || detailsOf(item)?.department || '');
    const [dueDate, setDueDate] = useState(item.due_date?.slice(0, 10) || '');
    const [note, setNote] = useState('');
    const [participants, setParticipants] = useState(thread.participants.map(p => ({ id: p.user_id, name: p.name })));
    const users = useQuery({
        queryKey: ['admin', 'feedback-user-options', { page, search: deferredSearch }],
        queryFn: ({ signal }) => api.list<AdminUser>(`/api/admin/feedback/user-options?${new URLSearchParams({ page: String(page), pageSize: '15', search: deferredSearch })}`, { signal }),
    });
    const mutation = useMutation({
        mutationFn: () => api.put(`/api/admin/feedback/${item.id}/assignment`, {
            assigned_to_user_id: assignee ? Number(assignee) : null, assigned_department: department.trim(),
            due_date: dueDate || null, participant_user_ids: participants.map(p => p.id), replace_participants: true, note: note.trim(),
        }),
        onSuccess: async () => {
            await Promise.all([client.invalidateQueries({ queryKey: ['admin', 'feedback'] }), client.invalidateQueries({ queryKey: ['feedback'] })]);
            onSaved();
        },
    });
    const options = users.data?.items || [];
    return <form className="fb-form" onSubmit={e => { e.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}>
        <fieldset disabled={mutation.isPending || closed(item.status)} className="fb-form-fields">
            <label className="fb-field">İlgili birim<input maxLength={255} value={department} onChange={e => setDepartment(e.target.value)} placeholder="Örn. İnsan Kaynakları" /></label>
            <label className="fb-field">Kişi ara<input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Ad, sicil veya bölüm" /></label>
            {users.isError && <p role="alert">Kişiler yüklenemedi. <button type="button" className="fb-button" onClick={() => void users.refetch()}>Tekrar dene</button></p>}
            <label className="fb-field">Sorumlu kişi<select value={assignee} onChange={e => setAssignee(e.target.value)}>
                <option value="">Sorumlu seçin</option>
                {assignee && !options.some(p => String(p.id) === assignee) && <option value={assignee}>{participants.find(p => String(p.id) === assignee)?.name || item.assigned_to_name || 'Seçili sorumlu'}</option>}
                {options.map(p => <option key={p.id} value={p.id}>{p.name} · {p.department || 'Bölüm yok'}</option>)}
            </select></label>
            <div className="fb-field"><span>Katılımcılar</span><div className="fb-chips">{participants.filter(p => String(p.id) !== assignee).map(p => <span key={p.id}>{p.name}<button type="button" aria-label={`${p.name} katılımcısını kaldır`} onClick={() => setParticipants(previous => previous.filter(q => q.id !== p.id))}><X size={14} /></button></span>)}</div>
                <select aria-label="Katılımcı ekle" value="" onChange={e => { const person = options.find(p => p.id === Number(e.target.value)); if (person) setParticipants(previous => [...previous, { id: person.id, name: person.name }]); }}>
                    <option value="">+ Kişi ekle</option>{options.filter(p => !participants.some(q => q.id === p.id) && String(p.id) !== assignee).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
            </div>
            <PaginationControls pagination={users.data?.pagination} onPageChange={setPage} />
            <label className="fb-field">Hedef tarih<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
            <label className="fb-field">Atama notu<textarea maxLength={2000} rows={3} value={note} onChange={e => setNote(e.target.value)} /></label>
            <small className="fb-muted">Atama notu yalnız süreç ekibine görünür; talep sahibi göremez.</small>
            <button className="fb-button fb-primary" type="submit" disabled={(!assignee && !department.trim()) || users.isPending}><UserPlus size={18} />{mutation.isPending ? 'Kaydediliyor…' : 'Yönlendirmeyi kaydet'}</button>
        </fieldset>
        {closed(item.status) && <p className="fb-notice">Kapalı kaydı yönlendirmeden önce yeniden açın.</p>}
        {mutation.isError && <p role="alert" className="fb-error">{mutation.error.message}</p>}
    </form>;
}
