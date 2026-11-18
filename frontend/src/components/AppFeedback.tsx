import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { ModalShell } from './ModalShell';
/* eslint-disable react-refresh/only-export-components */

type FeedbackTone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: FeedbackTone };
type ConfirmOptions = { title?: string; message: string; confirmLabel?: string; danger?: boolean };
type PromptOptions = { title: string; message?: string; label?: string; initialValue?: string; confirmLabel?: string; required?: boolean };

type AppFeedbackContextValue = {
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  notifyInfo: (message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const AppFeedbackContext = createContext<AppFeedbackContextValue | null>(null);

export function AppFeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null);
  const [promptState, setPromptState] = useState<PromptOptions | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const sequence = useRef(0);
  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const promptResolver = useRef<((value: string | null) => void) | null>(null);

  const notify = useCallback((tone: FeedbackTone, message: string) => {
    const id = ++sequence.current;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4500);
  }, []);

  const closeConfirm = useCallback((result: boolean) => {
    confirmResolver.current?.(result);
    confirmResolver.current = null;
    setConfirmState(null);
  }, []);

  const closePrompt = useCallback((result: string | null) => {
    promptResolver.current?.(result);
    promptResolver.current = null;
    setPromptState(null);
  }, []);

  const value = useMemo<AppFeedbackContextValue>(() => ({
    notifySuccess: (message) => notify('success', message),
    notifyError: (message) => notify('error', message),
    notifyInfo: (message) => notify('info', message),
    confirm: (options) => new Promise<boolean>((resolve) => {
      confirmResolver.current?.(false);
      confirmResolver.current = resolve;
      setConfirmState(options);
    }),
    prompt: (options) => new Promise<string | null>((resolve) => {
      promptResolver.current?.(null);
      promptResolver.current = resolve;
      setPromptValue(options.initialValue || '');
      setPromptState(options);
    }),
  }), [notify]);

  return (
    <AppFeedbackContext.Provider value={value}>
      {children}
      <div className="app-toast-region" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CheckCircle2 : toast.tone === 'error' ? XCircle : Info;
          return (
            <div key={toast.id} className={`app-toast is-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
              <Icon size={20} aria-hidden="true" />
              <span>{toast.message}</span>
              <button type="button" aria-label="Bildirimi kapat" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
                <X size={18} />
              </button>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <ModalShell className="app-feedback-dialog" labelledBy="app-confirm-title" onClose={() => closeConfirm(false)}>
          <div className={`app-feedback-dialog-icon ${confirmState.danger ? 'is-danger' : 'is-info'}`} aria-hidden="true">
            <AlertTriangle size={24} />
          </div>
          <h2 id="app-confirm-title">{confirmState.title || 'İşlemi onaylayın'}</h2>
          <p>{confirmState.message}</p>
          <div className="admin-modal-actions app-feedback-dialog-actions">
            <button type="button" className="btn-secondary" onClick={() => closeConfirm(false)}>Vazgeç</button>
            <button type="button" className={confirmState.danger ? 'btn-danger' : 'btn-primary'} onClick={() => closeConfirm(true)}>
              {confirmState.confirmLabel || 'Onayla'}
            </button>
          </div>
        </ModalShell>
      )}

      {promptState && (
        <ModalShell className="app-feedback-dialog" labelledBy="app-prompt-title" onClose={() => closePrompt(null)}>
          <h2 id="app-prompt-title">{promptState.title}</h2>
          {promptState.message && <p>{promptState.message}</p>}
          <label className="input-group" htmlFor="app-prompt-input">
            <span className="input-label">{promptState.label || 'Açıklama'}</span>
            <textarea id="app-prompt-input" className="form-control" rows={3} value={promptValue} onChange={(event) => setPromptValue(event.target.value)} />
          </label>
          <div className="admin-modal-actions app-feedback-dialog-actions">
            <button type="button" className="btn-secondary" onClick={() => closePrompt(null)}>Vazgeç</button>
            <button
              type="button"
              className="btn-primary"
              disabled={Boolean(promptState.required && !promptValue.trim())}
              onClick={() => closePrompt(promptValue.trim())}
            >
              {promptState.confirmLabel || 'Kaydet'}
            </button>
          </div>
        </ModalShell>
      )}
    </AppFeedbackContext.Provider>
  );
}

export function useAppFeedback() {
  const context = useContext(AppFeedbackContext);
  if (!context) throw new Error('useAppFeedback must be used within AppFeedbackProvider');
  return context;
}
