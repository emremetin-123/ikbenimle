import { useState } from 'react';
import { Star, X } from 'lucide-react';
import { api } from '../../services/api';
import type { MealMenu, MealMenuRating } from '../../types';
import { ModalShell } from '../ModalShell';

type MealRatingDraft = {
    food_score: number;
    staff_score: number;
    cleanliness_score: number;
    comment: string;
};

const RatingPicker = ({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) => (
    <div className="meal-rating-row">
        <span>{label}</span>
        <div className="meal-rating-stars" role="radiogroup" aria-label={label}>
            {[1, 2, 3, 4, 5].map(score => (
                <button
                    key={score}
                    type="button"
                    className={`meal-rating-star ${score <= value ? 'active' : ''}`}
                    onClick={() => onChange(score)}
                    aria-label={`${score} puan`}
                    aria-checked={value === score}
                    role="radio"
                >
                    <Star size={18} fill="currentColor" />
                    <span>{score}</span>
                </button>
            ))}
        </div>
    </div>
);

export const MealRatingModal = ({
    mealMenu,
    existingRating,
    onClose,
    onSaved
}: {
    mealMenu: MealMenu;
    existingRating: MealMenuRating | null;
    onClose: () => void;
    onSaved: (rating: MealMenuRating) => void;
}) => {
    const [draft, setDraft] = useState<MealRatingDraft>({
        food_score: existingRating?.food_score || 0,
        staff_score: existingRating?.staff_score || 0,
        cleanliness_score: existingRating?.cleanliness_score || 0,
        comment: existingRating?.comment || ''
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const setScore = (key: keyof Omit<MealRatingDraft, 'comment'>, value: number) => {
        setDraft(current => ({ ...current, [key]: value }));
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!draft.food_score || !draft.staff_score || !draft.cleanliness_score) {
            setMessage('Lütfen tüm alanlara 1 ile 5 arasında puan verin.');
            return;
        }

        setSaving(true);
        setMessage('');
        try {
            const result = await api.post<{ success: boolean; rating: MealMenuRating }>(`/api/meal-menu/${mealMenu.meal_date}/rating`, draft);
            onSaved(result.rating);
        } catch (err) {
            setMessage(err instanceof Error ? err.message : 'Değerlendirme kaydedilemedi');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell onClose={onClose} labelledBy="meal-rating-title" overlayClassName="home-modal-backdrop" className="meal-rating-modal">
            <form className="meal-rating-form" onSubmit={submit}>
                <div className="meal-rating-modal-header">
                    <div>
                        <h3 id="meal-rating-title">Yemek Değerlendirme</h3>
                        <p>{new Date(mealMenu.meal_date).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <button type="button" className="btn-icon" onClick={onClose} aria-label="Kapat">
                        <X size={18} />
                    </button>
                </div>

                <div className="meal-rating-menu-preview">
                    {mealMenu.items.map((item, index) => (
                        <span key={`${item}-${index}`}>{item}</span>
                    ))}
                </div>

                <RatingPicker label="Yemeklerin lezzeti ve kalitesi" value={draft.food_score} onChange={value => setScore('food_score', value)} />
                <RatingPicker label="Çalışanların tutumu" value={draft.staff_score} onChange={value => setScore('staff_score', value)} />
                <RatingPicker label="Servis alanı temizliği" value={draft.cleanliness_score} onChange={value => setScore('cleanliness_score', value)} />

                <div className="input-group meal-rating-comment">
                    <label className="input-label" htmlFor="home-meal-rating-comment">Ek açıklama</label>
                    <textarea
                        id="home-meal-rating-comment"
                        className="form-control"
                        rows={4}
                        value={draft.comment}
                        onChange={event => setDraft(current => ({ ...current, comment: event.target.value }))}
                        placeholder="Paylaşmak istediğiniz bir not varsa yazabilirsiniz"
                        maxLength={1000}
                    />
                </div>

                {message && <p className="mood-message error">{message}</p>}

                <div className="meal-rating-actions">
                    <button type="button" className="btn-cancel" onClick={onClose}>Vazgeç</button>
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? 'Kaydediliyor...' : existingRating ? 'Güncelle' : 'Gönder'}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
};
