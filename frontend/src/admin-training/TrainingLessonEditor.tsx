import { useEffect, useId, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import type { LessonDraft } from '../types';

interface TrainingLessonEditorProps {
  lesson: LessonDraft;
  index: number;
  removable: boolean;
  requiresFullWatch: boolean;
  onChange: (lesson: LessonDraft) => void;
  onRemove: () => void;
}

export function TrainingLessonEditor({
  lesson,
  index,
  removable,
  requiresFullWatch,
  onChange,
  onRemove,
}: TrainingLessonEditorProps) {
  const titleId = useId();
  const lessonRef = useRef(lesson);
  useEffect(() => {
    lessonRef.current = lesson;
  }, [lesson]);
  const setField = <K extends keyof LessonDraft>(field: K, value: LessonDraft[K]) => {
    onChange({ ...lesson, [field]: value });
  };
  const selectFile = (file: File | null) => {
    const nextLesson = { ...lessonRef.current, file };
    onChange(nextLesson);
    if (!file || lesson.content_type !== 'video') return;
    const objectUrl = URL.createObjectURL(file);
    const media = document.createElement('video');
    media.preload = 'metadata';
    media.onloadedmetadata = () => {
      const seconds = Math.ceil(media.duration || 0);
      URL.revokeObjectURL(objectUrl);
      if (seconds > 0) onChange({ ...lessonRef.current, file, required_seconds: String(seconds) });
    };
    media.onerror = () => URL.revokeObjectURL(objectUrl);
    media.src = objectUrl;
  };

  return (
    <section className="training-lesson-editor training-content-editor">
      <div className="training-lesson-heading">
        <h4>{index + 1}. İçerik</h4>
        {removable && (
          <button type="button" className="btn-icon danger" onClick={onRemove} title="İçeriği sil" aria-label={`${index + 1}. içeriği sil`}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="responsive-grid-2">
        <div className="input-group">
          <label className="input-label" htmlFor={titleId}>İçerik Başlığı</label>
          <input id={titleId} className="form-control" value={lesson.title} onChange={(event) => setField('title', event.target.value)} required />
        </div>
        <div className="input-group">
          <label className="input-label">İçerik Tipi</label>
          <select className="form-control" value={lesson.content_type} onChange={(event) => setField('content_type', event.target.value === 'pdf' ? 'pdf' : 'video')}>
            <option value="video">Video</option>
            <option value="pdf">PDF / Sunum</option>
          </select>
        </div>
        <div className="input-group">
          <label className="input-label">Yeni Dosya</label>
          <input
            className="form-control"
            type="file"
            accept={lesson.content_type === 'video' ? 'video/*' : '.pdf'}
            onChange={(event) => selectFile(event.target.files?.[0] || null)}
          />
        </div>
        {lesson.content_type === 'pdf' && (
          <>
            <div className="input-group">
              <label className="input-label">Minimum Aktif Süre (sn)</label>
              <input className="form-control" type="number" min="0" value={lesson.required_seconds || ''} onChange={(event) => setField('required_seconds', event.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label">Minimum İlerleme (%)</label>
              <input className="form-control" type="number" min="0" max="100" value={lesson.required_percent || ''} onChange={(event) => setField('required_percent', event.target.value)} />
            </div>
          </>
        )}
        {lesson.content_type === 'video' && (
          <div className="input-group">
            <label className="input-label">Video Süresi (sn){requiresFullWatch ? ' · zorunlu' : ''}</label>
            <input className="form-control" type="number" min={requiresFullWatch ? 1 : 0} required={requiresFullWatch} value={lesson.required_seconds || ''} onChange={(event) => setField('required_seconds', event.target.value)} />
            <small className="form-hint">Video dosyası seçildiğinde süre otomatik doldurulur.</small>
          </div>
        )}
      </div>
      <div className="input-group">
        <label className="input-label">İçerik Açıklaması</label>
        <textarea className="form-control" rows={2} value={lesson.description} onChange={(event) => setField('description', event.target.value)} />
      </div>
    </section>
  );
}
