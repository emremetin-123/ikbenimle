import { useId } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { QuizQuestion } from '../types';

interface TrainingQuestionEditorProps {
  question: QuizQuestion;
  index: number;
  onChange: (question: QuizQuestion) => void;
  onRemove: () => void;
}

export function TrainingQuestionEditor({
  question,
  index,
  onChange,
  onRemove,
}: TrainingQuestionEditorProps) {
  const answerGroupName = useId();
  const removeOption = (optionIndex: number) => {
    if (question.options.length <= 2) return;
    const options = question.options.filter((_, currentIndex) => currentIndex !== optionIndex);
    const correct = question.correct === optionIndex
      ? 0
      : question.correct > optionIndex ? question.correct - 1 : question.correct;
    onChange({ ...question, options, correct });
  };

  return (
    <div className="training-question-editor">
      <div className="training-question-heading">
        <input
          className="form-control"
          value={question.text}
          onChange={(event) => onChange({ ...question, text: event.target.value })}
          placeholder={`${index + 1}. soru`}
          required
        />
        <button type="button" className="btn-icon danger" onClick={onRemove} title="Soruyu sil" aria-label={`${index + 1}. soruyu sil`}>
          <Trash2 size={16} />
        </button>
      </div>
      <div className="responsive-grid-2 training-question-options">
        {question.options.map((option, optionIndex) => (
          <label key={optionIndex} className="training-question-option">
            <input
              type="radio"
              name={answerGroupName}
              checked={question.correct === optionIndex}
              onChange={() => onChange({ ...question, correct: optionIndex })}
              aria-label={`${optionIndex + 1}. seçenek doğru cevap`}
            />
            <input
              className="form-control"
              value={option}
              onChange={(event) => onChange({
                ...question,
                options: question.options.map((value, currentIndex) => currentIndex === optionIndex ? event.target.value : value),
              })}
              placeholder={`${optionIndex + 1}. seçenek`}
              required
            />
            {question.options.length > 2 && (
              <button
                type="button"
                className="btn-icon danger"
                onClick={() => removeOption(optionIndex)}
                title="Seçeneği sil"
                aria-label={`${optionIndex + 1}. seçeneği sil`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </label>
        ))}
      </div>
      {question.options.length < 10 && (
        <button
          type="button"
          className="btn-secondary training-question-add-option"
          onClick={() => onChange({ ...question, options: [...question.options, ''] })}
        >
          <Plus size={15} /> Seçenek Ekle
        </button>
      )}
    </div>
  );
}
