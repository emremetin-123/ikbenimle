import type { Dispatch, SetStateAction } from 'react';
import { Save, X } from 'lucide-react';
import { ModalShell } from '../components/ModalShell';
import type {
  EventTemplate,
  NotificationStats,
  RoutineDraft,
} from './types';

const routineTemplates = {
  mood: {
    title: 'Bugün kendini nasıl hissediyorsun?',
    body: 'Günlük duygu durumunu paylaşmak ister misin?',
    url: '/employee/anasayfa',
  },
  training: {
    title: 'Eğitim hatırlatması',
    body: 'Atanmış eğitimlerinizi kontrol etmeyi unutmayın.',
    url: '/employee/egitimler',
  },
  birthday: {
    title: 'Bugün doğum günü olanlar var',
    body: 'Bugün doğum günü olan çalışma arkadaşlarımızı kutlayalım.',
    url: '/employee/anasayfa',
  },
  announcement: {
    title: 'Duyuru hatırlatması',
    body: 'Portal duyurularını ve haberleri kontrol edebilirsiniz.',
    url: '/employee/duyurular',
  },
};

type RoutineModalProps = {
  draft: RoutineDraft;
  setDraft: Dispatch<SetStateAction<RoutineDraft>>;
  stats: NotificationStats;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
};

export const RoutineModal = ({
  draft,
  setDraft,
  stats,
  saving,
  onClose,
  onSave,
}: RoutineModalProps) => (
  <ModalShell onClose={onClose} labelledBy="notify-routine-title" className="admin-action-modal notify-modal">
      <div className="admin-modal-header">
        <div>
          <h3 id="notify-routine-title">{draft.id ? 'Rutini Düzenle' : 'Yeni Rutin'}</h3>
          <p>İçeriği, hedefi ve gönderim zamanını belirleyin.</p>
        </div>
        <button type="button" className="admin-modal-close" onClick={onClose} title="Kapat">
          <X size={18} />
        </button>
      </div>

      <div className="notify-template-row">
        {(Object.keys(routineTemplates) as Array<keyof typeof routineTemplates>).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setDraft(current => ({
              ...current,
              ...routineTemplates[key],
            }))}
          >
            {key === 'mood' && 'Duygu'}
            {key === 'training' && 'Eğitim'}
            {key === 'birthday' && 'Doğum Günü'}
            {key === 'announcement' && 'Duyuru'}
          </button>
        ))}
      </div>

      <div className="notify-form-grid">
        <label>
          Başlık
          <input
            className="form-control"
            maxLength={120}
            value={draft.title}
            onChange={event => setDraft(current => ({
              ...current,
              title: event.target.value,
            }))}
          />
        </label>
        <label>
          Açılacak Sayfa
          <input
            className="form-control"
            value={draft.url}
            onChange={event => setDraft(current => ({
              ...current,
              url: event.target.value,
            }))}
          />
        </label>
        <label>
          Hedef
          <select
            className="form-control"
            value={draft.target}
            onChange={event => setDraft(current => ({
              ...current,
              target: event.target.value as 'all' | 'department',
            }))}
          >
            <option value="all">Tüm aboneler</option>
            <option value="department">Departman</option>
          </select>
        </label>
        {draft.target === 'department' && (
          <label>
            Departman
            <select
              className="form-control"
              value={draft.department || ''}
              onChange={event => setDraft(current => ({
                ...current,
                department: event.target.value,
              }))}
            >
              <option value="">Departman seçin</option>
              {stats.departments.map(item => (
                <option key={item.department} value={item.department}>
                  {item.department}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Rutin Tipi
          <select
            className="form-control"
            value={draft.schedule_type}
            onChange={event => setDraft(current => ({
              ...current,
              schedule_type: event.target.value as 'daily' | 'once',
            }))}
          >
            <option value="daily">Her gün</option>
            <option value="once">Tek tarih</option>
          </select>
        </label>
        {draft.schedule_type === 'once' && (
          <label>
            Tarih
            <input
              className="form-control"
              type="date"
              value={draft.scheduled_date || ''}
              onChange={event => setDraft(current => ({
                ...current,
                scheduled_date: event.target.value,
              }))}
            />
          </label>
        )}
        <label>
          Saat
          <input
            className="form-control"
            type="time"
            value={draft.scheduled_time}
            onChange={event => setDraft(current => ({
              ...current,
              scheduled_time: event.target.value,
            }))}
          />
        </label>
        <label>
          Durum
          <select
            className="form-control"
            value={draft.is_active ? 'true' : 'false'}
            onChange={event => setDraft(current => ({
              ...current,
              is_active: event.target.value === 'true',
            }))}
          >
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
        </label>
      </div>
      <label className="notify-full-field">
        Mesaj
        <textarea
          className="form-control"
          rows={3}
          maxLength={1000}
          value={draft.body}
          onChange={event => setDraft(current => ({
            ...current,
            body: event.target.value,
          }))}
        />
      </label>
      <div className="admin-modal-actions">
        <button type="button" className="btn-cancel" onClick={onClose}>İptal</button>
        <button
          type="button"
          className="btn-primary"
          onClick={onSave}
          disabled={saving || !draft.title.trim() || !draft.body.trim()}
        >
          <Save size={17} />
          {saving ? 'Kaydediliyor...' : draft.id ? 'Rutini Güncelle' : 'Rutini Kaydet'}
        </button>
      </div>
  </ModalShell>
);

type EventTemplateModalProps = {
  draft: EventTemplate;
  setDraft: Dispatch<SetStateAction<EventTemplate | null>>;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
};

export const EventTemplateModal = ({
  draft,
  setDraft,
  saving,
  onClose,
  onSave,
}: EventTemplateModalProps) => (
  <ModalShell onClose={onClose} labelledBy="notify-event-template-title" className="admin-action-modal notify-modal">
      <div className="admin-modal-header">
        <div>
          <h3 id="notify-event-template-title">{draft.label}</h3>
          <p>{draft.description}</p>
        </div>
        <button type="button" className="admin-modal-close" onClick={onClose} title="Kapat">
          <X size={18} />
        </button>
      </div>
      <div className="notify-form-grid">
        <label>
          Durum
          <select
            className="form-control"
            value={draft.enabled ? 'true' : 'false'}
            onChange={event => setDraft(current => current && ({
              ...current,
              enabled: event.target.value === 'true',
            }))}
          >
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </select>
        </label>
        {draft.scheduled_time !== undefined && (
          <label>
            Saat
            <input
              className="form-control"
              type="time"
              value={draft.scheduled_time || ''}
              onChange={event => setDraft(current => current && ({
                ...current,
                scheduled_time: event.target.value,
              }))}
            />
          </label>
        )}
        <label>
          Başlık
          <input
            className="form-control"
            maxLength={120}
            value={draft.title}
            onChange={event => setDraft(current => current && ({
              ...current,
              title: event.target.value,
            }))}
          />
        </label>
        <label>
          Açılacak Sayfa
          <input
            className="form-control"
            value={draft.url}
            onChange={event => setDraft(current => current && ({
              ...current,
              url: event.target.value,
            }))}
          />
        </label>
      </div>
      <label className="notify-full-field">
        Mesaj
        <textarea
          className="form-control"
          rows={4}
          maxLength={1000}
          value={draft.body}
          onChange={event => setDraft(current => current && ({
            ...current,
            body: event.target.value,
          }))}
        />
        {draft.variables.length > 0 && (
          <small>Kullanılabilir değişkenler: {draft.variables.join(' ')}</small>
        )}
      </label>
      <div className="admin-modal-actions">
        <button type="button" className="btn-cancel" onClick={onClose}>İptal</button>
        <button
          type="button"
          className="btn-primary"
          onClick={onSave}
          disabled={saving || !draft.title.trim() || !draft.body.trim()}
        >
          <Save size={17} />
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
  </ModalShell>
);

type SettingsModalProps = {
  publicKey: string;
  subject: string;
  privateKeyConfigured: boolean;
  message: string;
  saving: boolean;
  onPublicKeyChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

export const SettingsModal = ({
  publicKey,
  subject,
  privateKeyConfigured,
  message,
  saving,
  onPublicKeyChange,
  onSubjectChange,
  onClose,
  onSave,
}: SettingsModalProps) => (
  <ModalShell onClose={onClose} labelledBy="notify-settings-title" className="notify-modal">
      <div className="admin-modal-header">
        <div>
          <h3 id="notify-settings-title">Teknik Bildirim Ayarları</h3>
          <p>Telefon bildirimleri için kullanılan VAPID yapılandırması.</p>
        </div>
        <button type="button" className="admin-modal-close" onClick={onClose} title="Kapat">
          <X size={18} />
        </button>
      </div>
      {message && <div className="feedback-status-message">{message}</div>}
      <div className="notify-form-grid">
        <label>
          VAPID Public Key
          <textarea
            className="form-control"
            rows={2}
            value={publicKey}
            onChange={event => onPublicKeyChange(event.target.value.trim())}
          />
        </label>
        <label>
          VAPID Private Key
          <div className="form-control">
            {privateKeyConfigured
              ? 'Sunucuda güvenli olarak yapılandırıldı'
              : 'Sunucu yapılandırması eksik'}
          </div>
        </label>
        <label>
          Gönderen Bilgisi
          <input
            className="form-control"
            value={subject}
            onChange={event => onSubjectChange(event.target.value)}
            placeholder="mailto:ik@firma.com"
          />
        </label>
      </div>
      <div className="admin-modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Kapat</button>
        <button type="button" className="btn-primary" onClick={onSave} disabled={saving}>
          <Save size={17} />
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
  </ModalShell>
);
