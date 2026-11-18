import { Calendar, Clock, Edit3, Search, Send, Trash2 } from 'lucide-react';
import { IconButton } from '../components/IconButton';
import { PaginationControls } from '../components/PaginationControls';
import type { PaginatedResponse } from '../types';
import type { EventTemplate, NotificationRoutine } from './types';

const StatusPill = ({ active }: { active: boolean }) => (
  <span className={`notify-pill ${active ? 'active' : 'passive'}`}>
    {active ? 'Aktif' : 'Pasif'}
  </span>
);

const DeliveryStatus = ({ delivery }: { delivery: EventTemplate['delivery'] }) => {
  if (!delivery) return null;
  const attempt = delivery.last_attempt;
  const time = (value: string) => new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' });
  if (!attempt) return <p className="notify-delivery-status">{delivery.last_processed_date
    ? `Son işlenen gün: ${delivery.last_processed_date}. Önceki sürümde cihaz gönderim sonucu kaydedilmiyordu.`
    : 'Henüz gönderim sonucu yok. Zamanlama Türkiye saatine göredir.'}</p>;
  const message = attempt.status === 'accepted' ? `${attempt.sent} cihaz için bildirim servisi kabul etti${attempt.failed ? `; ${attempt.failed} cihaz başarısız` : ''}. Bu bilgi okundu onayı değildir.`
    : attempt.status === 'no_devices' ? 'Gönderilebilecek aktif cihaz bulunamadı.'
      : attempt.status === 'failed' ? `Hiçbir cihaza gönderilemedi (${attempt.failed} başarısız).`
        : attempt.status === 'error' ? 'Gönderim sırasında hata oluştu. Sistem yeniden deneyecek.' : 'Gönderim atlandı.';
  return <p className="notify-delivery-status" role="status">Son deneme: {time(attempt.attempted_at)} · {message}{attempt.retry_at && ` Yeniden deneme: ${time(attempt.retry_at)} sonrası.`}</p>;
};

type TemplateSectionProps = {
  templates: EventTemplate[];
  pagination?: PaginatedResponse<EventTemplate>['pagination'];
  search: string;
  message: string;
  error: string;
  birthdaySending: boolean;
  onSearch: (value: string) => void;
  onPage: (page: number) => void;
  onEdit: (template: EventTemplate) => void;
  onSendBirthday: () => void;
};

export const EventTemplatesSection = ({
  templates, pagination, search, message, error, birthdaySending,
  onSearch, onPage, onEdit, onSendBirthday,
}: TemplateSectionProps) => (
  <section className="notify-section">
    <div className="notify-section-head">
      <div>
        <h3>Olay Bildirimleri</h3>
        <p>Modüllerdeki olaylarla otomatik gönderilen mesajlar.</p>
      </div>
      <label className="notify-search">
        <Search size={16} />
        <input
          value={search}
          onChange={event => onSearch(event.target.value)}
          placeholder="Bildirim ara"
        />
      </label>
    </div>
    {message && <div className="feedback-status-message">{message}</div>}
    {error && <div className="notify-empty">{error}</div>}
    <div className="notify-list">
      {templates.map(template => (
        <article key={template.key} className="notify-row-card">
          <div className="notify-row-main">
            <div className="notify-row-title">
              <strong>{template.label}</strong>
              <StatusPill active={template.enabled} />
              <span>{template.group}</span>
            </div>
            <p>{template.description}</p>
            <b>{template.title}</b>
            <small>{template.body}</small>
            <div className="notify-meta">
              {template.scheduled_time && (
                <span><Clock size={13} /> {template.scheduled_time}</span>
              )}
              <span>{template.url}</span>
            </div>
            <DeliveryStatus delivery={template.delivery} />
          </div>
          <div className="notify-row-actions">
            {template.key === 'birthday_today' && (
              <IconButton
                label="Şimdi gönder"
                className="notify-icon-btn"
                onClick={onSendBirthday}
                disabled={birthdaySending}
              >
                <Send size={15} />
              </IconButton>
            )}
            <IconButton label="Düzenle" className="notify-icon-btn" onClick={() => onEdit(template)}>
              <Edit3 size={15} />
            </IconButton>
          </div>
        </article>
      ))}
    </div>
    {pagination && <PaginationControls pagination={pagination} onPageChange={onPage} />}
  </section>
);

type RoutineSectionProps = {
  routines: NotificationRoutine[];
  pagination?: PaginatedResponse<NotificationRoutine>['pagination'];
  search: string;
  status: 'all' | 'active' | 'passive';
  message: string;
  error: string;
  loading: boolean;
  sending: boolean;
  deleting: boolean;
  onSearch: (value: string) => void;
  onStatus: (value: 'all' | 'active' | 'passive') => void;
  onPage: (page: number) => void;
  onEdit: (routine: NotificationRoutine) => void;
  onSend: (id: number) => void;
  onDelete: (id: number) => void;
};

export const RoutinesSection = ({
  routines, pagination, search, status, message, error, loading, sending,
  deleting, onSearch, onStatus, onPage, onEdit, onSend, onDelete,
}: RoutineSectionProps) => (
  <section className="notify-section">
    <div className="notify-section-head">
      <div>
        <h3>Rutinler</h3>
        <p>Belirli saatlerde otomatik gönderilecek bildirimler.</p>
      </div>
      <div className="notify-filter-row">
        <label className="notify-search">
          <Search size={16} />
          <input value={search} onChange={event => onSearch(event.target.value)} placeholder="Rutin ara" />
        </label>
        <select
          className="notify-status-filter"
          value={status}
          onChange={event => onStatus(event.target.value as typeof status)}
          aria-label="Rutin durumu"
        >
          <option value="all">Tüm durumlar</option>
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
        </select>
      </div>
    </div>
    {message && <div className="feedback-status-message">{message}</div>}
    {error && <div className="notify-empty">{error}</div>}
    <div className="notify-list">
      {!loading && routines.length === 0 ? (
        <div className="notify-empty">Bu filtreyle eşleşen rutin bulunamadı.</div>
      ) : routines.map(routine => (
        <article key={routine.id} className="notify-row-card">
          <div className="notify-row-main">
            <div className="notify-row-title">
              <strong>{routine.title}</strong>
              <StatusPill active={routine.is_active} />
            </div>
            <p>{routine.body}</p>
            <div className="notify-meta">
              <span><Clock size={14} /> {routine.scheduled_time}</span>
              <span>
                <Calendar size={14} />
                {routine.schedule_type === 'daily'
                  ? 'Her gün'
                  : (routine.scheduled_date || 'Tarih yok')}
              </span>
              <span>
                {routine.target === 'department'
                  ? `Departman: ${routine.department}`
                  : 'Tüm aboneler'}
              </span>
            </div>
          </div>
          <div className="notify-row-actions">
            <IconButton label="Hemen gönder" className="notify-icon-btn" onClick={() => onSend(routine.id)} disabled={sending}>
              <Send size={15} />
            </IconButton>
            <IconButton label="Düzenle" className="notify-icon-btn" onClick={() => onEdit(routine)}>
              <Edit3 size={15} />
            </IconButton>
            <IconButton label="Sil" className="notify-icon-btn danger" onClick={() => onDelete(routine.id)} disabled={deleting}>
              <Trash2 size={15} />
            </IconButton>
          </div>
        </article>
      ))}
    </div>
    {pagination && <PaginationControls pagination={pagination} onPageChange={onPage} />}
  </section>
);
