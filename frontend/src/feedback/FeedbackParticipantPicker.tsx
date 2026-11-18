import { useDeferredValue, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, X } from 'lucide-react';
import { IconButton } from '../components/IconButton';
import { ModalShell } from '../components/ModalShell';
import { PaginationControls } from '../components/PaginationControls';
import { api } from '../services/api';

type ParticipantOption = { id: number; name: string; employee_id: string; department?: string | null };

export function FeedbackParticipantPicker({ id, onClose, onSaved }: { id: number; onClose: () => void; onSaved: () => Promise<void> }) {
    const client = useQueryClient();
    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search);
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState('');
    const key = ['feedback', 'participant-options', id] as const;
    const options = useQuery({
        queryKey: [...key, page, deferredSearch],
        queryFn: ({ signal }) => api.list<ParticipantOption>(`/api/feedback/${id}/participant-options?${new URLSearchParams({ page: String(page), pageSize: '15', search: deferredSearch })}`, { signal }),
    });
    const mutation = useMutation({
        mutationFn: (userId: number) => api.post(`/api/feedback/${id}/participants`, { user_ids: [userId] }),
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: key, refetchType: 'none' });
            await onSaved();
            onClose();
        },
    });
    const close = () => { if (!mutation.isPending) onClose(); };
    const selectedUser = options.data?.items.find(person => String(person.id) === selected);
    return <ModalShell labelledBy="fb-participants-title" className="fb-modal" onClose={close}>
        <div className="fb-section-heading">
            <h2 id="fb-participants-title">Katılımcı ekle</h2>
            <IconButton className="fb-icon-button" label="Katılımcı penceresini kapat" onClick={close} disabled={mutation.isPending}><X size={20} aria-hidden="true" /></IconButton>
        </div>
        <p className="fb-muted">Eklenen kişi bu talebi ve ekip içi yazışmaları görebilir.</p>
        <form className="fb-form" onSubmit={event => {
            event.preventDefault();
            if (selectedUser && !mutation.isPending) mutation.mutate(selectedUser.id);
        }}>
            <fieldset className="fb-form-fields" disabled={mutation.isPending}>
                <label className="fb-field">Kişi ara<input maxLength={255} value={search} onChange={event => { setSearch(event.target.value); setPage(1); setSelected(''); }} placeholder="Ad, sicil veya bölüm" /></label>
                {options.isPending && <p role="status">Kişiler yükleniyor…</p>}
                {options.isError && <div role="alert"><p>{options.error.message}</p><button type="button" className="fb-button" onClick={() => void options.refetch()}>Tekrar dene</button></div>}
                {options.isSuccess && <>
                    <label className="fb-field">Katılımcı<select value={selected} onChange={event => setSelected(event.target.value)} disabled={!options.data.items.length}>
                        <option value="">{options.data.items.length ? 'Bir çalışan seçin' : 'Eklenebilecek çalışan bulunamadı'}</option>
                        {options.data.items.map(person => <option key={person.id} value={person.id}>{person.name} · {person.employee_id}{person.department ? ` · ${person.department}` : ''}</option>)}
                    </select></label>
                    <PaginationControls pagination={options.data.pagination} onPageChange={next => { setPage(next); setSelected(''); }} />
                </>}
                <div className="fb-actions">
                    <button className="fb-button" type="button" onClick={close}>Vazgeç</button>
                    <button className="fb-button fb-primary" type="submit" disabled={!selectedUser}><UserPlus size={18} aria-hidden="true" />{mutation.isPending ? 'Ekleniyor…' : 'Katılımcı ekle'}</button>
                </div>
            </fieldset>
            {mutation.isError && <p className="fb-error" role="alert">{mutation.error.message}</p>}
        </form>
    </ModalShell>;
}
