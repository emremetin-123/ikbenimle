import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  ListTodo,
  Pencil,
  Pin,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { queryKeys } from '../../queryClient';
import { api } from '../../services/api';
import type { PersonalReminder } from '../../types';
import { useAppFeedback } from '../AppFeedback';
import { usePersonalReminders } from './usePersonalReminders';

type ReminderUpdate = Pick<PersonalReminder, 'text' | 'completed' | 'pinned'>;

export function ReminderWidget() {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [completedOpen, setCompletedOpen] = useState(false);

  const remindersQuery = usePersonalReminders();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.personalReminders });
  const createMutation = useMutation({
    mutationFn: (text: string) => api.post<PersonalReminder>('/api/reminders', { text }),
    onSuccess: async () => {
      setNewText('');
      setAdding(false);
      await refresh();
    },
    onError: (error: Error) => feedback.notifyError(error.message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<ReminderUpdate> }) =>
      api.put<PersonalReminder>(`/api/reminders/${id}`, body),
    onSuccess: async () => {
      setEditingId(null);
      setEditingText('');
      await refresh();
    },
    onError: (error: Error) => feedback.notifyError(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/api/reminders/${id}`),
    onSuccess: refresh,
    onError: (error: Error) => feedback.notifyError(error.message),
  });

  const reminders = remindersQuery.data?.items || [];
  const activeReminders = reminders.filter(reminder => !reminder.completed);
  const completedReminders = reminders.filter(reminder => reminder.completed);
  const busy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const addReminder = (event: FormEvent) => {
    event.preventDefault();
    const text = newText.trim();
    if (text) createMutation.mutate(text);
  };

  const saveEdit = (event: FormEvent, reminder: PersonalReminder) => {
    event.preventDefault();
    const text = editingText.trim();
    if (text && text !== reminder.text) {
      updateMutation.mutate({ id: reminder.id, body: { text } });
      return;
    }
    setEditingId(null);
  };

  const startEditing = (reminder: PersonalReminder) => {
    setEditingId(reminder.id);
    setEditingText(reminder.text);
  };

  const renderReminder = (reminder: PersonalReminder) => (
    <div key={reminder.id} className={`personal-reminder-row ${reminder.completed ? 'is-completed' : ''}`}>
      <input
        type="checkbox"
        checked={reminder.completed}
        disabled={busy}
        aria-label={`${reminder.text} hatırlatmasını ${reminder.completed ? 'yeniden aç' : 'tamamla'}`}
        onChange={() => updateMutation.mutate({
          id: reminder.id,
          body: { completed: !reminder.completed },
        })}
      />
      {editingId === reminder.id ? (
        <form className="personal-reminder-edit-form" onSubmit={event => saveEdit(event, reminder)}>
          <input
            autoFocus
            maxLength={300}
            value={editingText}
            aria-label="Hatırlatma metnini düzenle"
            onChange={event => setEditingText(event.target.value)}
          />
          <button type="submit" className="personal-reminder-icon-button" title="Kaydet" aria-label="Kaydet" disabled={busy}>
            <Save size={16} />
          </button>
          <button type="button" className="personal-reminder-icon-button" title="Vazgeç" aria-label="Vazgeç" onClick={() => setEditingId(null)}>
            <X size={16} />
          </button>
        </form>
      ) : (
        <span className="personal-reminder-text">{reminder.text}</span>
      )}
      {editingId !== reminder.id && (
        <>
          <button
            type="button"
            className={`personal-reminder-pin ${reminder.pinned ? 'is-pinned' : ''}`}
            title={reminder.pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
            aria-label={reminder.pinned ? 'Sabitlemeyi kaldır' : 'Hatırlatmayı sabitle'}
            aria-pressed={reminder.pinned}
            disabled={busy}
            onClick={() => updateMutation.mutate({
              id: reminder.id,
              body: { pinned: !reminder.pinned },
            })}
          >
            <Pin size={15} fill={reminder.pinned ? 'currentColor' : 'none'} />
          </button>
          <details className="personal-reminder-menu">
            <summary aria-label={`${reminder.text} seçenekleri`}>
              <Ellipsis size={18} />
            </summary>
            <div className="personal-reminder-menu-popover">
              <button type="button" onClick={() => startEditing(reminder)}>
                <Pencil size={15} /> Düzenle
              </button>
              <button
                type="button"
                className="danger"
                onClick={async () => {
                  const accepted = await feedback.confirm({
                    title: 'Hatırlatmayı sil',
                    message: 'Bu hatırlatma kalıcı olarak silinecek.',
                    confirmLabel: 'Sil',
                    danger: true,
                  });
                  if (accepted) deleteMutation.mutate(reminder.id);
                }}
              >
                <Trash2 size={15} /> Sil
              </button>
            </div>
          </details>
        </>
      )}
    </div>
  );

  return (
    <section id="home-reminders" tabIndex={-1} className="home-surface personal-reminders-widget" aria-labelledby="personal-reminders-title">
      <div className="personal-reminders-header">
        <h3 id="personal-reminders-title">
          <span className="personal-reminders-title-icon" aria-hidden="true">
            <ListTodo size={17} />
          </span>
          Hatırlatmalarım
        </h3>
      </div>

      <div className="personal-reminder-composer">
        {adding ? (
          <form className="personal-reminder-add-form" onSubmit={addReminder}>
            <input
              autoFocus
              maxLength={300}
              value={newText}
              placeholder="Hatırlatma yazın..."
              aria-label="Yeni hatırlatma"
              onChange={event => setNewText(event.target.value)}
            />
            <button type="submit" className="personal-reminder-icon-button primary" title="Ekle" aria-label="Hatırlatmayı ekle" disabled={busy || !newText.trim()}>
              <Check size={17} />
            </button>
            <button type="button" className="personal-reminder-icon-button" title="Vazgeç" aria-label="Vazgeç" onClick={() => { setAdding(false); setNewText(''); }}>
              <X size={17} />
            </button>
          </form>
        ) : (
          <button type="button" className="personal-reminder-add-button" onClick={() => setAdding(true)}>
            <Plus size={16} /> Görev Ekle
          </button>
        )}
      </div>

      {remindersQuery.isLoading ? (
        <p className="personal-reminders-state">Hatırlatmalar yükleniyor...</p>
      ) : remindersQuery.isError ? (
        <p className="personal-reminders-state error">Hatırlatmalar yüklenemedi.</p>
      ) : reminders.length === 0 ? (
        <p className="personal-reminders-state">Henüz hatırlatma eklemediniz.</p>
      ) : (
        <>
          {activeReminders.length > 0 && (
            <div className="personal-reminder-list">{activeReminders.map(renderReminder)}</div>
          )}
          {completedReminders.length > 0 && (
            <div className="personal-reminders-completed">
              <button
                type="button"
                className="personal-reminders-completed-toggle"
                aria-expanded={completedOpen}
                onClick={() => setCompletedOpen(value => !value)}
              >
                {completedOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                Tamamlananlar ({completedReminders.length})
              </button>
              {completedOpen && (
                <div className="personal-reminder-list completed">
                  {completedReminders.map(renderReminder)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
