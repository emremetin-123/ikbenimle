import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, LockKeyhole, Send, CheckCheck, Clock3, Paperclip, UserPlus, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../AuthContext';
import { getPhotoUrl } from '../config';
import { IconButton } from '../components/IconButton';
import { FeedbackParticipantPicker } from './FeedbackParticipantPicker';
import { closed, dateText, feedbackKeys, statusText, type FeedbackItem, type FeedbackThread } from './feedbackModel';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_TYPES = '.pdf,.jpg,.jpeg,.png,.gif,.webp';

export function FeedbackConversation({ item, admin = false }: { item: FeedbackItem; admin?: boolean }) {
    const { user } = useAuth();
    const client = useQueryClient();
    const [comment, setComment] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentError, setAttachmentError] = useState('');
    const [inviting, setInviting] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const team = admin || Boolean(item.can_internal_comment);
    const canInvite = !admin && item.can_add_participants && !closed(item.status);
    const prefix = admin ? '/api/admin/feedback' : '/api/feedback';
    const threadQuery = useQuery({
        queryKey: [...feedbackKeys.thread(item.id, admin), user?.id],
        queryFn: ({ signal }) => api.get<FeedbackThread>(`${prefix}/${item.id}/thread`, { signal }),
    });
    const refresh = async () => {
        await Promise.all([
            client.invalidateQueries({ queryKey: ['feedback'] }),
            client.invalidateQueries({ queryKey: ['admin', 'feedback'] }),
        ]);
    };
    const commentMutation = useMutation({
        mutationFn: (body: { comment: string; is_public: boolean; file: File | null }) => {
            const url = `${prefix}/${item.id}/comments`;
            const { file, ...text } = body;
            if (!file) return api.post(url, text);
            const form = new FormData();
            form.set('comment', text.comment);
            form.set('is_public', String(text.is_public));
            form.set('file', file);
            return api.upload(url, form);
        },
        onSuccess: async () => {
            setComment('');
            setAttachment(null);
            setAttachmentError('');
            setMessage(team ? 'Görüşünüz eklendi.' : 'Mesajınız gönderildi.');
            await refresh();
        },
        onError: (error: Error) => { setMessage(error.message); void refresh(); },
    });
    const reviewMutation = useMutation({
        mutationFn: () => api.post(`/api/feedback/${item.id}/review-completion`),
        onSuccess: async () => { setMessage('İncelemeniz tamamlandı; talep yönetici değerlendirmesine iletildi.'); await refresh(); },
        onError: (error: Error) => setMessage(error.message),
    });
    const thread = threadQuery.data;
    const finishedReview = thread?.participants.some(p => p.user_id === user?.id && p.review_completed_at);
    const saving = commentMutation.isPending || reviewMutation.isPending;
    return <div className="fb-discussion">
        <section className="fb-card">
            <h2>{team ? 'Görüşler' : 'Yazışmalar'}</h2>
            <p className="fb-muted">{team ? 'Süreç ekibiyle görüşlerinizi paylaşın.' : 'Size açık olan mesajlar'}</p>
            {threadQuery.isPending && <p role="status">Görüşler yükleniyor…</p>}
            {threadQuery.isError && <div role="alert"><p>Görüşler yüklenemedi.</p><button className="fb-button" onClick={() => void threadQuery.refetch()}>Tekrar dene</button></div>}
            <div className="fb-comments">{thread?.comments.map(entry => <article key={entry.id} className="fb-comment">
                <div className="fb-comment-meta"><strong>{entry.user_name || 'Kullanıcı'}</strong><time>{dateText(entry.created_at, true)}</time></div>
                {team && <span className="fb-visibility">{entry.is_public ? <Eye size={14} /> : <LockKeyhole size={14} />}{entry.is_public ? 'Çalışana açık' : 'Yalnız ekip'}</span>}
                <p>{entry.comment}</p>
                {entry.attachment_name && <a className="fb-attachment fb-comment-attachment" href={getPhotoUrl(`${prefix}/${item.id}/comments/${entry.id}/attachment`)} download={entry.attachment_name}>
                    <Paperclip size={17} aria-hidden="true" /><span>{entry.attachment_name}</span>
                </a>}
            </article>)}</div>
            {threadQuery.isSuccess && !thread?.comments.length && <p className="fb-muted">Henüz görüş eklenmedi.</p>}
            {message && <p role="status" className="fb-notice">{message}</p>}
            {closed(item.status) ? <div className="fb-closed"><LockKeyhole size={18} /><p>Bu kayıt kapatıldı. Yeni mesaj veya işlem için yöneticinin yeniden açması gerekir.</p></div> : threadQuery.isSuccess && <form className="fb-composer" onSubmit={event => {
                event.preventDefault();
                if (comment.trim() && !saving) {
                    setMessage('');
                    commentMutation.mutate({ comment: comment.trim(), is_public: team ? isPublic : true, file: attachment });
                }
            }}>
                <h3>{team ? 'Görüş ekle' : 'Mesaj ekle'}</h3>
                {team && <fieldset className="fb-visibility-picker"><legend>Görüşün görünürlüğü</legend>
                    <label className={!isPublic ? 'fb-choice-selected' : ''}><input type="radio" name={`visibility-${item.id}`} checked={!isPublic} onChange={() => setIsPublic(false)} /><LockKeyhole size={17} />Yalnız ekip</label>
                    <label className={isPublic ? 'fb-choice-selected' : ''}><input type="radio" name={`visibility-${item.id}`} checked={isPublic} onChange={() => setIsPublic(true)} /><Eye size={17} />Çalışana açık</label>
                </fieldset>}
                <p id={`fb-comment-help-${item.id}`} className="fb-muted">{!team ? 'Mesajınız sorumlu ve süreç ekibiyle paylaşılır.' : isPublic ? 'Talep sahibi, sorumlu, katılımcılar ve yöneticiler görür.' : 'Yalnız sorumlu, katılımcılar ve yöneticiler görür. Talep sahibi göremez.'}</p>
                <label className="fb-field">{team ? 'Görüşünüz' : 'Mesajınız'}<textarea aria-describedby={`fb-comment-help-${item.id}`} maxLength={5000} required rows={4} value={comment} onChange={e => setComment(e.target.value)} placeholder="Eklemek istediğiniz bilgiyi yazın…" disabled={saving} /></label>
                <div className="fb-composer-attachment">
                    <input ref={fileInput} type="file" accept={ATTACHMENT_TYPES} hidden disabled={saving} onChange={event => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = '';
                        if (!file) return;
                        if (file.size > MAX_ATTACHMENT_BYTES) {
                            setAttachmentError('Dosya en fazla 10 MB olabilir.');
                            return;
                        }
                        setAttachmentError('');
                        setAttachment(file);
                    }} />
                    <button type="button" className="fb-button" disabled={saving} onClick={() => fileInput.current?.click()} aria-describedby={`fb-attachment-help-${item.id}`}>
                        <Paperclip size={17} aria-hidden="true" />{attachment ? 'Dosyayı değiştir' : 'Dosya ekle'}
                    </button>
                    {attachment && <div className="fb-attachment-selection">
                        <span>{attachment.name}</span>
                        <IconButton className="fb-icon-button" label="Ek dosyayı kaldır" disabled={saving} onClick={() => { setAttachment(null); setAttachmentError(''); }}><X size={18} aria-hidden="true" /></IconButton>
                    </div>}
                </div>
                <small id={`fb-attachment-help-${item.id}`} className="fb-muted">PDF veya görsel · En fazla 10 MB</small>
                {attachmentError && <p role="alert" className="fb-error">{attachmentError}</p>}
                <div className="fb-actions">
                    {item.can_complete_review && <button type="button" className="fb-button" disabled={saving || Boolean(finishedReview)} onClick={() => reviewMutation.mutate()}><CheckCheck size={18} />{finishedReview ? 'İncelemem tamamlandı' : 'İncelememi tamamla'}</button>}
                    <button className="fb-button fb-primary" type="submit" disabled={saving || !comment.trim()}><Send size={17} />{saving ? 'Kaydediliyor…' : team ? 'Görüşü gönder' : 'Mesajı gönder'}</button>
                </div>
                {item.can_complete_review && <small className="fb-muted">İncelemenizi tamamlamak talebi kapatmaz.</small>}
            </form>}
        </section>
        {team && thread && <section className="fb-card fb-team">
            <details className="fb-history"><summary>Süreç ekibi · {thread.participants.length} kişi</summary><ul>{thread.participants.map(p => <li key={p.id}>{p.name}{p.review_completed_at ? ' · İncelemesi tamamlandı' : ''}</li>)}</ul></details>
            {canInvite && <button type="button" className="fb-button" onClick={() => setInviting(true)}><UserPlus size={18} aria-hidden="true" />Katılımcı ekle</button>}
        </section>}
        {canInvite && inviting && <FeedbackParticipantPicker id={item.id} onClose={() => setInviting(false)} onSaved={refresh} />}
        <details className="fb-card fb-history"><summary><Clock3 size={17} />İşlem geçmişi</summary>
            {!threadQuery.isSuccess && <p>Geçmiş yüklenemedi veya yükleniyor.</p>}
            <ol>{thread?.history.map(entry => <li key={entry.id}><time>{dateText(entry.created_at, true)}</time><p>{entry.old_status ? `${statusText(entry.old_status)} → ` : 'Kayıt oluşturuldu · '}{statusText(entry.new_status)}</p>{admin && entry.note && <p className="fb-muted">{entry.note}</p>}</li>)}</ol>
        </details>
    </div>;
}
