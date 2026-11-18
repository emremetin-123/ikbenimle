import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPhotoUrl } from './config';
import { ChevronDown, FileText, Image, Megaphone, Paperclip, Plus, Trash2, X } from 'lucide-react';
import type { Announcement } from './types';
import { api } from './services/api';
import { queryKeys } from './queryClient';
import { ModulePageHeader } from './components/ModulePageHeader';
import { PaginationControls } from './components/PaginationControls';
import { useAppFeedback } from './components/AppFeedback';
import { ModalShell } from './components/ModalShell';

export const AdminAnnouncements = () => {
    const queryClient = useQueryClient();
    const feedback = useAppFeedback();
    const [page, setPage] = useState(1);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
    const [visibleUntil, setVisibleUntil] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [message, setMessage] = useState('');

    const announcementsQuery = useQuery({
        queryKey: [...queryKeys.adminAnnouncements, page],
        queryFn: () => api.list<Announcement>(
            `/api/admin/announcements?page=${page}&pageSize=10&sort=created_at&order=desc`
        ),
        placeholderData: previous => previous
    });
    const departmentsQuery = useQuery({
        queryKey: queryKeys.announcementDepartments,
        queryFn: () => api.get<string[]>('/api/admin/announcements/departments')
    });
    const announcements = announcementsQuery.data?.items || [];
    const departments = departmentsQuery.data || [];

    const createMutation = useMutation({
        mutationFn: (form: FormData) =>
            api.upload<{ success: true }>('/api/admin/announcements', form),
        onSuccess: async () => {
            setPage(1);
            await queryClient.invalidateQueries({ queryKey: queryKeys.adminAnnouncements });
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (id: number) =>
            api.delete<{ success: true }>(`/api/admin/announcements/${id}`),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.adminAnnouncements });
        }
    });

    const resetForm = () => {
        setTitle('');
        setContent('');
        setAttachment(null);
        setTargetDepartments([]);
        setVisibleUntil('');
    };

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        const form = new FormData();
        form.append('title', title);
        form.append('content', content);
        form.append('target_department', JSON.stringify(targetDepartments));
        form.append('visible_until', visibleUntil);
        if (attachment) form.append('attachment', attachment);

        try {
            await createMutation.mutateAsync(form);
            resetForm();
            setShowCreateModal(false);
            setMessage('Duyuru yayınlandı.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Duyuru yayınlanamadı.');
        }
    };

    const handleDelete = async (id: number) => {
        if (!await feedback.confirm({ title: 'Duyuruyu sil', message: 'Bu duyuru kalıcı olarak silinecek.', confirmLabel: 'Duyuruyu Sil', danger: true })) return;
        try {
            await deleteMutation.mutateAsync(id);
            setMessage('Duyuru silindi.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Duyuru silinemedi.');
        }
    };

    const attachmentIcon = (type?: string | null) => type?.startsWith('image/') ? <Image size={16} /> : <FileText size={16} />;
    const parseTargets = (value?: string | null) => {
        if (!value) return [];
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map(item => String(item)).filter(Boolean);
        } catch {
            // Eski kayıtlarda hedef kitle tek departman adı olarak durabilir.
        }
        return value.split(',').map(item => item.trim()).filter(Boolean);
    };
    const targetLabel = (value?: string | null) => {
        const targets = parseTargets(value);
        if (!targets.length) return 'Tüm Şirket';
        if (targets.length <= 2) return targets.join(', ');
        return `${targets.slice(0, 2).join(', ')} +${targets.length - 2}`;
    };
    const toggleDepartment = (department: string) => {
        setTargetDepartments(current => current.includes(department)
            ? current.filter(item => item !== department)
            : [...current, department]);
    };

    return (
        <div className="admin-announcements-page">
            <ModulePageHeader
                icon={<Megaphone />}
                title="Duyuru İşlemleri"
                description="Yayındaki duyuruları görüntüleyin, ekli dosyaları kontrol edin veya yeni duyuru yayınlayın."
                actions={
                    <button type="button" className="btn-primary admin-announcements-create-button" onClick={() => setShowCreateModal(true)}>
                        <Plus size={18} /> Yeni Duyuru Ekle
                    </button>
                }
            />

            {message && <div className="module-page-notice" role="status">{message}</div>}
            <section className="premium-card admin-announcements-list-card">
                <div className="admin-announcements-list-header">
                    <h3 className="admin-announcements-list-title">Mevcut Duyurular</h3>
                </div>
                <div className="admin-announcements-list">
                    {announcements.length === 0 ? (
                        <div className="admin-announcements-empty-state">
                            Henüz yayınlanmış duyuru bulunmuyor.
                        </div>
                    ) : announcements.map(announcement => (
                        <article
                            key={`${page}-${announcement.id}`}
                            className="table-row-hover admin-announcement-row"
                        >
                            <details className="admin-announcement-content admin-announcement-disclosure">
                                <summary className="admin-announcement-summary">
                                    <div className="admin-announcement-summary-copy">
                                        <h4 className="admin-announcement-title">{announcement.title}</h4>
                                        <span className="admin-announcement-summary-date">{announcement.created_at ? new Date(announcement.created_at).toLocaleString('tr-TR') : '-'}</span>
                                    </div>
                                    <ChevronDown size={20} className="admin-announcement-chevron" aria-hidden="true" />
                                </summary>
                                <div className="admin-announcement-expanded">
                                <div className="admin-announcement-title-row">
                                    <span className="admin-announcement-target-badge">
                                        {targetLabel(announcement.target_department)}
                                    </span>
                                    <span className={`admin-announcement-expiry-badge ${announcement.visible_until ? 'has-date' : 'is-missing'}`}>
                                        {announcement.visible_until ? `${new Date(announcement.visible_until).toLocaleDateString('tr-TR')} tarihine kadar` : 'Tarih eksik'}
                                    </span>
                                </div>
                                <p className="admin-announcement-meta">
                                    Yayınlayan: {announcement.author_name || 'Sistem'}
                                </p>
                                <p className="admin-announcement-body">{announcement.content}</p>
                                {announcement.attachment_path && (
                                    <a
                                        href={getPhotoUrl(announcement.attachment_path)}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn-secondary announcement-attachment-link admin-announcement-attachment"
                                    >
                                        {attachmentIcon(announcement.attachment_type)} {announcement.attachment_name || 'Duyuru eki'}
                                    </a>
                                )}
                                </div>
                            </details>
                            <button
                                type="button"
                                onClick={() => handleDelete(announcement.id)}
                                className="btn-icon admin-announcement-delete"
                                title="Sil"
                                aria-label={`${announcement.title} duyurusunu sil`}
                            >
                                <Trash2 size={18} />
                            </button>
                        </article>
                    ))}
                    <PaginationControls
                        pagination={announcementsQuery.data?.pagination}
                        onPageChange={setPage}
                    />
                </div>
            </section>

            {showCreateModal && (
                <ModalShell onClose={() => setShowCreateModal(false)} labelledBy="admin-announcement-modal-title">
                        <div className="admin-announcement-modal-header">
                            <h3 id="admin-announcement-modal-title" className="admin-announcement-modal-title">Yeni Duyuru Yayınla</h3>
                            <button type="button" className="admin-modal-close" onClick={() => setShowCreateModal(false)} title="Kapat">
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="admin-announcement-form">
                            <div className="input-group admin-announcement-field">
                                <label className="input-label">Duyuru Başlığı</label>
                                <input
                                    className="form-control"
                                    required
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder="Duyuru başlığını girin"
                                />
                            </div>
                            <div className="input-group admin-announcement-field">
                                <label className="input-label">Duyuru İçeriği</label>
                                <textarea
                                    required
                                    value={content}
                                    onChange={(event) => setContent(event.target.value)}
                                    rows={5}
                                    placeholder="Duyuru detaylarını yazın"
                                    className="form-control admin-announcement-textarea"
                                />
                            </div>
                            <div className="input-group admin-announcement-field">
                                <label className="input-label">Hedef Kitle</label>
                                <div className="announcement-target-picker">
                                    <button type="button" className={`announcement-target-all ${targetDepartments.length === 0 ? 'active' : ''}`} onClick={() => setTargetDepartments([])}>
                                        Tüm şirket
                                    </button>
                                    <div className="announcement-target-list">
                                        {departments.map(department => (
                                            <label key={department} className={targetDepartments.includes(department) ? 'active' : ''}>
                                                <input
                                                    type="checkbox"
                                                    checked={targetDepartments.includes(department)}
                                                    onChange={() => toggleDepartment(department)}
                                                />
                                                <span>{department}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <small className="admin-announcement-help">
                                    Bölüm seçmezseniz duyuru tüm şirkete yayınlanır.
                                </small>
                            </div>
                            <div className="input-group admin-announcement-field">
                                <label className="input-label">Son Görünme Tarihi</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    required
                                    value={visibleUntil}
                                    onChange={(event) => setVisibleUntil(event.target.value)}
                                />
                                <small className="admin-announcement-help">
                                    Bu tarihten sonra duyuru çalışan ekranından otomatik kalkar, duyuru işlemlerinde kayıt olarak kalır.
                                </small>
                            </div>
                            <div className="input-group admin-announcement-field">
                                <label className="input-label">Ek Dosya</label>
                                <label className="form-control admin-announcement-file-picker">
                                    <Paperclip size={18} color="var(--primary)" />
                                    <span className={attachment ? 'has-file' : 'is-placeholder'}>
                                        {attachment ? attachment.name : 'PDF veya görsel seçin'}
                                    </span>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/*"
                                        onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                                        className="admin-announcement-file-input"
                                    />
                                </label>
                                {attachment && (
                                    <button type="button" className="btn-secondary admin-announcement-remove-file" onClick={() => setAttachment(null)}>
                                        Eki Kaldır
                                    </button>
                                )}
                            </div>
                            <div className="admin-modal-actions">
                                <button type="button" className="btn-cancel admin-announcement-cancel" onClick={() => setShowCreateModal(false)}>
                                    İptal
                                </button>
                                <button type="submit" className="btn-primary admin-announcement-submit">
                                    Yayınla
                                </button>
                            </div>
                        </form>
                </ModalShell>
            )}
        </div>
    );
};
