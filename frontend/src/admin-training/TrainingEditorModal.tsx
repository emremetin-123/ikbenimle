import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { API_BASE } from '../config';
import type { Video } from '../types';
import { ModalShell } from '../components/ModalShell';
import { TrainingCoverUpload } from './TrainingCoverUpload';
import { TrainingModuleEditor } from './TrainingModuleEditor';
import { TrainingPolicyPanel } from './TrainingPolicyPanel';
import { TrainingRuleControls } from './TrainingRuleControls';
import { useAppFeedback } from '../components/AppFeedback';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { AsyncState } from '../components/AsyncState';
import {
  applyTrainingProfile,
  createEmptyModule,
  appendTrainingModules,
  modulesFromLessons,
  normalizeTrainingFormForLessons,
  trainingProfiles,
  type VideoLessonResponse,
  videoToForm,
} from './trainingConfig';

interface TrainingEditorModalProps {
  video: Video;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'Bilinmeyen hata';

export function TrainingEditorModal({ video, onClose, onSaved }: TrainingEditorModalProps) {
  const feedback = useAppFeedback();
  const [form, setForm] = useState(() => videoToForm(video));
  const [modules, setModules] = useState([createEmptyModule()]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [badgeFile, setBadgeFile] = useState<File | null>(null);
  const [badgeRemoved, setBadgeRemoved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCoverFile(null);
    setCoverRemoved(false);
    setBadgeFile(null);
    setBadgeRemoved(false);
    setLoading(true);
    setLoadError(null);
    fetch(`${API_BASE}/api/admin/video/${video.id}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Eğitim detayları alınamadı');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        const loaded = modulesFromLessons((data.lessons || []) as VideoLessonResponse[]);
        setModules(loaded.length ? loaded : [createEmptyModule()]);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = getErrorMessage(error);
          setLoadError(message);
          feedback.notifyError(`Eğitim detayları açılamadı: ${message}`);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [video.id, loadAttempt, feedback]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (form.awards_badge && !badgeFile && (badgeRemoved || !form.badge_image_url)) throw new Error('Rozet verilecek eğitimler için rozet görseli yükleyin.');
      const formData = new FormData();
      const normalizedForm = normalizeTrainingFormForLessons(form, modules.flatMap((module) => module.contents));
      Object.entries(normalizedForm).forEach(([key, value]) => formData.append(key, String(value ?? '')));
      if (coverFile) formData.append('cover_image_file', coverFile);
      formData.append('remove_cover_image', String(coverRemoved));
      if (form.awards_badge && badgeFile) formData.append('badge_image_file', badgeFile);
      formData.append('remove_badge_image', String(badgeRemoved));
      appendTrainingModules(formData, modules);
      const response = await fetch(`${API_BASE}/api/admin/video/${video.id}`, { method: 'PUT', body: formData });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Eğitim güncellenemedi');
      return result;
    },
    onSuccess: async (result) => {
      await onSaved();
      feedback.notifySuccess(result.newVersion
        ? 'Yeni eğitim sürümü oluşturuldu. İlerleme içeren eski atamalar korunur; yeni sürüm gerektiğinde yeniden atanmalıdır.'
        : 'Eğitim güncellendi.');
      onClose();
    },
    onError: (error: Error) => feedback.notifyError(`Hata: ${getErrorMessage(error)}`),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    updateMutation.mutate();
  };

  const setField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const hasVideoLessons = modules.some((module) => module.contents.some((content) => content.content_type === 'video'));

  if (loading) {
    return <ModalShell ariaLabel="Eğitim detayları yükleniyor" onClose={onClose}><LoadingIndicator compact label="Eğitim detayları yükleniyor" /></ModalShell>;
  }
  if (loadError) {
    return (
      <ModalShell ariaLabel="Eğitim detayları yüklenemedi" onClose={onClose}>
        <AsyncState
          kind="error"
          title="Eğitim detayları yüklenemedi"
          message={loadError}
          onRetry={() => setLoadAttempt((current) => current + 1)}
        />
      </ModalShell>
    );
  }

  return (
    <ModalShell ariaLabel="Eğitimi düzenle" onClose={onClose}>
        <div className="admin-modal-header">
          <h3 className="training-modal-title">Eğitimi Düzenle</h3>
          <button type="button" onClick={onClose} className="admin-modal-close" title="Kapat" aria-label="Kapat"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="responsive-grid-3">
            <div className="input-group"><label className="input-label">Eğitim Başlığı</label><input className="form-control" value={form.title} onChange={(event) => setField('title', event.target.value)} required /></div>
            <div className="input-group"><label className="input-label">Kategori</label><input className="form-control" value={form.category} onChange={(event) => setField('category', event.target.value)} /></div>
            <div className="input-group">
              <label className="input-label">Eğitim Şablonu</label>
              <select className="form-control" value={form.training_profile} onChange={(event) => setForm((current) => ({ ...current, ...applyTrainingProfile(event.target.value) }))}>
                {trainingProfiles.map((profile) => <option key={profile.value} value={profile.value}>{profile.label}</option>)}
              </select>
            </div>
            <div className="input-group"><label className="input-label">Eğitmen</label><input className="form-control" value={form.trainer_name} onChange={(event) => setField('trainer_name', event.target.value)} /></div>
            <div className="input-group"><label className="input-label">Eğitmen Ünvanı</label><input className="form-control" value={form.trainer_title} onChange={(event) => setField('trainer_title', event.target.value)} /></div>
          </div>
          <TrainingCoverUpload
            file={coverFile}
            currentUrl={coverRemoved ? '' : form.cover_image_url}
            onChange={(file) => {
              setCoverFile(file);
              if (file) setCoverRemoved(false);
            }}
            onRemoveCurrent={() => setCoverRemoved(true)}
          />
          <TrainingPolicyPanel form={form} hasVideoLessons={hasVideoLessons} onChange={setField} />
          {form.awards_badge && <TrainingCoverUpload kind="badge" file={badgeFile} currentUrl={badgeRemoved ? '' : form.badge_image_url} onChange={(file) => { setBadgeFile(file); if (file) setBadgeRemoved(false); }} onRemoveCurrent={() => setBadgeRemoved(true)} />}
          <TrainingRuleControls form={form} idPrefix="training-edit" onChange={setField} />
          <div className="training-lessons-heading">
            <h4>Modüller ({modules.length})</h4>
            <button type="button" className="btn-secondary" onClick={() => setModules((current) => [...current, createEmptyModule()])}><Plus size={16} /> Modül Ekle</button>
          </div>
          {modules.map((module, index) => (
            <TrainingModuleEditor
              key={module.clientKey}
              module={module}
              index={index}
              removable={modules.length > 1}
              quizRequired={form.training_profile === 'compliance' || form.requires_quiz}
              requiresFullWatch={form.training_profile === 'compliance' || form.requires_full_watch}
              onChange={(value) => setModules((current) => current.map((item, currentIndex) => currentIndex === index ? value : item))}
              onRemove={() => setModules((current) => current.filter((_, currentIndex) => currentIndex !== index))}
            />
          ))}
          <div className="input-group"><label className="input-label">Eğitim Açıklaması</label><textarea className="form-control" rows={4} value={form.description} onChange={(event) => setField('description', event.target.value)} /></div>
          <div className="admin-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Kaydediliyor...' : 'Güncelle'}</button>
          </div>
        </form>
    </ModalShell>
  );
}
