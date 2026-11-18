import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Utensils } from 'lucide-react';
import { api } from '../../services/api';
import { queryKeys } from '../../queryClient';
import type { MealMenu, MealMenuRating } from '../../types';
import { MealRatingModal } from './MealRatingModal';

export function HomeMealCard() {
    const queryClient = useQueryClient();
    const [ratingOpen, setRatingOpen] = useState(false);
    const menu = useQuery({
        queryKey: queryKeys.employeeMealMenu,
        queryFn: () => api.get<MealMenu | null>('/api/meal-menu/today'),
    });
    const date = menu.data?.meal_date;
    const ratingKey = [...queryKeys.employeeMealRating, date];
    const rating = useQuery({
        queryKey: ratingKey,
        queryFn: () => api.get<MealMenuRating | null>(`/api/meal-menu/${date}/rating`),
        enabled: Boolean(date && menu.data?.items.length),
    });

    return (
        <section className="home-surface home-meal" aria-labelledby="home-meal-title">
            <h2 id="home-meal-title" className="home-section-title"><Utensils size={20} aria-hidden="true" />Günlük Yemek Menüsü</h2>
            {menu.data?.items.length ? (
                <>
                    <ul className="home-meal-list">{menu.data.items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
                    <button type="button" className="home-outline-button" disabled={rating.isPending || rating.isError} onClick={() => setRatingOpen(true)}>
                        <ClipboardCheck size={17} aria-hidden="true" />
                        {rating.data ? 'Değerlendirmeyi güncelle' : 'Yemeği değerlendir'}
                    </button>
                    {rating.isError && <p className="home-empty">Yemek değerlendirmeniz alınamadı. Lütfen tekrar deneyin.</p>}
                </>
            ) : (
                <p className="home-empty">{menu.isPending ? 'Yemek menüsü yükleniyor…' : menu.isError ? 'Yemek menüsü yüklenemedi.' : 'Bugün için yemek menüsü girilmedi.'}</p>
            )}
            {ratingOpen && menu.data && (
                <MealRatingModal
                    mealMenu={menu.data}
                    existingRating={rating.data ?? null}
                    onClose={() => setRatingOpen(false)}
                    onSaved={saved => {
                        queryClient.setQueryData(ratingKey, saved);
                        setRatingOpen(false);
                    }}
                />
            )}
        </section>
    );
}
