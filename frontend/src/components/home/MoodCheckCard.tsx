import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Frown, Laugh, Meh, Moon, Smile, type LucideIcon } from 'lucide-react';
import { api } from '../../services/api';

type MoodId = 'great' | 'good' | 'okay' | 'tired' | 'sad';
type MoodReasonId = 'workload' | 'personal' | 'health' | 'work_environment'
    | 'manager_communication' | 'transportation' | 'cafeteria' | 'other';

type TodayStatus = {
    submitted: boolean;
    callback_requested: boolean;
};

const moodOptions: { id: MoodId; icon: LucideIcon; label: string }[] = [
    { id: 'great', icon: Laugh, label: 'Çok iyi' },
    { id: 'good', icon: Smile, label: 'İyi' },
    { id: 'okay', icon: Meh, label: 'Normal' },
    { id: 'tired', icon: Moon, label: 'Yorgun' },
    { id: 'sad', icon: Frown, label: 'Üzgün' },
];

const moodReasonOptions: { id: MoodReasonId; label: string }[] = [
    { id: 'workload', label: 'İş yükü' },
    { id: 'personal', label: 'Kişisel sebepler' },
    { id: 'health', label: 'Sağlık' },
    { id: 'work_environment', label: 'İş ortamı' },
    { id: 'manager_communication', label: 'Yönetici / iletişim' },
    { id: 'transportation', label: 'Servis / ulaşım' },
    { id: 'cafeteria', label: 'Yemekhane' },
    { id: 'other', label: 'Diğer' },
];

const lowMoodIds: MoodId[] = ['tired', 'sad'];
const todayStatusKey = ['mood-check', 'today'] as const;

export const MoodCheckCard = () => {
    const queryClient = useQueryClient();
    const [selectedMood, setSelectedMood] = useState<MoodId | null>(null);
    const [selectedReason, setSelectedReason] = useState<MoodReasonId | null>(null);
    const [showReasonQuestion, setShowReasonQuestion] = useState(false);
    const [showCallbackQuestion, setShowCallbackQuestion] = useState(false);
    const [submittedLocally, setSubmittedLocally] = useState(false);
    const [requestSent, setRequestSent] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');

    const todayStatus = useQuery({
        queryKey: todayStatusKey,
        queryFn: () => api.get<TodayStatus>('/api/mood-check/today'),
        staleTime: 60_000,
    });

    const submitted = submittedLocally || Boolean(todayStatus.data?.submitted);
    const callbackRequested = requestSent || Boolean(todayStatus.data?.callback_requested);

    const submitMood = async (mood: MoodId, reason: MoodReasonId | null = null) => {
        setIsSending(true);
        setError('');
        try {
            await api.post('/api/mood-check', {
                mood_id: mood,
                reason_key: reason,
            });
            setSubmittedLocally(true);
            setShowReasonQuestion(false);
            setShowCallbackQuestion(mood === 'sad');
            await queryClient.invalidateQueries({ queryKey: todayStatusKey });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Duygu durumu kaydedilemedi.');
        } finally {
            setIsSending(false);
        }
    };

    const selectMood = (mood: MoodId) => {
        if (submitted || isSending) return;
        setSelectedMood(mood);
        setSelectedReason(null);
        setError('');
        if (lowMoodIds.includes(mood)) {
            setShowReasonQuestion(true);
            return;
        }
        void submitMood(mood);
    };

    const selectReason = (reason: MoodReasonId) => {
        if (!selectedMood || isSending) return;
        setSelectedReason(reason);
        void submitMood(selectedMood, reason);
    };

    const submitWithoutReason = () => {
        if (!selectedMood || isSending) return;
        void submitMood(selectedMood);
    };

    const requestCallback = async () => {
        setIsSending(true);
        setError('');
        try {
            await api.post('/api/mood-check/callback-request', {});
            setRequestSent(true);
            setShowCallbackQuestion(false);
            await queryClient.invalidateQueries({ queryKey: todayStatusKey });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Talep gönderilemedi.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <section className="home-surface mood-check-card" aria-labelledby="home-mood-title">
            <div className="mood-check-copy">
                <h2 id="home-mood-title" className="home-section-title">Bugün kendini nasıl hissediyorsun?</h2>
                <p>Bir seçim yap, günün nasıl geçtiğini paylaş.</p>
            </div>

            <div className="mood-options" role="group" aria-label="Duygu seçimi">
                {moodOptions.map((mood) => (
                    <button
                        key={mood.id}
                        type="button"
                        className={`mood-option ${selectedMood === mood.id ? 'selected' : ''}`}
                        onClick={() => selectMood(mood.id)}
                        aria-label={mood.label}
                        aria-pressed={selectedMood === mood.id}
                        disabled={submitted || isSending || todayStatus.isLoading}
                    >
                        <mood.icon size={26} aria-hidden="true" />
                        <span>{mood.label}</span>
                    </button>
                ))}
            </div>

            {showReasonQuestion && selectedMood && !submitted && (
                <div className="mood-reason-panel">
                    <span>İstersen sebebini de işaretleyebilirsin.</span>
                    <div className="mood-reason-options" role="group" aria-label="Duygu sebebi">
                        {moodReasonOptions.map((reason) => (
                            <button
                                key={reason.id}
                                type="button"
                                className={selectedReason === reason.id ? 'selected' : ''}
                                onClick={() => selectReason(reason.id)}
                                disabled={isSending}
                            >
                                {reason.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="secondary"
                        onClick={submitWithoutReason}
                        disabled={isSending}
                    >
                        Sebep belirtmeden gönder
                    </button>
                </div>
            )}

            {submitted && (
                <p className="mood-message" role="status">Bildirimin için teşekkür ederiz.</p>
            )}

            {showCallbackQuestion && !callbackRequested && (
                <div className="mood-followup">
                    <span>Seni aramamızı ister misin?</span>
                    <p>Bu talep yalnız iletişim için, duygu yanıtından ayrı kaydedilir.</p>
                    <div className="mood-followup-actions">
                        <button type="button" onClick={requestCallback} disabled={isSending}>
                            {isSending ? 'Gönderiliyor...' : 'Evet, aransın'}
                        </button>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => setShowCallbackQuestion(false)}
                        >
                            Hayır
                        </button>
                    </div>
                </div>
            )}

            {callbackRequested && (
                <p className="mood-message success">Geri aranma talebin İK ekibine iletildi.</p>
            )}
            {error && <p className="mood-message error">{error}</p>}
        </section>
    );
};
