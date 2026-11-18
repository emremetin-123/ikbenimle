import { ModulePageHeader } from './components/ModulePageHeader';
import { ModalShell } from './components/ModalShell';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ChevronDown, ChevronUp, Plus, Star, Trash2, X } from 'lucide-react';
import { api } from './services/api';
import { queryKeys } from './queryClient';
import { PaginationControls } from './components/PaginationControls';
import type {
    KnowledgeCategory,
    KnowledgeItem,
    PaginatedResponse
} from './types';
import { useAppFeedback } from './components/AppFeedback';

type KnowledgeItemsResponse = PaginatedResponse<KnowledgeItem> & {
    category: KnowledgeCategory;
    sub_categories: string[];
};

const emptyItem = (): Partial<KnowledgeItem> => ({
    category_id: 0,
    sub_category: '',
    question: '',
    answer: '',
    is_featured: false,
    order_index: 0
});

export const AdminKnowledgePortal = () => {
    const queryClient = useQueryClient();
    const feedback = useAppFeedback();
    const [categoryPage, setCategoryPage] = useState(1);
    const [itemPage, setItemPage] = useState(1);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [newItem, setNewItem] = useState<Partial<KnowledgeItem>>(emptyItem);
    const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
    const [message, setMessage] = useState('');

    const categoriesQuery = useQuery({
        queryKey: [...queryKeys.adminKnowledgeCategories, categoryPage],
        queryFn: () => api.list<KnowledgeCategory>(
            `/api/admin/knowledge/categories?page=${categoryPage}&pageSize=12&sort=order_index&order=asc`
        )
    });
    const itemsQuery = useQuery({
        queryKey: [...queryKeys.adminKnowledgeItems, expandedCategory, itemPage],
        queryFn: () => api.get<KnowledgeItemsResponse>(
            `/api/admin/knowledge/categories/${expandedCategory}/items?page=${itemPage}&pageSize=20&sort=order_index&order=asc`
        ),
        enabled: expandedCategory !== null
    });
    const categories = categoriesQuery.data?.items || [];
    const items = itemsQuery.data?.items || [];

    const refreshKnowledge = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: queryKeys.adminKnowledgeCategories }),
            queryClient.invalidateQueries({ queryKey: queryKeys.adminKnowledgeItems }),
            queryClient.invalidateQueries({ queryKey: queryKeys.employeeKnowledgeCategories }),
            queryClient.invalidateQueries({ queryKey: queryKeys.employeeKnowledgeItems })
        ]);
    };

    const createCategory = useMutation({
        mutationFn: () => api.post('/api/admin/knowledge/categories', {
            name: newCategoryName.trim(),
            order_index: categoriesQuery.data?.pagination.total || 0
        }),
        onSuccess: async () => {
            setNewCategoryName('');
            setMessage('Kategori eklendi.');
            await refreshKnowledge();
            setCategoryModalOpen(false);
        },
        onError: error => setMessage(error instanceof Error ? error.message : 'Kategori eklenemedi.')
    });

    const deleteCategory = useMutation({
        mutationFn: (id: number) => api.delete(`/api/admin/knowledge/categories/${id}`),
        onSuccess: async () => {
            setExpandedCategory(null);
            setMessage('Kategori silindi.');
            await refreshKnowledge();
        },
        onError: error => setMessage(error instanceof Error ? error.message : 'Kategori silinemedi.')
    });

    const createItem = useMutation({
        mutationFn: () => api.post('/api/admin/knowledge/items', {
            category_id: newItem.category_id,
            sub_category: newItem.sub_category || null,
            question: newItem.question,
            answer: newItem.answer,
            is_featured: Boolean(newItem.is_featured),
            order_index: itemsQuery.data?.pagination.total || 0
        }),
        onSuccess: async () => {
            setNewItem(previous => ({
                ...emptyItem(),
                category_id: previous.category_id
            }));
            setMessage('Bilgi kaydı eklendi.');
            await refreshKnowledge();
        },
        onError: error => setMessage(error instanceof Error ? error.message : 'Bilgi eklenemedi.')
    });

    const deleteItem = useMutation({
        mutationFn: (id: number) => api.delete(`/api/admin/knowledge/items/${id}`),
        onSuccess: async () => {
            setMessage('Bilgi kaydı silindi.');
            await refreshKnowledge();
        },
        onError: error => setMessage(error instanceof Error ? error.message : 'Bilgi silinemedi.')
    });

    const confirmCategoryDelete = async (id: number) => {
        if (await feedback.confirm({
            title: 'Kategoriyi sil',
            message: 'Kategori ve içindeki tüm bilgi kayıtları kalıcı olarak silinecek.',
            confirmLabel: 'Kategoriyi Sil',
            danger: true,
        })) deleteCategory.mutate(id);
    };

    const confirmItemDelete = async (id: number) => {
        if (await feedback.confirm({
            title: 'Bilgi kaydını sil',
            message: 'Bu bilgi kaydı kalıcı olarak silinecek.',
            confirmLabel: 'Kaydı Sil',
            danger: true,
        })) deleteItem.mutate(id);
    };

    const handleAddCategory = () => {
        if (createCategory.isPending) return;
        if (!newCategoryName.trim()) {
            setMessage('Kategori adı gereklidir.');
            return;
        }
        createCategory.mutate();
    };
    const closeCategoryModal = () => {
        if (createCategory.isPending) return;
        setCategoryModalOpen(false);
        setNewCategoryName('');
        createCategory.reset();
    };

    const handleAddItem = () => {
        if (!newItem.category_id || !newItem.question?.trim() || !newItem.answer?.trim()) {
            setMessage('Kategori, soru ve cevap alanları zorunludur.');
            return;
        }
        createItem.mutate();
    };

    return (
        <div className="admin-knowledge-container">
            <ModulePageHeader title="Bilgi İşlemleri" description="Bilgi portalındaki kategorileri, soruları ve yanıtları yönetin." icon={<BookOpen />} tone="violet" actions={<button type="button" className="btn-secondary" onClick={() => { createCategory.reset(); setCategoryModalOpen(true); }} aria-haspopup="dialog"><Plus size={18} /> Kategori Ekle</button>} />
            {message && <div className="admin-knowledge-message" role="status">{message}</div>}
            {categoryModalOpen && <ModalShell onClose={closeCategoryModal} labelledBy="knowledge-category-title" overlayClassName="admin-modal-overlay knowledge-category-overlay" surfaceClassName="premium-card knowledge-category-modal">
                <div className="admin-modal-header">
                    <h2 id="knowledge-category-title">Kategori Ekle</h2>
                    <button type="button" className="admin-modal-close" onClick={closeCategoryModal} disabled={createCategory.isPending} aria-label="Kategori penceresini kapat"><X size={20} /></button>
                </div>
                <form onSubmit={event => { event.preventDefault(); handleAddCategory(); }}>
                    <label className="input-label" htmlFor="knowledge-category-name">Kategori adı</label>
                    <input id="knowledge-category-name" className="form-control" placeholder="Kategori adını girin" value={newCategoryName} onChange={event => setNewCategoryName(event.target.value)} required disabled={createCategory.isPending} />
                    {createCategory.isError && <p className="knowledge-category-error" role="alert">{createCategory.error.message}</p>}
                    <div className="admin-modal-actions">
                        <button type="button" className="btn-secondary" onClick={closeCategoryModal} disabled={createCategory.isPending}>Vazgeç</button>
                        <button type="submit" className="btn-primary" disabled={createCategory.isPending || !newCategoryName.trim()}>{createCategory.isPending ? 'Ekleniyor…' : 'Ekle'}</button>
                    </div>
                </form>
            </ModalShell>}

            <div className="categories-list">
                {categories.map(category => (
                    <div key={category.id} className="category-admin-card">
                        <div className="category-admin-header">
                            <button
                                type="button"
                                className="category-admin-toggle"
                                aria-expanded={expandedCategory === category.id}
                                aria-controls={`knowledge-category-${category.id}`}
                                onClick={() => {
                                    setExpandedCategory(
                                        expandedCategory === category.id ? null : category.id
                                    );
                                    setItemPage(1);
                                    setNewItem(previous => ({
                                        ...previous,
                                        category_id: category.id
                                    }));
                                }}
                            >
                                {expandedCategory === category.id
                                    ? <ChevronUp size={20} />
                                    : <ChevronDown size={20} />}
                                <span className="category-admin-name">
                                    {category.name}
                                </span>
                                <span className="category-admin-count">
                                    ({category.item_count || 0} içerik)
                                </span>
                            </button>
                            <button
                                type="button"
                                className="btn-icon knowledge-delete-action"
                                onClick={() => void confirmCategoryDelete(category.id)}
                                title="Kategoriyi sil"
                                aria-label={`${category.name} kategorisini sil`}
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>

                        {expandedCategory === category.id && (
                            <div
                                id={`knowledge-category-${category.id}`}
                                className="category-admin-content"
                            >
                                <div className="add-item-form">
                                    <h4>Yeni Bilgi Ekle</h4>
                                    <div className="responsive-grid-2">
                                        <input
                                            className="form-control"
                                            placeholder="Soru"
                                            value={newItem.question || ''}
                                            onChange={event => setNewItem({
                                                ...newItem,
                                                category_id: category.id,
                                                question: event.target.value
                                            })}
                                        />
                                        <input
                                            className="form-control"
                                            placeholder="Alt kategori"
                                            value={newItem.sub_category || ''}
                                            onChange={event => setNewItem({
                                                ...newItem,
                                                category_id: category.id,
                                                sub_category: event.target.value
                                            })}
                                        />
                                    </div>
                                    <textarea
                                        placeholder="Cevap"
                                        rows={3}
                                        className="form-control knowledge-answer-input"
                                        value={newItem.answer || ''}
                                        onChange={event => setNewItem({
                                            ...newItem,
                                            category_id: category.id,
                                            answer: event.target.value
                                        })}
                                    />
                                    <div className="knowledge-item-actions">
                                        <label className="knowledge-featured-toggle">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(newItem.is_featured)}
                                                onChange={event => setNewItem({
                                                    ...newItem,
                                                    category_id: category.id,
                                                    is_featured: event.target.checked
                                                })}
                                            />
                                            Öne çıkar
                                        </label>
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            onClick={handleAddItem}
                                            disabled={createItem.isPending}
                                        >
                                            Kaydet
                                        </button>
                                    </div>
                                </div>

                                <div className="items-admin-list">
                                    {itemsQuery.isLoading ? (
                                        <div className="empty-state">İçerikler yükleniyor...</div>
                                    ) : items.map(item => (
                                        <div key={item.id} className="item-admin-row">
                                            <div className="knowledge-item-body">
                                                <div className="knowledge-item-heading">
                                                    {item.is_featured && (
                                                        <Star
                                                            size={14}
                                                            fill="var(--warning)"
                                                            color="var(--warning)"
                                                        />
                                                    )}
                                                    <strong className="knowledge-item-question">{item.question}</strong>
                                                    {item.sub_category && (
                                                        <span className="admin-sub-badge">{item.sub_category}</span>
                                                    )}
                                                </div>
                                                <p className="knowledge-item-answer">
                                                    {item.answer}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                className="btn-icon knowledge-delete-action"
                                                onClick={() => void confirmItemDelete(item.id)}
                                                title="Bilgiyi sil"
                                                aria-label={`${item.question} bilgisini sil`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {!itemsQuery.isLoading && items.length === 0 && (
                                        <div className="empty-state">Bu kategoride içerik bulunmuyor.</div>
                                    )}
                                    <PaginationControls
                                        pagination={itemsQuery.data?.pagination}
                                        onPageChange={setItemPage}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <PaginationControls
                pagination={categoriesQuery.data?.pagination}
                onPageChange={setCategoryPage}
            />
        </div>
    );
};
