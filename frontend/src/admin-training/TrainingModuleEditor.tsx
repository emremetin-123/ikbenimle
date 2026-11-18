import { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { QuizQuestion } from '../types';
import { createEmptyLesson, type TrainingModuleDraft } from './trainingConfig';
import { TrainingLessonEditor } from './TrainingLessonEditor';
import { TrainingQuestionEditor } from './TrainingQuestionEditor';

type Props = {
  module: TrainingModuleDraft;
  index: number;
  removable: boolean;
  quizRequired: boolean;
  requiresFullWatch: boolean;
  onChange: (value: TrainingModuleDraft) => void;
  onRemove: () => void;
};

export function TrainingModuleEditor({ module, index, removable, quizRequired, requiresFullWatch, onChange, onRemove }: Props) {
  const titleId = useId();
  const set = (change: Partial<TrainingModuleDraft>) => onChange({ ...module, ...change });
  const addQuestion = () => {
    const question: QuizQuestion = { text: '', options: ['', ''], correct: 0 };
    set({ quizQuestions: [...module.quizQuestions, question] });
  };

  return (
    <section className="training-module-editor">
      <div className="training-lesson-heading">
        <h4>Modül {index + 1}</h4>
        {removable && <button type="button" className="btn-icon danger" onClick={onRemove} title="Modülü sil" aria-label={`${index + 1}. modülü sil`}><Trash2 size={16} /></button>}
      </div>
      <div className="input-group">
        <label className="input-label" htmlFor={titleId}>Modül Başlığı</label>
        <input id={titleId} className="form-control" value={module.title} onChange={(event) => set({ title: event.target.value })} required />
      </div>
      <div className="input-group">
        <label className="input-label">Modül Açıklaması</label>
        <textarea className="form-control" rows={2} value={module.description} onChange={(event) => set({ description: event.target.value })} />
      </div>
      {module.contents.map((content, contentIndex) => (
        <TrainingLessonEditor
          key={content.clientKey || contentIndex}
          lesson={content}
          index={contentIndex}
          removable={module.contents.length > 1}
          requiresFullWatch={requiresFullWatch}
          onChange={(value) => set({ contents: module.contents.map((item, i) => i === contentIndex ? value : item) })}
          onRemove={() => set({ contents: module.contents.filter((_, i) => i !== contentIndex) })}
        />
      ))}
      <button type="button" className="btn-secondary" onClick={() => set({ contents: [...module.contents, createEmptyLesson()] })}><Plus size={16} /> Video / PDF Ekle</button>
      <div className="training-quiz-heading">
        <strong>Modül Sınavı ({module.quizQuestions.length}){quizRequired ? ' · zorunlu' : ''}</strong>
        <button type="button" className="btn-secondary" onClick={addQuestion}>Soru Ekle</button>
      </div>
      {module.quizQuestions.map((question, questionIndex) => (
        <TrainingQuestionEditor
          key={questionIndex}
          question={question}
          index={questionIndex}
          onChange={(value) => set({ quizQuestions: module.quizQuestions.map((item, i) => i === questionIndex ? value : item) })}
          onRemove={() => set({ quizQuestions: module.quizQuestions.filter((_, i) => i !== questionIndex) })}
        />
      ))}
    </section>
  );
}
