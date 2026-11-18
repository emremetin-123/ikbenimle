type Props = {
  hasQuiz: boolean;
  status?: string | null;
  watched: boolean;
  isVideo: boolean;
  watchPercent: number;
  finalLesson: boolean;
  needsConfirmation: boolean;
  onAssessment: () => void;
  onCompleteWatch: () => void;
  onNext: () => void;
  onConfirm: () => void;
  onFinish: () => void;
};

export function TrainingLessonActions({
  hasQuiz, status, watched, isVideo, watchPercent, finalLesson,
  needsConfirmation, onAssessment, onCompleteWatch, onNext, onConfirm, onFinish,
}: Props) {
  const completed = status === 'completed';
  const contentWatched = status === 'watched';
  const assessmentReady = watched || contentWatched;
  const hasAction = hasQuiz || completed || (isVideo && watchPercent >= 100);

  if (!hasAction) return null;

  return (
    <div className="training-player-lesson-actions">
      {hasQuiz && !completed && !assessmentReady && <p>İçerik tamamlandığında sınava geçebilirsiniz.</p>}
      {hasQuiz && !completed && assessmentReady && (
        <button type="button" className="btn-primary" onClick={onAssessment}>
          Sınava Geç
        </button>
      )}
      {isVideo && watchPercent >= 100 && !completed && (!contentWatched || !hasQuiz) && (
        <button type="button" className="btn-primary" onClick={onCompleteWatch}>İzlemeyi Tamamla</button>
      )}
      {completed && !finalLesson && (
        <button type="button" className="btn-secondary" onClick={onNext}>Sonraki İçerik</button>
      )}
      {completed && finalLesson && needsConfirmation && (
        <button type="button" className="btn-primary" onClick={onConfirm}>Eğitimi Tamamla</button>
      )}
      {completed && finalLesson && !needsConfirmation && (
        <button type="button" className="btn-primary" onClick={onFinish}>Eğitimi Bitir</button>
      )}
    </div>
  );
}
