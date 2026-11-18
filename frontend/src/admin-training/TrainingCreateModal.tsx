import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BookOpen, Plus, X } from 'lucide-react';
import { API_BASE } from '../config';
import { ModalShell } from '../components/ModalShell';
import { TrainingCoverUpload } from './TrainingCoverUpload';
import { TrainingModuleEditor } from './TrainingModuleEditor';
import { TrainingPolicyPanel } from './TrainingPolicyPanel';
import { TrainingRuleControls } from './TrainingRuleControls';
import { useAppFeedback } from '../components/AppFeedback';
import {
  applyTrainingProfile,
  createEmptyModule,
  appendTrainingModules,
  initialVideoForm,
  normalizeTrainingFormForLessons,
  trainingProfiles,
} from './trainingConfig';

interface TrainingCreateModalProps {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function TrainingCreateModal({ onClose, onSaved }: TrainingCreateModalProps) {
  const feedback = useAppFeedback();
  const [form, setForm] = useState(initialVideoForm);
  const [modules, setModules] = useState([createEmptyModule()]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [badgeFile, setBadgeFile] = useState<File | null>(null);

  const setField = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (form.awards_badge && !badgeFile) throw new Error('Rozet verilecek eğitimler için rozet görseli yükleyin.');
      const formData = new FormData();
      const normalizedForm = normalizeTrainingFormForLessons(form, modules.flatMap((module) => module.contents));
      Object.entries(normalizedForm).forEach(([key, value]) => formData.append(key, String(value ?? '')));
      if (coverFile) formData.append('cover_image_file', coverFile);
      if (form.awards_badge && badgeFile) formData.append('badge_image_file', badgeFile);
      appendTrainingModules(formData, modules);
      const response = await fetch(`${API_BASE}/api/admin/video`, { method: 'POST', body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Eğitim eklenemedi');
      return data;
    },
    onSuccess: async () => {
      await onSaved();
      feedback.notifySuccess('Eğitim ve tüm modülleri başarıyla eklendi.');
      onClose();
    },
    onError: (error: Error) => feedback.notifyError(`Hata: ${error.message}`),
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  const hasVideoLessons = modules.some((module) => module.contents.some((content) => content.content_type === 'video'));

  return (
    <ModalShell className="admin-action-modal" ariaLabel="Yeni eğitim ekle" onClose={onClose}>
        <div className="admin-modal-header">
          <h3 className="training-modal-title"><BookOpen size={20} color="var(--primary)" /> Yeni Eğitim Ekle</h3>
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
            currentUrl={form.cover_image_url}
            onChange={setCoverFile}
            onRemoveCurrent={() => setField('cover_image_url', '')}
          />
          <TrainingPolicyPanel form={form} hasVideoLessons={hasVideoLessons} onChange={setField} />
          {form.awards_badge && <TrainingCoverUpload kind="badge" file={badgeFile} onChange={setBadgeFile} onRemoveCurrent={() => setBadgeFile(null)} />}
          <TrainingRuleControls form={form} idPrefix="training-create" onChange={setField} />
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
            <button type="button" className="btn-cancel" onClick={onClose}>İptal</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>{createMutation.isPending ? 'Kaydediliyor...' : 'Eğitimi Kaydet'}</button>
          </div>
        </form>
    </ModalShell>
  );
}
