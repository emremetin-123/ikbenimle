import { ModulePageHeader } from '../components/ModulePageHeader';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, ChevronRight, ClipboardList, CheckCircle2, Send } from 'lucide-react';
import { PaginationControls } from '../components/PaginationControls';
import { queryKeys } from '../queryClient';
import { api } from '../services/api';
import type { Survey, SurveyAnswerPayload, SurveyQuestion } from '../types';
import { useAppFeedback } from '../components/AppFeedback';
import { LoadingIndicator } from '../components/LoadingIndicator';

type AnswerState = Record<number, string | string[]>;

export const Surveys = () => {
    const queryClient = useQueryClient();
    const feedback = useAppFeedback();
    const [page, setPage] = useState(1);
    const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
    const [answers, setAnswers] = useState<AnswerState>({});

    const surveysQuery = useQuery({
        queryKey: [...queryKeys.employeeSurveys, page],
        queryFn: () => api.list<Survey>(
            `/api/surveys?page=${page}&pageSize=10&sort=created_at&order=desc`
        ),
        placeholderData: previous => previous
    });
    const surveyDetailQuery = useQuery({
        queryKey: [...queryKeys.employeeSurveyDetail, selectedSurveyId],
        queryFn: () => api.get<Survey>(`/api/surveys/${selectedSurveyId}`),
        enabled: selectedSurveyId !== null
    });
    const submitResponseMutation = useMutation({
        mutationFn: ({ surveyId, payload }: {
            surveyId: number;
            payload: SurveyAnswerPayload[];
        }) => api.post(`/api/surveys/${surveyId}/responses`, { answers: payload }),
        onSuccess: async (_data, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.employeeSurveys }),
                queryClient.invalidateQueries({
                    queryKey: [...queryKeys.employeeSurveyDetail, variables.surveyId]
                })
            ]);
        }
    });
    const surveys = surveysQuery.data?.items || [];
    const selectedSurvey = surveyDetailQuery.data || null;

    const openSurvey = (id: number) => {
        setSelectedSurveyId(id);
        setAnswers({});
    };

    const formatDate = (value?: string | null) => {
        if (!value) return 'Tarih yok';
        return new Intl.DateTimeFormat('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(value));
    };

    const setAnswer = (questionId: number, value: string | string[]) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const toggleMultiple = (questionId: number, option: string) => {
        const current = Array.isArray(answers[questionId]) ? answers[questionId] as string[] : [];
        setAnswer(
            questionId,
            current.includes(option) ? current.filter(item => item !== option) : [...current, option]
        );
    };

    const isQuestionAnswered = (question: SurveyQuestion) => {
        const value = question.id ? answers[question.id] : undefined;
        if (!question.is_required) return true;
        if (Array.isArray(value)) return value.length > 0;
        return Boolean(value);
    };

    const handleSubmit = async () => {
        if (!selectedSurvey || selectedSurvey.has_responded) return;
        const questions = selectedSurvey.questions || [];
        if (!questions.every(isQuestionAnswered)) {
            feedback.notifyInfo('Lütfen zorunlu soruları yanıtlayın.');
            return;
        }

        const payload: SurveyAnswerPayload[] = questions
            .filter(question => question.id)
            .map(question => ({
                question_id: question.id as number,
                value: answers[question.id as number] || '',
            }));

        try {
            await submitResponseMutation.mutateAsync({
                surveyId: selectedSurvey.id,
                payload
            });
            feedback.notifySuccess('Anket yanıtınız kaydedildi.');
        } catch (err) {
            feedback.notifyError(err instanceof Error ? err.message : 'Anket gönderilemedi.');
        }
    };

    const renderQuestion = (question: SurveyQuestion, index: number) => {
        const questionId = question.id as number;
        const value = answers[questionId];
        const disabled = Boolean(selectedSurvey?.has_responded);

        return (
            <div key={questionId || index} className="premium-card survey-question-card">
                <div className="survey-question-header">
                    <h3 className="survey-question-title">{index + 1}. {question.question_text}</h3>
                    {question.is_required && <span className="survey-required-label">Zorunlu</span>}
                </div>

                {question.question_type === 'single_choice' && (
                    <div className="survey-option-list">
                        {question.options.map(option => (
                            <label key={option} className={`survey-option${value === option ? ' is-selected' : ''}`}>
                                <input type="radio" disabled={disabled} checked={value === option} onChange={() => setAnswer(questionId, option)} />
                                <span>{option}</span>
                            </label>
                        ))}
                    </div>
                )}

                {question.question_type === 'multiple_choice' && (
                    <div className="survey-option-list">
                        {question.options.map(option => {
                            const selected = Array.isArray(value) && value.includes(option);
                            return (
                                <label key={option} className={`survey-option${selected ? ' is-selected' : ''}`}>
                                    <input type="checkbox" disabled={disabled} checked={selected} onChange={() => toggleMultiple(questionId, option)} />
                                    <span>{option}</span>
                                </label>
                            );
                        })}
                    </div>
                )}

                {question.question_type === 'text' && (
                    <textarea
                        disabled={disabled}
                        className="form-control"
                        rows={4}
                        value={typeof value === 'string' ? value : ''}
                        onChange={(event) => setAnswer(questionId, event.target.value)}
                        placeholder="Yanıtınızı yazın..."
                    />
                )}

                {question.question_type === 'rating' && (
                    <div className="survey-rating-options">
                        {[1, 2, 3, 4, 5].map(score => (
                            <button
                                key={score}
                                type="button"
                                disabled={disabled}
                                onClick={() => setAnswer(questionId, String(score))}
                                className={`survey-rating-button${value === String(score) ? ' is-selected' : ''}`}
                            >
                                {score}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    if (surveysQuery.isLoading) return <LoadingIndicator label="Anketler yükleniyor" />;

    if (selectedSurveyId !== null) {
        if (surveyDetailQuery.isLoading || !selectedSurvey) {
            return <LoadingIndicator label="Anket yükleniyor" />;
        }
        return (
            <div className="survey-detail-page">
                <button
                    type="button"
                    onClick={() => setSelectedSurveyId(null)}
                    className="btn-secondary survey-back-button"
                >
                    <ArrowLeft size={18} /> Anketlere Dön
                </button>

                <div className="premium-card survey-detail-header-card">
                    <div className="survey-detail-header">
                        <div>
                            <h2 className="survey-title-reset">{selectedSurvey.title}</h2>
                            {selectedSurvey.description && <p className="survey-description">{selectedSurvey.description}</p>}
                        </div>
                        {Boolean(selectedSurvey.has_responded) && (
                            <span className="survey-completed-label">
                                <CheckCircle2 size={18} /> Tamamlandı
                            </span>
                        )}
                    </div>
                </div>

                {(selectedSurvey.questions || []).map(renderQuestion)}

                {!selectedSurvey.has_responded && (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitResponseMutation.isPending}
                        className="btn-primary survey-submit-button"
                    >
                        <Send size={18} /> {submitResponseMutation.isPending ? 'Gönderiliyor...' : 'Yanıtı Gönder'}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="survey-list-page">
            <ModulePageHeader title="Anketler" description="Görüşlerinizi paylaşın, size atanan anketlere katılın." icon={<ClipboardList />} tone="violet" />

            {surveys.length === 0 ? (
                <div className="premium-card survey-empty-state">Aktif anket bulunmuyor.</div>
            ) : (
                <div className="survey-card-list">
                    {surveys.map(survey => {
                        const completed = Boolean(survey.has_responded);
                        return (
                            <button
                                key={survey.id}
                                type="button"
                                onClick={() => openSurvey(survey.id)}
                                className="premium-card survey-list-card"
                            >
                                <div className="survey-list-card-content">
                                    <div className="survey-list-card-title-row">
                                        <strong className="survey-list-card-title">{survey.title}</strong>
                                        <span className={`survey-response-status ${completed ? 'is-completed' : 'is-pending'}`}>
                                            {completed && <CheckCircle2 size={14} />}
                                            {completed ? 'Tamamlandı' : 'Bekliyor'}
                                        </span>
                                    </div>
                                    <div className="survey-list-card-meta">
                                        <span className="survey-meta-item">
                                            <CalendarDays size={15} /> Paylaşım: {formatDate(survey.created_at)}
                                        </span>
                                        <span>{survey.question_count || 0} soru</span>
                                    </div>
                                </div>
                                <ChevronRight size={20} color="var(--text-muted)" />
                            </button>
                        );
                    })}
                </div>
            )}
            <PaginationControls
                pagination={surveysQuery.data?.pagination}
                onPageChange={setPage}
            />
        </div>
    );
};
