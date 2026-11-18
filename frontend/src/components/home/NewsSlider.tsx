import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Megaphone, X } from 'lucide-react';
import { getPhotoUrl } from '../../config';
import type { CompanyNews } from '../../types';
import { ModalShell } from '../ModalShell';

type NewsSliderProps = { news: CompanyNews[]; loading?: boolean; error?: boolean };

export const NewsSlider = ({ news, loading = false, error = false }: NewsSliderProps) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [pagination, setPagination] = useState({ index: 0, count: 1 });
    const [selectedNews, setSelectedNews] = useState<CompanyNews | null>(null);
    const hasPages = news.length > 1 && pagination.count > 1;
    const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('tr-TR') : '';

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        const syncPagination = () => {
            const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
            const stride = track.clientWidth + gap;
            const cardWidth = track.firstElementChild?.getBoundingClientRect().width ?? stride;
            const cardsPerPage = Math.max(1, Math.round(stride / Math.max(1, cardWidth + gap)));
            const count = Math.max(1, Math.ceil(track.childElementCount / cardsPerPage));
            const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
            const index = atEnd ? count - 1 : Math.min(count - 1, Math.round(track.scrollLeft / Math.max(1, stride)));
            setPagination(current => current.index === index && current.count === count ? current : { index, count });
        };
        const observer = new ResizeObserver(syncPagination);
        observer.observe(track);
        track.addEventListener('scroll', syncPagination, { passive: true });
        return () => {
            observer.disconnect();
            track.removeEventListener('scroll', syncPagination);
        };
    }, [news.length]);

    const goToPage = (index: number) => {
        const track = trackRef.current;
        if (!track) return;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        track.scrollTo({
            left: index * (track.clientWidth + gap),
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        });
    };

    return (
        <section className="home-surface home-news" aria-labelledby="home-news-title">
            <div className="home-section-header">
                <h2 id="home-news-title" className="home-section-title">Şirket Haberleri</h2>
                {hasPages && (
                    <div className="home-news-controls">
                        <button type="button" className="home-icon-button" aria-label="Önceki haberler" disabled={pagination.index === 0} onClick={() => goToPage(pagination.index - 1)}>
                            <ChevronLeft size={18} aria-hidden="true" />
                        </button>
                        <button type="button" className="home-icon-button" aria-label="Sonraki haberler" disabled={pagination.index === pagination.count - 1} onClick={() => goToPage(pagination.index + 1)}>
                            <ChevronRight size={18} aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
            {news.length ? (
                <>
                    <div ref={trackRef} className="home-news-track">
                        {news.map(item => (
                            <button key={item.id} type="button" className="home-news-card" onClick={() => setSelectedNews(item)} aria-label={item.title + ' haberini aç'}>
                                {item.image_url ? (
                                    <img src={getPhotoUrl(item.image_url)} alt="" className="home-news-image" loading="lazy" decoding="async" />
                                ) : (
                                    <span className="home-news-placeholder"><Megaphone size={44} aria-hidden="true" /></span>
                                )}
                                <span className="home-news-caption">
                                    <span className="home-news-date">{formatDate(item.created_at)}</span>
                                    <span className="home-news-title">{item.title}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                    {hasPages && (
                        <div className="home-news-dots" role="group" aria-label="Haber sayfaları">
                            {Array.from({ length: pagination.count }, (_, index) => (
                                <button key={index} type="button" className="home-news-dot" aria-label={(index + 1) + '. haber sayfası'} aria-pressed={index === pagination.index} onClick={() => goToPage(index)}>
                                    <span />
                                </button>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <p className="home-empty">{loading ? 'Haberler yükleniyor…' : error ? 'Haberler yüklenemedi.' : 'Henüz şirket haberi bulunmuyor.'}</p>
            )}
            {selectedNews && (
                <ModalShell onClose={() => setSelectedNews(null)} labelledBy="home-news-detail-title" overlayClassName="home-modal-backdrop" surfaceClassName="home-news-modal">
                    <button type="button" className="home-news-close" onClick={() => setSelectedNews(null)} aria-label="Haberi kapat"><X size={22} /></button>
                    {selectedNews.image_url && <img src={getPhotoUrl(selectedNews.image_url)} alt="" className="home-news-cover" />}
                    <div className="home-news-detail">
                        <span className="home-news-detail-date">{formatDate(selectedNews.created_at)}</span>
                        <h2 id="home-news-detail-title">{selectedNews.title}</h2>
                        <p>{selectedNews.content}</p>
                    </div>
                </ModalShell>
            )}
        </section>
    );
};
