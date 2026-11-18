import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarCheck,
  FileText,
  Save,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import type { ConnectionDraft } from './types';

type Props = {
  draft: ConnectionDraft;
  isSaved: boolean;
  pending: boolean;
  onChange: (draft: ConnectionDraft) => void;
  onSubmit: () => void;
};

type ToggleField = 'employee_sync_enabled' | 'leave_balance_sync_enabled' | 'leave_request_export_enabled';

const setToggle = (
  draft: ConnectionDraft,
  field: ToggleField,
  checked: boolean,
): ConnectionDraft => ({ ...draft, [field]: checked });

export function IntegrationFlows({ draft, isSaved, pending, onChange, onSubmit }: Props) {
  return (
    <form
      className="premium-card integration-config-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="integration-section-heading">
        <div>
          <span className="integration-eyebrow">1. Veri akışları</span>
          <h2>{isSaved ? 'Bağlantı ayarları' : 'Yeni bağlantı'}</h2>
          <p>Hangi bilgilerin hangi yönde aktarılacağını seçin.</p>
        </div>
        <StatusBadge tone={draft.is_enabled ? 'success' : 'neutral'}>
          {draft.is_enabled ? 'Bağlantı açık' : 'Bağlantı kapalı'}
        </StatusBadge>
      </div>

      <div className="integration-connection-fields">
        <label className="input-group">
          <span className="input-label">Bağlantı adı</span>
          <input
            className="form-control"
            aria-label="Bağlantı adı"
            minLength={2}
            maxLength={120}
            placeholder="Örn. Bordro ve İK programı"
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            required
          />
          <small>Bağlayacağınız uygulamayı kolayca tanıyacağınız bir ad yazın.</small>
        </label>

        <label className="integration-master-toggle">
          <span>
            <strong>Bağlantıyı etkinleştir</strong>
            <small>Kapalıyken bu bağlantıdan veri alınmaz ve izin talebi gönderilmez.</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            aria-label="Bağlantıyı etkinleştir"
            checked={draft.is_enabled}
            onChange={(event) => onChange({ ...draft, is_enabled: event.target.checked })}
          />
          <span className="integration-switch-control" aria-hidden="true" />
        </label>
      </div>

      <div className="integration-flow-heading">
        <div>
          <h3>Aktarılacak bilgiler</h3>
          <p>Tüm İK ve bordro uygulamaları aynı bağlantı yapısını kullanır.</p>
        </div>
      </div>

      <div className="integration-flow-grid">
        <article className={`integration-flow-option${draft.employee_sync_enabled ? ' is-enabled' : ''}`}>
          <div className="integration-flow-icon" aria-hidden="true"><UsersRound size={21} /></div>
          <div className="integration-flow-copy">
            <span className="integration-direction"><ArrowDownToLine size={14} aria-hidden="true" /> Diğer uygulamadan portala</span>
            <h3>Çalışanlar</h3>
            <p>Yeni çalışanı oluşturur, bilgileri günceller; ayrılan çalışanı güvenli biçimde pasife alır.</p>
          </div>
          <label className="integration-flow-toggle">
            <span className="sr-only">Çalışan aktarımını aç veya kapat</span>
            <input
              type="checkbox"
              role="switch"
              checked={draft.employee_sync_enabled}
              onChange={(event) => onChange(setToggle(draft, 'employee_sync_enabled', event.target.checked))}
            />
            <span className="integration-switch-control" aria-hidden="true" />
          </label>
        </article>

        <article className={`integration-flow-option${draft.leave_balance_sync_enabled ? ' is-enabled' : ''}`}>
          <div className="integration-flow-icon" aria-hidden="true"><WalletCards size={21} /></div>
          <div className="integration-flow-copy">
            <span className="integration-direction"><ArrowDownToLine size={14} aria-hidden="true" /> Diğer uygulamadan portala</span>
            <h3>Kalan izin bakiyesi</h3>
            <p>Karşı uygulamadaki güncel kalan izin gününü doğru çalışanın portalında gösterir.</p>
          </div>
          <label className="integration-flow-toggle">
            <span className="sr-only">İzin bakiyesi aktarımını aç veya kapat</span>
            <input
              type="checkbox"
              role="switch"
              checked={draft.leave_balance_sync_enabled}
              onChange={(event) => onChange(setToggle(draft, 'leave_balance_sync_enabled', event.target.checked))}
            />
            <span className="integration-switch-control" aria-hidden="true" />
          </label>
        </article>

        <article className={`integration-flow-option integration-flow-option--leave${draft.leave_request_export_enabled ? ' is-enabled' : ''}`}>
          <div className="integration-flow-icon" aria-hidden="true"><CalendarCheck size={21} /></div>
          <div className="integration-flow-copy">
            <span className="integration-direction"><ArrowUpFromLine size={14} aria-hidden="true" /> Portaldan diğer uygulamaya</span>
            <h3>İzin talepleri</h3>
            <p>Portalda açılan talebi gönderir; karşı uygulamadaki kayıt numarasını ve aktarım sonucunu geri alır.</p>
          </div>
          <label className="integration-flow-toggle">
            <span className="sr-only">İzin talebi aktarımını aç veya kapat</span>
            <input
              type="checkbox"
              role="switch"
              checked={draft.leave_request_export_enabled}
              onChange={(event) => onChange(setToggle(draft, 'leave_request_export_enabled', event.target.checked))}
            />
            <span className="integration-switch-control" aria-hidden="true" />
          </label>
          {draft.leave_request_export_enabled && (
            <label className="integration-trigger-field">
              <span>Ne zaman gönderilsin?</span>
              <select
                className="form-control"
                aria-label="Ne zaman gönderilsin?"
                value={draft.leave_export_trigger}
                onChange={(event) => onChange({
                  ...draft,
                  leave_export_trigger: event.target.value as ConnectionDraft['leave_export_trigger'],
                })}
              >
                <option value="created">Çalışan talebi oluşturunca</option>
                <option value="approved">Portalda onaylanınca</option>
              </select>
            </label>
          )}
        </article>

        <article className="integration-flow-option is-enabled is-managed-by-key">
          <div className="integration-flow-icon" aria-hidden="true"><FileText size={21} /></div>
          <div className="integration-flow-copy">
            <span className="integration-direction"><ArrowDownToLine size={14} aria-hidden="true" /> Diğer uygulamadan portala</span>
            <h3>Bordrolar</h3>
            <p>PDF bordroyu sicil eşleşmesiyle aynı çalışanın “Bordrolarım” alanına aktarır.</p>
          </div>
          <StatusBadge tone="info">Anahtarla açılır</StatusBadge>
        </article>
      </div>

      <div className="integration-form-footer">
        <p>Çalışan kayıtları geçmiş veriyi korumak için silinmez; karşı uygulamada ayrılan çalışan portalda pasife alınır.</p>
        <button type="submit" className="btn-primary integration-save" disabled={pending}>
          <Save size={17} aria-hidden="true" /> {pending ? 'Kaydediliyor...' : isSaved ? 'Değişiklikleri kaydet' : 'Bağlantıyı oluştur'}
        </button>
      </div>
    </form>
  );
}
