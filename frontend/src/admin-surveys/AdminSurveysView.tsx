import { ModulePageHeader } from '../components/ModulePageHeader';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowLeft, BarChart3, CalendarDays, ChevronRight, ClipboardList,
  Plus, Save, Trash2, X,
} from 'lucide-react';
import { ExportExcelButton } from '../components/ExportExcelButton';
import { PaginationControls } from '../components/PaginationControls';
import { ModalShell } from '../components/ModalShell';
import type { PaginatedResponse, Survey, SurveyQuestion, SurveyResults } from '../types';
import type { DraftQuestion, SurveyDraft } from './types';

type Props = {
  view: 'list' | 'create';
  selectedSurveyId: number | null;
  surveys: Survey[];
  surveysLoading: boolean;
  surveysPage?: PaginatedResponse<Survey>['pagination'];
  results: SurveyResults | null;
  resultsLoading: boolean;
  form: SurveyDraft;
  creating: boolean;
  formatDate: (value?: string | null) => string;
  responseCount: number;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
  onCloseResults: () => void;
  onOpenResults: (id: number) => void;
  onDelete: (survey: Survey) => void;
  onStatusChange: (survey: Survey, status: Survey['status']) => void;
  onSurveyPageChange: (page: number) => void;
  onResultsPageChange: (page: number) => void;
  onFormChange: (patch: Partial<Omit<SurveyDraft, 'questions'>>) => void;
  onQuestionChange: (index: number, patch: Partial<DraftQuestion>) => void;
  onOptionChange: (questionIndex: number, optionIndex: number, value: string) => void;
  onAddOption: (questionIndex: number) => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (index: number) => void;
  onSave: (event: FormEvent) => void;
  onDownload: () => void;
  renderResult: (question: SurveyQuestion) => ReactNode;
};

const labels: Record<Survey['status'], string> = {
  draft: 'Taslak',
  active: 'Yayında',
  closed: 'Kapalı',
};
const statusClass = (status: Survey['status']) => (
  `survey-status-pill survey-status-${status}`
);

export const AdminSurveysView = ({
  view, selectedSurveyId, surveys, surveysLoading, surveysPage,
  results, resultsLoading, form, creating, formatDate, responseCount,
  onOpenCreate, onCloseCreate, onCloseResults, onOpenResults, onDelete, onStatusChange,
  onSurveyPageChange, onResultsPageChange, onFormChange, onQuestionChange,
  onOptionChange, onAddOption, onAddQuestion, onRemoveQuestion, onSave,
  onDownload, renderResult,
}: Props) => (
  <div className="admin-surveys-page">
    {view === 'list' && selectedSurveyId === null && (
      <>
      <ModulePageHeader title="Anketler" description="Anket oluşturun, yayın durumlarını yönetin ve katılım sonuçlarını inceleyin." icon={<BarChart3 />} tone="violet" actions={<button type="button" className="btn-primary" onClick={onOpenCreate}><Plus size={18} /> Yeni Anket</button>} />
      <section className="premium-card admin-survey-panel">
        {surveysLoading ? (
          <p className="survey-muted-text">Yükleniyor...</p>
        ) : surveys.length === 0 ? (
          <div className="admin-survey-empty-state">
            Henüz anket oluşturulmadı.
          </div>
        ) : (
          <div className="admin-survey-list">
            {surveys.map(survey => (
              <div key={survey.id} className="admin-survey-row">
                <button type="button" onClick={() => onOpenResults(survey.id)} className="admin-survey-summary">
                  <strong className="admin-survey-title">{survey.title}</strong>
                  <span className="admin-survey-meta">
                    <ClipboardList size={15} /> {survey.question_count || 0} soru
                    <BarChart3 size={15} /> {survey.response_count || 0} yanıt
                    <CalendarDays size={15} /> {formatDate(survey.created_at)}
                    <span className={statusClass(survey.status)}>{labels[survey.status]}</span>
                  </span>
                </button>
                <div className="admin-survey-actions">
                  <select className={`form-control survey-status-select survey-status-select-${survey.status}`} value={survey.status} onChange={event => onStatusChange(survey, event.target.value as Survey['status'])}>
                    <option value="draft">Taslak</option>
                    <option value="active">Yayında</option>
                    <option value="closed">Kapalı</option>
                  </select>
                  <button type="button" className="btn-icon survey-delete-button" onClick={() => onDelete(survey)} title="Sil">
                    <Trash2 size={17} />
                  </button>
                  <button type="button" className="btn-icon" onClick={() => onOpenResults(survey.id)} title="Detayları aç">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <PaginationControls pagination={surveysPage} onPageChange={onSurveyPageChange} />
      </section>
      </>
    )}

    {view === 'create' && (
      <ModalShell onClose={onCloseCreate} labelledBy="admin-survey-create-title" className="admin-action-modal">
          <div className="admin-modal-header">
            <h2 id="admin-survey-create-title" className="admin-survey-heading">
              <ClipboardList size={24} color="var(--primary)" /> Yeni Anket
            </h2>
            <button type="button" className="admin-modal-close" onClick={onCloseCreate} title="Kapat">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={onSave} className="admin-survey-form">
            <div>
              <label className="input-label" htmlFor="admin-survey-title">Anket Başlığı</label>
              <input id="admin-survey-title" className="form-control" value={form.title} onChange={event => onFormChange({ title: event.target.value })} required />
            </div>
            <div>
              <label className="input-label" htmlFor="admin-survey-description">Açıklama</label>
              <textarea id="admin-survey-description" className="form-control" rows={3} value={form.description} onChange={event => onFormChange({ description: event.target.value })} />
            </div>
            <div>
              <label className="input-label" htmlFor="admin-survey-status">Durum</label>
              <select id="admin-survey-status" className={`form-control survey-status-select survey-status-select-${form.status}`} value={form.status} onChange={event => onFormChange({ status: event.target.value as Survey['status'] })}>
                <option value="active">Yayında</option>
                <option value="draft">Taslak</option>
                <option value="closed">Kapalı</option>
              </select>
            </div>
            {form.questions.map((question, index) => (
              <div key={index} className="admin-survey-question-editor">
                <div className="admin-survey-question-header">
                  <strong>Soru {index + 1}</strong>
                  <button type="button" className="btn-icon survey-delete-button" onClick={() => onRemoveQuestion(index)} title="Soruyu sil">
                    <Trash2 size={16} />
                  </button>
                </div>
                <input className="form-control" placeholder="Soru metni" value={question.question_text} onChange={event => onQuestionChange(index, { question_text: event.target.value })} />
                <div className="responsive-grid-2">
                  <select className="form-control" value={question.question_type} onChange={event => onQuestionChange(index, { question_type: event.target.value as DraftQuestion['question_type'] })}>
                    <option value="single_choice">Tek seçim</option>
                    <option value="multiple_choice">Çoklu seçim</option>
                    <option value="text">Kısa/uzun metin</option>
                    <option value="rating">1-5 puanlama</option>
                  </select>
                  <label className="admin-survey-required-option">
                    <input type="checkbox" checked={Boolean(question.is_required)} onChange={event => onQuestionChange(index, { is_required: event.target.checked })} />
                    Zorunlu
                  </label>
                </div>
                {['single_choice', 'multiple_choice'].includes(question.question_type) && (
                  <div className="admin-survey-option-editor">
                    {question.options.map((option, optionIndex) => (
                      <input key={optionIndex} className="form-control" placeholder={`Seçenek ${optionIndex + 1}`} value={option} onChange={event => onOptionChange(index, optionIndex, event.target.value)} />
                    ))}
                    <button type="button" className="btn-icon admin-survey-add-option" onClick={() => onAddOption(index)}>
                      <Plus size={16} /> Seçenek Ekle
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" className="btn-icon admin-survey-add-question" onClick={onAddQuestion}>
              <Plus size={17} /> Soru Ekle
            </button>
            <div className="admin-modal-actions">
              <button type="button" className="btn-cancel admin-survey-cancel" onClick={onCloseCreate}>İptal</button>
              <button type="submit" className="btn-primary admin-survey-save" disabled={creating}>
                <Save size={18} /> {creating ? 'Kaydediliyor...' : 'Anketi Kaydet'}
              </button>
            </div>
          </form>
      </ModalShell>
    )}

    {selectedSurveyId !== null && resultsLoading && (
      <div className="loading-container">Anket sonuçları yükleniyor...</div>
    )}
    {results && (
      <section className="premium-card admin-survey-results">
        <button type="button" className="btn-icon admin-survey-back-button" onClick={onCloseResults}>
          <ArrowLeft size={18} /> Anketlere Dön
        </button>
        <div className="admin-survey-results-header">
          <div>
            <h2 className="survey-title-reset">{results.survey.title}</h2>
            <p className="admin-survey-description">{responseCount} toplam yanıt</p>
          </div>
          <div className="admin-survey-results-actions">
            <ExportExcelButton onClick={onDownload} disabled={!responseCount} />
            <select className={`form-control survey-status-select survey-status-select-${results.survey.status}`} value={results.survey.status} onChange={event => onStatusChange(results.survey, event.target.value as Survey['status'])}>
              <option value="draft">Taslak</option>
              <option value="active">Yayında</option>
              <option value="closed">Kapalı</option>
            </select>
          </div>
        </div>
        <div className="admin-survey-results-list">
          {results.questions.map((question, index) => (
            <div key={question.id || index} className="admin-survey-result-card">
              <h4 className="admin-survey-result-title">{index + 1}. {question.question_text}</h4>
              {renderResult(question)}
            </div>
          ))}
        </div>
        <PaginationControls pagination={results.pagination} onPageChange={onResultsPageChange} />
      </section>
    )}
  </div>
);
