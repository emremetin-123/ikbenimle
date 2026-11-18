import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPhotoUrl } from './config';
import { Newspaper, Plus, Trash2, Image as ImageIcon, X } from 'lucide-react';
import type { CompanyNews } from './types';
import { api } from './services/api';
import { queryKeys } from './queryClient';
import { ModulePageHeader } from './components/ModulePageHeader';
import { PaginationControls } from './components/PaginationControls';
import { useAppFeedback } from './components/AppFeedback';
import { ModalShell } from './components/ModalShell';

export const AdminNews = () => {
    const queryClient = useQueryClient();
    const feedback = useAppFeedback();
    const [page, setPage] = useState(1);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const newsQuery = useQuery({
        queryKey: [...queryKeys.adminNews, page],
        queryFn: () => api.list<CompanyNews>(
            `/api/admin/news?page=${page}&pageSize=10&sort=created_at&order=desc`
        ),
        placeholderData: previous => previous
    });
    const news = newsQuery.data?.items || [];
    const createMutation = useMutation({
        mutationFn: (formData: FormData) =>
            api.upload<{ success: true }>('/api/admin/news', formData),
        onSuccess: async () => {
            setPage(1);
            await queryClient.invalidateQueries({ queryKey: queryKeys.adminNews });
            await queryClient.invalidateQueries({ queryKey: queryKeys.employeeNews });
        }
    });
    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.delete<{ success: true }>(`/api/admin/news/${id}`),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.adminNews });
            await queryClient.invalidateQueries({ queryKey: queryKeys.employeeNews });
        }
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('title', title);
        formData.append('content', content);
        if (imageFile) {
            formData.append('image', imageFile);
        }

        try {
            await createMutation.mutateAsync(formData);
            setTitle('');
            setContent('');
            setImageFile(null);
            setShowCreateModal(false);
            feedback.notifySuccess('Haber başarıyla yayınlandı');
            // Reset file input
            const fileInput = document.getElementById('newsImageInput') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        } catch (error) {
            feedback.notifyError('Hata: ' + (error instanceof Error ? error.message : 'Haber yayınlanamadı'));
        }
    };

    const handleDelete = async (id: number) => {
        if (!await feedback.confirm({ title: 'Haberi sil', message: 'Bu haber kalıcı olarak silinecek.', confirmLabel: 'Haberi Sil', danger: true })) return;
        await deleteMutation.mutateAsync(id).catch(error => {
            feedback.notifyError(error instanceof Error ? error.message : 'Haber silinemedi');
        });
    };

    return (
        <div className="admin-news-page">
            <ModulePageHeader
                icon={<Newspaper />}
                title="Şirket Haberleri Yönetimi"
                description="Yayındaki haberleri görüntüleyin veya yeni haber yayınlayın."
                actions={
                    <button type="button" className="btn-primary admin-news-create-button" onClick={() => setShowCreateModal(true)}>
                        <Plus size={18} /> Yeni Haber Ekle
                    </button>
                }
            />

            {showCreateModal && (
                <ModalShell onClose={() => setShowCreateModal(false)} labelledBy="admin-news-modal-title" className="admin-action-modal">
                    <div className="admin-modal-header">
                        <h3 id="admin-news-modal-title" className="admin-news-modal-title">Yeni Haber Yayınla</h3>
                        <button type="button" className="admin-modal-close" onClick={() => setShowCreateModal(false)} title="Kapat">
                            <X size={18} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="admin-news-form">
                        <div className="input-group admin-news-field">
                            <label className="input-label">Haber Başlığı</label>
                            <input
                                className="form-control"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Haber başlığını giriniz..."
                            />
                        </div>
                        <div className="input-group admin-news-field">
                            <label className="input-label">Haber İçeriği</label>
                            <textarea
                                className="form-control admin-news-textarea"
                                required
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={4}
                                placeholder="Haber detaylarını buraya yazınız..."
                            />
                        </div>
                        <div className="input-group admin-news-field">
                            <label className="input-label">Görsel (Opsiyonel)</label>
                            <div className="admin-news-image-field">
                                <div className="admin-news-image-preview">
                                    {imageFile ? (
                                        <img src={URL.createObjectURL(imageFile)} alt="Preview" className="admin-news-image" />
                                    ) : (
                                        <ImageIcon color="var(--text-muted)" size={24} />
                                    )}
                                </div>
                                <input
                                    id="newsImageInput"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                                    className="form-control admin-news-file-input"
                                />
                            </div>
                        </div>
                        <div className="admin-modal-actions">
                            <button type="button" className="btn-cancel admin-news-cancel" onClick={() => setShowCreateModal(false)}>İptal</button>
                            <button type="submit" className="btn-primary admin-news-submit">Yayınla</button>
                        </div>
                    </form>
                </ModalShell>
            )}

            <div className="premium-card admin-news-list-card">
                <div className="admin-news-list-header">
                    <h3 className="admin-news-list-title">Yayınlanmış Haberler</h3>
                </div>
                <div className="admin-news-list">
                    {news.length === 0 ? (
                        <p className="admin-news-empty">Henüz haber eklenmemiş.</p>
                    ) : (
                        news.map(n => (
                            <div key={n.id} className="table-row-hover admin-news-row">
                                <div className="admin-news-row-content">
                                    {n.image_url ? (
                                        <img
                                            src={getPhotoUrl(n.image_url)}
                                            alt={n.title}
                                            className="admin-news-thumbnail"
                                        />
                                    ) : (
                                        <div className="admin-news-thumbnail admin-news-thumbnail-placeholder">
                                            <ImageIcon color="var(--text-muted)" />
                                        </div>
                                    )}
                                    <div className="admin-news-row-text">
                                        <div className="admin-news-meta">
                                            <span className="admin-news-date">
                                                {n.created_at ? new Date(n.created_at).toLocaleDateString('tr-TR') : '-'}
                                            </span>
                                            {n.author_name && <span className="admin-news-author">Yazan: {n.author_name}</span>}
                                        </div>
                                        <h4 className="admin-news-item-title">{n.title}</h4>
                                        <p className="admin-news-excerpt">
                                            {n.content}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(n.id)} className="btn-icon admin-news-delete" title="Haberi Sil">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))
                    )}
                    <PaginationControls
                        pagination={newsQuery.data?.pagination}
                        onPageChange={setPage}
                    />
                </div>
            </div>
        </div>
    );
};
