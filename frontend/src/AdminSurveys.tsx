import { useState, type CSSProperties, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE } from './config';
import { queryKeys } from './queryClient';
import { api } from './services/api';
import type { Survey, SurveyQuestion, SurveyResults } from './types';
import { AdminSurveysView } from './admin-surveys/AdminSurveysView';
import type { DraftQuestion, SurveyDraft } from './admin-surveys/types';
import { useAppFeedback } from './components/AppFeedback';

const emptyQuestion = (): DraftQuestion => ({
  question_text: '',
  question_type: 'single_choice',
  options: ['Evet', 'Hayır'],
  is_required: true,
  order_index: 0,
});

const resultBarStyle = (percent: number): CSSProperties => ({
  '--survey-result-percent': `${Math.max(0, Math.min(100, percent))}%`,
} as CSSProperties);

export const AdminSurveys = () => {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const [page, setPage] = useState(1);
  const [resultsPage, setResultsPage] = useState(1);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [view, setView] = useState<'list' | 'create'>('list');
  const [form, setForm] = useState<SurveyDraft>({
    title: '',
    description: '',
    status: 'active',
    questions: [emptyQuestion()],
  });

  const surveysQuery = useQuery({
    queryKey: [...queryKeys.adminSurveys, page],
    queryFn: () => api.list<Survey>(
      `/api/admin/surveys?page=${page}&pageSize=10&sort=created_at&order=desc`,
    ),
    placeholderData: previous => previous,
  });
  const resultsQuery = useQuery({
    queryKey: [...queryKeys.adminSurveyResults, selectedSurveyId, resultsPage],
    queryFn: () => api.get<SurveyResults>(
      `/api/admin/surveys/${selectedSurveyId}/results?page=${resultsPage}&pageSize=10&sort=submitted_at&order=desc`,
    ),
    enabled: selectedSurveyId !== null,
  });
  const createMutation = useMutation({
    mutationFn: (payload: SurveyDraft) => api.post('/api/admin/surveys', payload),
    onSuccess: async () => {
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSurveys });
    },
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Survey['status'] }) => (
      api.put(`/api/admin/surveys/${id}/status`, { status })
    ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.adminSurveys }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adminSurveyResults }),
      ]);
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/surveys/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminSurveys });
    },
  });

  const results = resultsQuery.data || null;
  const formatDate = (value?: string | null) => {
    if (!value) return 'Tarih yok';
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  };
  const openResults = (id: number) => {
    setResultsPage(1);
    setSelectedSurveyId(id);
    setView('list');
  };
  const downloadResultsExcel = () => {
    if (!results?.survey.id) return;
    window.open(
      `${API_BASE}/api/admin/surveys/${results.survey.id}/export`,
      '_blank',
    );
  };
  const updateQuestion = (index: number, patch: Partial<DraftQuestion>) => {
    setForm(previous => ({
      ...previous,
      questions: previous.questions.map((question, questionIndex) => (
        questionIndex === index ? { ...question, ...patch } : question
      )),
    }));
  };
  const updateOption = (
    questionIndex: number,
    optionIndex: number,
    value: string,
  ) => {
    setForm(previous => ({
      ...previous,
      questions: previous.questions.map((question, index) => (
        index !== questionIndex ? question : {
          ...question,
          options: question.options.map((option, currentIndex) => (
            currentIndex === optionIndex ? value : option
          )),
        }
      )),
    }));
  };
  const addOption = (questionIndex: number) => {
    setForm(previous => ({
      ...previous,
      questions: previous.questions.map((question, index) => (
        index === questionIndex
          ? { ...question, options: [...question.options, ''] }
          : question
      )),
    }));
  };
  const addQuestion = () => {
    setForm(previous => ({
      ...previous,
      questions: [
        ...previous.questions,
        { ...emptyQuestion(), order_index: previous.questions.length },
      ],
    }));
  };
  const removeQuestion = (index: number) => {
    setForm(previous => ({
      ...previous,
      questions: previous.questions.length === 1
        ? previous.questions
        : previous.questions.filter((_, questionIndex) => questionIndex !== index),
    }));
  };
  const saveSurvey = async (event: FormEvent) => {
    event.preventDefault();
    const questions = form.questions
      .map((question, index) => ({
        ...question,
        order_index: index,
        options: ['single_choice', 'multiple_choice'].includes(question.question_type)
          ? question.options.map(option => option.trim()).filter(Boolean)
          : [],
      }))
      .filter(question => question.question_text.trim());
    if (!form.title.trim() || questions.length === 0) {
      feedback.notifyInfo('Anket başlığı ve en az bir soru gereklidir.');
      return;
    }
    try {
      await createMutation.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim(),
        status: form.status,
        questions,
      });
      setForm({
        title: '',
        description: '',
        status: 'active',
        questions: [emptyQuestion()],
      });
      setView('list');
    } catch (error) {
      feedback.notifyError(error instanceof Error ? error.message : 'Anket kaydedilemedi.');
    }
  };
  const updateStatus = (survey: Survey, status: Survey['status']) => (
    statusMutation.mutateAsync({ id: survey.id, status })
  );
  const deleteSurvey = async (survey: Survey) => {
    if (!await feedback.confirm({
      title: 'Anketi sil',
      message: `"${survey.title}" anketi ve tüm yanıtları kalıcı olarak silinecek.`,
      confirmLabel: 'Anketi Sil',
      danger: true,
    })) {
      return;
    }
    await deleteMutation.mutateAsync(survey.id);
    setSelectedSurveyId(null);
  };
  const responseCount = typeof results?.response_count === 'number'
    ? results.response_count
    : results?.response_count?.count || 0;
  const renderResult = (question: SurveyQuestion) => {
    const answers = results?.answers.filter(answer => (
      Number(answer.question_id) === Number(question.id)
    )) || [];
    if (question.question_type === 'text') {
      return (
        <div className="survey-text-answers">
          {answers.length === 0 ? (
            <p className="survey-muted-text">Henüz yanıt yok.</p>
          ) : answers.slice(0, 8).map((answer, index) => (
            <div key={`${question.id}-${index}`} className="survey-text-answer">
              <p className="survey-answer-content">
                {String(answer.answer_value || '-')}
              </p>
              <span className="survey-answer-author">
                {answer.name || 'Anonim'}
              </span>
            </div>
          ))}
        </div>
      );
    }
    const counts = new Map<string, number>();
    const options = question.question_type === 'rating'
      ? ['1', '2', '3', '4', '5']
      : question.options;
    options.forEach(option => counts.set(option, 0));
    const summary = question.id
      ? results?.answer_summary?.[String(question.id)]
      : undefined;
    Object.entries(summary?.counts || {}).forEach(([option, count]) => {
      counts.set(option, count);
    });
    const total = Math.max(summary?.total || 0, 1);
    return (
      <div className="survey-result-bars">
        {Array.from(counts.entries()).map(([option, count]) => {
          const percent = Math.round((count / total) * 100);
          return (
            <div key={option}>
              <div className="survey-result-bar-label">
                <strong>{option || 'Boş'}</strong>
                <span className="survey-muted-text">{count} yanıt · %{percent}</span>
              </div>
              <div className="survey-result-bar-track">
                <div className="survey-result-bar-fill" style={resultBarStyle(percent)} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AdminSurveysView
      view={view}
      selectedSurveyId={selectedSurveyId}
      surveys={surveysQuery.data?.items || []}
      surveysLoading={surveysQuery.isLoading}
      surveysPage={surveysQuery.data?.pagination}
      results={results}
      resultsLoading={resultsQuery.isLoading}
      form={form}
      creating={createMutation.isPending}
      formatDate={formatDate}
      responseCount={responseCount}
      onOpenCreate={() => {
        setSelectedSurveyId(null);
        setView('create');
      }}
      onCloseCreate={() => setView('list')}
      onCloseResults={() => setSelectedSurveyId(null)}
      onOpenResults={openResults}
      onDelete={deleteSurvey}
      onStatusChange={updateStatus}
      onSurveyPageChange={setPage}
      onResultsPageChange={setResultsPage}
      onFormChange={patch => setForm(previous => ({ ...previous, ...patch }))}
      onQuestionChange={updateQuestion}
      onOptionChange={updateOption}
      onAddOption={addOption}
      onAddQuestion={addQuestion}
      onRemoveQuestion={removeQuestion}
      onSave={saveSurvey}
      onDownload={downloadResultsExcel}
      renderResult={renderResult}
    />
  );
};
