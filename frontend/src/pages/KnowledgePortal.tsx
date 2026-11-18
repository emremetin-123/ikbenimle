import { ModulePageHeader } from '../components/ModulePageHeader';
import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Search, Star, X } from 'lucide-react';
import { api } from '../services/api';
import { queryKeys } from '../queryClient';
import { PaginationControls } from '../components/PaginationControls';
import { ModalShell } from '../components/ModalShell';
import { LoadingIndicator } from '../components/LoadingIndicator';
import type {
    KnowledgeCategory,
    KnowledgeItem,
    PaginatedResponse
} from '../types';

type KnowledgeItemsResponse = PaginatedResponse<KnowledgeItem> & {
    category: KnowledgeCategory;
    sub_categories: string[];
};

export const KnowledgePortal = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryPage, setCategoryPage] = useState(1);
    const [itemPage, setItemPage] = useState(1);
    const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | null>(null);
    const [activeTab, setActiveTab] = useState('Tümü');
    const deferredSearch = useDeferredValue(searchQuery.trim());

    const categoriesQuery = useQuery({
        queryKey: [...queryKeys.employeeKnowledgeCategories, categoryPage, deferredSearch],
        queryFn: () => {
            const params = new URLSearchParams({
                page: String(categoryPage),
                pageSize: '12',
                sort: 'order_index',
                order: 'asc'
            });
            if (deferredSearch) params.set('search', deferredSearch);
            return api.list<KnowledgeCategory>(
                `/api/knowledge/categories?${params.toString()}`
            );
        }
    });

    const itemsQuery = useQuery({
        queryKey: [
            ...queryKeys.employeeKnowledgeItems,
            selectedCategory?.id,
            itemPage,
            deferredSearch,
            activeTab
        ],
        queryFn: () => {
            const params = new URLSearchParams({
                page: String(itemPage),
                pageSize: '20',
                sort: 'order_index',
                order: 'asc'
            });
            if (deferredSearch) params.set('search', deferredSearch);
            if (activeTab !== 'Tümü') params.set('subCategory', activeTab);
            return api.get<KnowledgeItemsResponse>(
                `/api/knowledge/categories/${selectedCategory?.id}/items?${params.toString()}`
            );
        },
        enabled: selectedCategory !== null
    });

    const categories = categoriesQuery.data?.items || [];
    const items = itemsQuery.data?.items || [];
    const openCategory = (category: KnowledgeCategory) => {
        setSelectedCategory(category);
        setActiveTab('Tümü');
        setItemPage(1);
    };

    return (
        <div className="knowledge-portal-container">
            <ModulePageHeader title="Bilgi Portalı" description="İhtiyacınız olan bilgilere ve sık sorulan soruların yanıtlarına ulaşın." icon={<BookOpen />} tone="violet" />
            <div className="knowledge-portal-toolbar">
                <div className="search-wrapper">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Kategori, soru veya cevap ara..."
                        value={searchQuery}
                        onChange={event => {
                            setSearchQuery(event.target.value);
                            setCategoryPage(1);
                            setItemPage(1);
                        }}
                    />
                </div>
            </div>

            {deferredSearch && (
                <div className="knowledge-search-summary">
                    <strong>{categoriesQuery.data?.pagination.total || 0}</strong> kategori bulundu
                </div>
            )}

            {categoriesQuery.isLoading ? (
                <LoadingIndicator compact label="Bilgi portalı yükleniyor" />
            ) : (
                <div className="category-grid">
                    {categories.map(category => (
                        <button
                            type="button"
                            key={category.id}
                            className={`category-card ${deferredSearch ? 'search-result-card' : ''}`}
                            onClick={() => openCategory(category)}
                        >
                            <div className="category-card-body">
                                <span>{category.name}</span>
                                <div className="category-match-meta">
                                    <div className="category-match-badges">
                                        <span className="category-match-badge">
                                            {category.item_count || 0} içerik
                                        </span>
                                        {deferredSearch && Number(category.matched_item_count || 0) > 0 && (
                                            <span className="category-match-badge">
                                                {category.matched_item_count} içerik eşleşmesi
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            <PaginationControls
                pagination={categoriesQuery.data?.pagination}
                onPageChange={setCategoryPage}
            />

            {!categoriesQuery.isLoading && categories.length === 0 && (
                <div className="knowledge-empty-search">
                    <strong>Sonuç bulunamadı</strong>
                    <p>Arama kategori, alt başlık, soru ve cevap alanlarında yapılır.</p>
                </div>
            )}

            {selectedCategory && (
                <ModalShell
                    onClose={() => setSelectedCategory(null)}
                    ariaLabel={`${selectedCategory.name} içerikleri`}
                    overlayClassName="knowledge-modal-overlay"
                    surfaceClassName="knowledge-dialog"
                >
                        <div className="knowledge-dialog-header">
                            <h2 className="knowledge-dialog-title">{selectedCategory.name}</h2>
                            <button
                                type="button"
                                className="knowledge-dialog-close"
                                onClick={() => setSelectedCategory(null)}
                                aria-label="Kapat"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {(itemsQuery.data?.sub_categories.length || 0) > 0 && (
                            <div className="knowledge-dialog-filters" role="group" aria-label="İçerik filtreleri" tabIndex={0}>
                                {['Tümü', ...(itemsQuery.data?.sub_categories || [])].map(tab => (
                                    <button
                                        type="button"
                                        key={tab}
                                        className={`knowledge-filter-button ${activeTab === tab ? 'active' : ''}`}
                                        aria-pressed={activeTab === tab}
                                        onClick={() => {
                                            setActiveTab(tab);
                                            setItemPage(1);
                                        }}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="knowledge-dialog-body" role="region" aria-label="Kategori içerikleri" tabIndex={0}>
                            <div className="knowledge-dialog-items">
                                {itemsQuery.isLoading ? (
                                    <div className="empty-state">İçerikler yükleniyor...</div>
                                ) : items.map(item => (
                                    <div key={item.id} className="knowledge-item">
                                        <div className="item-meta">
                                            {item.sub_category && (
                                                <span className="item-sub-category">{item.sub_category}</span>
                                            )}
                                        </div>
                                        <div className="item-question">
                                            {item.is_featured && (
                                                <Star
                                                    size={16}
                                                    fill="var(--warning)"
                                                    color="var(--warning)"
                                                    className="star-icon"
                                                />
                                            )}
                                            <span>{item.question}</span>
                                        </div>
                                        <div className="item-answer">{item.answer}</div>
                                    </div>
                                ))}
                                {!itemsQuery.isLoading && items.length === 0 && (
                                    <div className="empty-state">
                                        Bu kategoride eşleşen bilgi bulunamadı.
                                    </div>
                                )}
                            </div>
                            <PaginationControls
                                pagination={itemsQuery.data?.pagination}
                                onPageChange={setItemPage}
                            />
                        </div>

                        <div className="knowledge-dialog-footer">
                            <button
                                type="button"
                                className="btn-primary knowledge-dialog-dismiss"
                                onClick={() => setSelectedCategory(null)}
                            >
                                KAPAT
                            </button>
                        </div>
                </ModalShell>
            )}
        </div>
    );
};
