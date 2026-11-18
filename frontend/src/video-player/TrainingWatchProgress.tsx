export function TrainingWatchProgress({ percent }: { percent: number }) {
  const tone = percent >= 80 ? 'is-high' : percent >= 40 ? 'is-medium' : 'is-low';

  return (
    <div className={`training-player-watch-progress ${tone}`}>
      <div className="training-player-watch-progress-heading">
        <span>İzleme ilerlemesi</span>
        <strong>%{percent}</strong>
      </div>
      <progress
        max="100"
        value={percent}
        aria-label={`Videonun yüzde ${percent} kadarı izlendi`}
      >
        %{percent}
      </progress>
    </div>
  );
}
