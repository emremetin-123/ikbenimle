import { Calendar, ShieldCheck, User } from 'lucide-react';
import type { VideoPlayerData } from '../types';

type Lesson = VideoPlayerData['lessons'][number];
type Props = {
  lesson: Lesson;
  data: VideoPlayerData;
  userName?: string | null;
  answers: Record<number, number>;
  result: number | null;
  confirmation: boolean;
  agreed: boolean;
  referenceId: string | null;
  requiresRewatch: boolean;
  currentIndex: number;
  onAnswer: (question: number, option: number) => void;
  onSubmit: () => void;
  onAgree: (value: boolean) => void;
  onConfirm: () => void;
  onChooseLesson: () => void;
  onNext: () => void;
  onFinish: () => void;
};

export const TrainingAssessmentPanel = ({
  lesson, data, userName, answers, result, confirmation, agreed, referenceId,
  requiresRewatch, currentIndex, onAnswer, onSubmit, onAgree, onConfirm,
  onChooseLesson, onNext, onFinish,
}: Props) => {
  if (confirmation) {
    return (
      <div className="premium-card training-assessment-card training-assessment-card-compact">
        <div className="training-assessment-heading">
          <ShieldCheck size={48} color="var(--success)" />
          <h2>Eğitim Tamamlama</h2>
          <p>Lütfen bilgileri onaylayın.</p>
        </div>
        <div className="training-assessment-confirmation-details">
          <span><User size={18} /> {userName}</span>
          <span><Calendar size={18} /> {new Date().toLocaleDateString('tr-TR')}</span>
        </div>
        <label className="training-assessment-agreement">
          <input type="checkbox" checked={agreed} onChange={(event) => onAgree(event.target.checked)} />
          Okudum ve onaylıyorum.
        </label>
        <button type="button" onClick={onConfirm} disabled={!agreed} className="btn-primary">Onayla</button>
      </div>
    );
  }
  if (result !== null) {
    const passed = result >= Number(data.video.pass_score || 50);
    return (
      <div className="premium-card training-assessment-card training-assessment-card-compact training-assessment-result">
        <strong className={`training-assessment-score ${passed ? 'is-passed' : 'is-failed'}`}>%{result}</strong>
        <h3>{passed ? 'Tebrikler, geçtiniz!' : requiresRewatch ? 'Deneme hakkınız doldu. Videoyu tekrar izleyin.' : 'Sınavı geçemediniz.'}</h3>
        {referenceId && <p>Ref: {referenceId}</p>}
        {!passed ? <button type="button" className="btn-secondary" onClick={onChooseLesson}>İçeriğe Dön</button> : currentIndex < data.lessons.length - 1 ? (
          <div className="training-assessment-actions">
            <button type="button" className="btn-secondary" onClick={onChooseLesson}>İçeriğe Dön</button>
            <button type="button" className="btn-primary" onClick={onNext}>Sonraki İçerik</button>
          </div>
        ) : <button type="button" className="btn-primary" onClick={onFinish}>Eğitimi Bitir</button>}
      </div>
    );
  }
  return (
    <div className="premium-card training-assessment-card">
      <h2>Modül Sınavı</h2>
      {lesson.quiz?.questions.map((question, questionIndex) => (
        <div key={questionIndex} className="training-assessment-question">
          <p><b>{questionIndex + 1}. {question.text}</b></p>
          <div className="training-assessment-options">
            {question.options.map((option: string, optionIndex: number) => (
              <label key={optionIndex} className="input-group training-assessment-option">
                <input
                  type="radio"
                  name={`q${questionIndex}`}
                  checked={answers[questionIndex] === optionIndex}
                  onChange={() => onAnswer(questionIndex, optionIndex)}
                /> {option}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={onSubmit} className="btn-primary">Gönder</button>
    </div>
  );
};
