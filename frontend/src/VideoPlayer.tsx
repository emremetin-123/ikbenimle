import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from './AuthContext';
import { API_BASE } from './config';
import type { VideoPlayerData } from './types';
import { TrainingAssessmentPanel } from './video-player/TrainingAssessmentPanel';
import { TrainingSidebar } from './video-player/TrainingSidebar';
import { TrainingWatchProgress } from './video-player/TrainingWatchProgress';
import { TrainingLessonActions } from './video-player/TrainingLessonActions';
import { AsyncState } from './components/AsyncState';
import { MobileHeader } from './components/MobileHeader';
import { BottomNav } from './components/BottomNav';
const enabled = (value: unknown) => value === true || value === 1 || value === '1';
const clampPercent = (value: unknown) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)));

const lessonWatchPercent = (lesson?: VideoPlayerData['lessons'][number]) => {
  if (!lesson) return 0;
  if (lesson.status === 'completed' || lesson.status === 'watched') return 100;
  if (lesson.content_progress_percent !== null && lesson.content_progress_percent !== undefined) {
    return clampPercent(lesson.content_progress_percent);
  }
  const duration = Number(lesson.required_seconds || 0);
  return duration > 0 ? clampPercent((Number(lesson.max_position || 0) / duration) * 100) : 0;
};

export const VideoPlayer = ({ videoId, onBack }: { videoId: number; onBack: () => void }) => {
  const { user } = useAuth();
  const [data, setData] = useState<VideoPlayerData | null>(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<number | null>(null);
  const [watched, setWatched] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [watchPercent, setWatchPercent] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const maxPosition = useRef(0);
  const lastPlaybackPosition = useRef(0);
  const lastPlaybackSampleAt = useRef(0);
  const activeSeconds = useRef(0);
  const seekGuard = useRef(false);
  const progressToken = useRef<string | null>(null);
  const progressLessonId = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/video/${videoId}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Eğitim bilgileri alınamadı.');
      setData(body);
      setLoadError(null);
      const lesson = body.lessons[lessonIndex];
      maxPosition.current = Number(lesson?.max_position || 0);
      lastPlaybackPosition.current = Number(lesson?.last_position || 0);
      lastPlaybackSampleAt.current = performance.now();
      setWatchPercent(lessonWatchPercent(lesson));
      setWatched(
        Boolean(lesson && (lesson.status === 'completed' || lesson.status === 'watched'))
        && !enabled(lesson?.requires_rewatch),
      );
      if (body.assignment.confirmed_at) setReferenceId(body.assignment.reference_id);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Eğitim bilgileri alınamadı.');
    }
  }, [lessonIndex, videoId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    if (!data || !enabled(data.video.pause_on_blur)) return;
    const pause = () => {
      if (document.hidden) videoRef.current?.pause();
    };
    document.addEventListener('visibilitychange', pause);
    window.addEventListener('blur', pause);
    return () => {
      document.removeEventListener('visibilitychange', pause);
      window.removeEventListener('blur', pause);
    };
  }, [data]);

  const startProgress = useCallback(async (lessonId: number) => {
    const response = await fetch(`${API_BASE}/api/lesson/${lessonId}/watch/start`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || body.error || 'İzleme oturumu başlatılamadı.');
    progressToken.current = body.progress_token;
    progressLessonId.current = lessonId;
    return body.progress_token as string;
  }, []);

  const saveProgress = useCallback(async (lessonId: number, payload: Record<string, number | boolean>) => {
    const token = progressLessonId.current === lessonId && progressToken.current
      ? progressToken.current
      : await startProgress(lessonId);
    const response = await fetch(`${API_BASE}/api/lesson/${lessonId}/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, progress_token: token }),
    });
    if (response.status === 409) {
      const renewedToken = await startProgress(lessonId);
      const retry = await fetch(`${API_BASE}/api/lesson/${lessonId}/watch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, progress_token: renewedToken }),
      });
      if (!retry.ok) throw new Error('Eğitim ilerlemesi kaydedilemedi.');
      return retry.json();
    }
    if (!response.ok) throw new Error('Eğitim ilerlemesi kaydedilemedi.');
    return response.json();
  }, [startProgress]);

  const activeLessonId = data?.lessons?.[lessonIndex]?.id;
  useEffect(() => {
    if (!activeLessonId) return;
    progressToken.current = null;
    progressLessonId.current = null;
    startProgress(activeLessonId).catch(() => undefined);
  }, [activeLessonId, startProgress]);

  useEffect(() => {
    const lesson = data?.lessons?.[lessonIndex];
    if (!lesson || (lesson.content_type || 'video') === 'video') return;
    activeSeconds.current = Number(lesson.active_seconds || 0);
    setPdfPage(Math.max(1, Number(lesson.page_number || 1)));
    setPdfPageCount(Math.max(1, Number(lesson.page_count || 1)));
    const timer = window.setInterval(() => {
      activeSeconds.current += 15;
      saveProgress(lesson.id, {
        active_seconds: activeSeconds.current,
        content_progress_percent: Number(lesson.content_progress_percent || 0),
        page_number: Math.max(1, Number(lesson.page_number || 1)),
        page_count: Math.max(1, Number(lesson.page_count || 1)),
      }).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [data, lessonIndex, saveProgress]);

  useEffect(() => {
    const lesson = data?.lessons?.[lessonIndex];
    if (!lesson || (lesson.content_type || 'video') !== 'video') return;
    const timer = window.setInterval(() => {
      const element = videoRef.current;
      if (!element || element.paused || element.ended || element.seeking) return;
      maxPosition.current = Math.max(maxPosition.current, element.currentTime);
      saveProgress(lesson.id, {
        watched_seconds: Math.round(maxPosition.current),
        last_position: Math.round(element.currentTime),
        max_position: Math.round(maxPosition.current),
        duration_seconds: Math.round(element.duration || 0),
        is_playing: true,
      }).then((progress) => {
        setWatchPercent(clampPercent(progress.watch_percent));
      }).catch(() => {
        setActionMessage('İzleme ilerlemesi kaydedilemedi. Bağlantınızı kontrol edip videoyu sürdürün.');
      });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [data, lessonIndex, saveProgress]);

  if (!data && loadError) {
    return (
      <AsyncState
        kind="error"
        title="Eğitim açılamadı"
        message={loadError}
        onRetry={() => void fetchData()}
      />
    );
  }
  if (!data) return <AsyncState kind="loading" title="Eğitim yükleniyor" />;
  const lesson = data.lessons[lessonIndex];
  const contentType = lesson?.content_type || 'video';
  const isVideo = contentType === 'video';
  const requiresRewatch = enabled(lesson?.requires_rewatch);
  const uploadUrl = lesson?.url?.startsWith('/uploads')
    ? `${API_BASE}${lesson.url}`
    : lesson?.url || '';

  const saveDocument = async (completed = false) => {
    const total = Math.max(1, pdfPageCount);
    const page = completed ? total : Math.min(total, Math.max(1, pdfPage));
    const percent = completed ? 100 : Math.round((page / total) * 100);
    const progress = await saveProgress(lesson.id, {
      content_completed: completed,
      active_seconds: activeSeconds.current,
      content_progress_percent: percent,
      page_number: page,
      page_count: total,
    });
    const satisfied = progress.status === 'completed' || progress.status === 'watched';
    setWatched(satisfied);
    setWatchPercent(clampPercent(progress.watch_percent ?? (satisfied ? 100 : percent)));
    if (satisfied && lessonIndex === data.lessons.length - 1 && !lesson.quiz
      && !data.assignment.confirmed_at && enabled(data.video.certificate_enabled)) {
      setConfirmation(true);
      setAssessmentOpen(true);
    }
    await fetchData();
  };
  const finishVideo = async () => {
    try {
      const element = videoRef.current;
      const duration = Math.round(element?.duration || element?.currentTime || 0);
      const position = Math.round(element?.currentTime || duration);
      const progress = await saveProgress(lesson.id, {
        video_completed: true,
        watched_seconds: duration,
        last_position: position,
        max_position: Math.round(Math.max(maxPosition.current, position)),
        duration_seconds: duration,
        is_playing: true,
      });
      const completed = progress.status === 'completed' || progress.status === 'watched';
      const nextPercent = clampPercent(progress.watch_percent ?? (completed ? 100 : 0));
      setWatched(completed);
      setWatchPercent(nextPercent);
      if (!completed) {
        setActionMessage(`İzleme kaydı henüz tamamlanmadı (%${nextPercent}). Video kaldığınız yerden devam edecektir.`);
      } else if (lesson.quiz) {
        setActionMessage(null);
        setAnswers({});
        setResult(null);
        setAssessmentOpen(true);
      } else if (lessonIndex === data.lessons.length - 1
        && !data.assignment.confirmed_at && enabled(data.video.certificate_enabled)) {
        setActionMessage(null);
        setConfirmation(true);
        setAssessmentOpen(true);
      } else {
        setActionMessage('İçerik başarıyla tamamlandı.');
      }
      await fetchData();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Eğitim ilerlemesi kaydedilemedi. Lütfen tekrar deneyin.');
    }
  };
  const submitQuiz = async () => {
    if (!lesson.quiz) return;
    if (lesson.quiz.questions.some((_, index) => answers[index] === undefined)) {
      setActionMessage('Lütfen tüm soruları yanıtlayın.');
      return;
    }
    const response = await fetch(`${API_BASE}/api/lesson/${lesson.id}/quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setActionMessage(body.error || 'Sınav sonucu kaydedilemedi.');
      return fetchData();
    }
    setActionMessage(null);
    setResult(Number(body.score ?? 0));
    if (body.requires_rewatch) setWatched(false);
    if (lessonIndex === data.lessons.length - 1 && body.passed
      && !data.assignment.confirmed_at && enabled(data.video.certificate_enabled)) {
      setConfirmation(true);
    }
    await fetchData();
  };
  const confirm = async () => {
    if (!agreed) return;
    try {
      const response = await fetch(`${API_BASE}/api/assignment/${data.assignment.id}/confirm`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setActionMessage(body.message || body.error || 'Eğitim onayı kaydedilemedi.');
        return;
      }
      setReferenceId(body.reference_id);
      setConfirmation(false);
      setAssessmentOpen(false);
      setAgreed(false);
      setActionMessage('Eğitim başarıyla tamamlandı ve onaylandı.');
      await fetchData();
    } catch {
      setActionMessage('Eğitim onayı kaydedilemedi. Lütfen tekrar deneyin.');
    }
  };
  const selectLesson = (index: number) => {
    if (index > 0 && data.lessons[index - 1].status !== 'completed') {
      setActionMessage('Lütfen önceki bölümü tamamlayın.');
      return;
    }
    setActionMessage(null);
    setLessonIndex(index);
    setAssessmentOpen(false);
    setResult(null);
    setAnswers({});
    setMobileMenu(false);
  };
  const openAssessment = () => {
    if (lesson.status === 'completed') {
      setActionMessage('Sınavı zaten tamamladınız.');
      return;
    }
    if (requiresRewatch) {
      setActionMessage('Deneme hakkınız doldu. Lütfen videoyu tekrar izleyin.');
      return;
    }
    if (!watched) {
      setActionMessage('Lütfen önce içeriği tamamlayın.');
      return;
    }
    setActionMessage(null);
    setAssessmentOpen(true);
  };
  const finalLesson = lessonIndex === data.lessons.length - 1;
  const needsConfirmation = finalLesson
    && enabled(data.video.certificate_enabled)
    && !data.assignment.confirmed_at;
  const openCompletionConfirmation = () => {
    setActionMessage(null);
    setAgreed(false);
    setConfirmation(true);
    setAssessmentOpen(true);
  };
  return (
    <div className="dashboard-layout">
      <MobileHeader title={data.video.title} onBack={onBack} onOpenMenu={() => setMobileMenu(true)} menuLabel="Eğitim menüsünü aç" />
      <TrainingSidebar
        data={data}
        currentIndex={lessonIndex}
        mobileOpen={mobileMenu}
        onBack={onBack}
        onClose={() => setMobileMenu(false)}
        onSelect={selectLesson}
      />
      <main className="main-content training-player-content">
        {actionMessage && (
          <div className="training-player-notice" role="alert">
            <span>{actionMessage}</span>
            <button
              type="button"
              className="btn-icon"
              aria-label="Uyarıyı kapat"
              onClick={() => setActionMessage(null)}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {assessmentOpen ? (
          <TrainingAssessmentPanel
            lesson={lesson}
            data={data}
            userName={user?.name}
            answers={answers}
            result={result}
            confirmation={confirmation}
            agreed={agreed}
            referenceId={referenceId}
            requiresRewatch={requiresRewatch}
            currentIndex={lessonIndex}
            onAnswer={(question, option) => setAnswers((current) => ({ ...current, [question]: option }))}
            onSubmit={submitQuiz}
            onAgree={setAgreed}
            onConfirm={confirm}
            onChooseLesson={() => { setAssessmentOpen(false); setResult(null); }}
            onNext={() => { setLessonIndex((index) => index + 1); setAssessmentOpen(false); setResult(null); }}
            onFinish={onBack}
          />
        ) : (
          <>
            <div className="training-player-stage">
              {!uploadUrl ? (
                <div className="video-player-missing-content">
                  <AsyncState
                    kind="error"
                    title="Eğitim içeriği bulunamadı"
                    message="Bu ders için geçerli bir içerik dosyası veya bağlantısı tanımlanmamış."
                  />
                </div>
              ) : !isVideo ? (
                contentType === 'pdf' ? (
                  <iframe title={lesson.title} src={`${uploadUrl}#toolbar=1&navpanes=0&view=FitH`} className="training-player-embed" />
                ) : (
                  <div className="training-player-external-content">
                    <div><h2>Eğitim İçeriği</h2><p>{lesson.description}</p><a href={uploadUrl} target="_blank" rel="noreferrer" className="btn-primary">Bağlantıyı Aç</a></div>
                  </div>
                )
              ) : (
                <video
                  key={lesson.url}
                  ref={videoRef}
                  controls
                  controlsList="nodownload noplaybackrate"
                  disablePictureInPicture
                  preload="metadata"
                  src={uploadUrl}
                  className="training-player-media"
                  onContextMenu={(event) => event.preventDefault()}
                  onLoadedMetadata={() => {
                    const element = videoRef.current;
                    const saved = Number(lesson.last_position || 0);
                    maxPosition.current = Math.max(Number(lesson.max_position || 0), saved);
                    lastPlaybackPosition.current = saved;
                    lastPlaybackSampleAt.current = performance.now();
                    if (!element) return;
                    element.defaultPlaybackRate = 1;
                    element.playbackRate = 1;
                    if (saved > 0 && lesson.status !== 'completed') element.currentTime = saved;
                  }}
                  onPlay={() => {
                    const element = videoRef.current;
                    if (!element) return;
                    element.defaultPlaybackRate = 1;
                    element.playbackRate = 1;
                    lastPlaybackPosition.current = element.currentTime;
                    lastPlaybackSampleAt.current = performance.now();
                  }}
                  onRateChange={() => {
                    const element = videoRef.current;
                    if (element && element.playbackRate !== 1) element.playbackRate = 1;
                  }}
                  onTimeUpdate={() => {
                    const element = videoRef.current;
                    if (!element || element.seeking || seekGuard.current) return;
                    if (element.playbackRate !== 1) element.playbackRate = 1;
                    const now = performance.now();
                    const elapsed = Math.max(0, (now - lastPlaybackSampleAt.current) / 1000);
                    const naturalAdvance = element.paused ? 0.5 : Math.max(0.5, (elapsed * 1.5) + 0.25);
                    if (enabled(data.video.disable_forward_seek)
                      && element.currentTime > lastPlaybackPosition.current + naturalAdvance) {
                      seekGuard.current = true;
                      element.currentTime = lastPlaybackPosition.current;
                      window.setTimeout(() => { seekGuard.current = false; }, 0);
                      return;
                    }
                    lastPlaybackPosition.current = element.currentTime;
                    lastPlaybackSampleAt.current = now;
                    maxPosition.current = Math.max(maxPosition.current, element.currentTime);
                  }}
                  onSeeking={() => {
                    const element = videoRef.current;
                    if (!element || !enabled(data.video.disable_forward_seek) || seekGuard.current) return;
                    if (element.currentTime > maxPosition.current + 0.5) {
                      seekGuard.current = true;
                      element.currentTime = lastPlaybackPosition.current;
                      window.setTimeout(() => { seekGuard.current = false; }, 0);
                    }
                  }}
                  onSeeked={() => {
                    const element = videoRef.current;
                    if (!element || seekGuard.current) return;
                    if (element.currentTime <= maxPosition.current + 0.5) {
                      lastPlaybackPosition.current = element.currentTime;
                      lastPlaybackSampleAt.current = performance.now();
                    }
                  }}
                  onEnded={finishVideo}
                />
              )}
            </div>
            {uploadUrl && isVideo && (
              <TrainingWatchProgress percent={watchPercent} />
            )}
            <section className="premium-card training-player-lesson-details">
              <h1>{lesson.title}</h1><p>{lesson.description}</p>
              {uploadUrl && !isVideo && contentType === 'pdf' && lesson.status !== 'completed' && (
                <div className="training-player-document-progress">
                  <label>Sayfa<input className="form-control" type="number" min="1" value={pdfPage} onChange={(event) => setPdfPage(Number(event.target.value))} /></label>
                  <label>Toplam<input className="form-control" type="number" min="1" value={pdfPageCount} onChange={(event) => setPdfPageCount(Number(event.target.value))} /></label>
                  <button type="button" className="btn-secondary" onClick={() => saveDocument()}>Kaydet</button>
                </div>
              )}
              {uploadUrl && !isVideo && lesson.status !== 'completed' && <button type="button" className="btn-primary" onClick={() => saveDocument(true)}>İçeriği Tamamladım</button>}
              <TrainingLessonActions
                hasQuiz={Boolean(lesson.quiz)}
                status={lesson.status}
                watched={watched}
                isVideo={isVideo}
                watchPercent={watchPercent}
                finalLesson={finalLesson}
                needsConfirmation={needsConfirmation}
                onAssessment={openAssessment}
                onCompleteWatch={finishVideo}
                onNext={() => selectLesson(lessonIndex + 1)}
                onConfirm={openCompletionConfirmation}
                onFinish={onBack}
              />
            </section>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
};
