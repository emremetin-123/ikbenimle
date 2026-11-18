import { useState } from 'react';
import { Check, ChevronDown, Copy, KeyRound, ShieldCheck, X } from 'lucide-react';
import { ModalShell } from '../components/ModalShell';
import type { IntegrationApiKey, IntegrationScope } from './types';

const PERMISSION_OPTIONS: {
  scopes: IntegrationScope[];
  label: string;
  description: string;
}[] = [
  {
    scopes: ['employees:write'],
    label: 'Çalışanlar',
    description: 'Çalışan oluşturma, güncelleme ve pasife alma',
  },
  {
    scopes: ['leave-balances:write'],
    label: 'Kalan izin bakiyesi',
    description: 'Güncel izin bakiyesini portala aktarma',
  },
  {
    scopes: ['leave-requests:read', 'leave-requests:ack'],
    label: 'İzin talepleri',
    description: 'Talepleri alma ve aktarım sonucunu bildirme',
  },
  {
    scopes: ['payrolls:write'],
    label: 'Bordrolar',
    description: 'PDF bordroyu doğru çalışanın hesabına aktarma',
  },
];

const ALL_SCOPES = PERMISSION_OPTIONS.flatMap(option => option.scopes);

type Props = {
  createdKey: IntegrationApiKey | null;
  pending: boolean;
  error?: string;
  initialScopes?: IntegrationScope[];
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    scopes: IntegrationScope[];
    ip_allowlist: string[];
    expires_at: string | null;
  }) => void;
};

export function ApiKeyModal({ createdKey, pending, error, initialScopes, onClose, onCreate }: Props) {
  const [name, setName] = useState('Uygulama erişimi');
  const [scopes, setScopes] = useState<IntegrationScope[]>(initialScopes?.length ? initialScopes : ALL_SCOPES);
  const [ipAllowlist, setIpAllowlist] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');

  const togglePermission = (permissionScopes: IntegrationScope[]) => {
    const selected = permissionScopes.every(scope => scopes.includes(scope));
    setScopes(current => selected
      ? current.filter(scope => !permissionScopes.includes(scope))
      : Array.from(new Set([...current, ...permissionScopes])));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onCreate({
      name,
      scopes,
      ip_allowlist: ipAllowlist.split(/[\s,]+/).map(value => value.trim()).filter(Boolean),
      expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
    });
  };

  const copyToken = async () => {
    if (!createdKey?.token) return;
    try {
      await navigator.clipboard.writeText(createdKey.token);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError('Kopyalanamadı. Anahtarı seçip elle kopyalayın.');
    }
  };

  return (
    <ModalShell className="integration-key-modal" ariaLabel="Güvenli erişim anahtarı oluştur" onClose={onClose}>
      <div className="admin-modal-header">
        <div>
          <h3><KeyRound size={20} aria-hidden="true" /> {createdKey ? 'Erişim Anahtarı Hazır' : 'Güvenli Erişim Anahtarı'}</h3>
          <p>{createdKey ? 'Bu anahtar yalnızca şimdi gösterilir.' : 'Bağlanacak uygulamanın hangi bilgileri aktarabileceğini seçin.'}</p>
        </div>
        <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Kapat"><X size={18} aria-hidden="true" /></button>
      </div>

      {error && <p className="integration-inline-error" role="alert">{error}</p>}
      {copyError && <p className="integration-inline-error" role="alert">{copyError}</p>}
      {createdKey?.token ? (
        <div className="integration-token-result">
          <div className="integration-token-warning">
            Anahtarı güvenli parola kasasına kaydedin. Bu pencere kapatıldığında tekrar görüntülenemez.
          </div>
          <code>{createdKey.token}</code>
          <button type="button" className="btn-primary" onClick={copyToken}>
            {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
            {copied ? 'Kopyalandı' : 'Anahtarı kopyala'}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="integration-key-form">
          <label className="input-group">
            <span className="input-label">Anahtar adı</span>
            <input
              className="form-control"
              minLength={2}
              maxLength={120}
              value={name}
              onChange={event => setName(event.target.value)}
              required
            />
          </label>

          <fieldset className="integration-scope-fieldset">
            <legend>İzin verilen veri akışları</legend>
            {PERMISSION_OPTIONS.map(option => {
              const checked = option.scopes.every(scope => scopes.includes(scope));
              return (
                <label key={option.label}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePermission(option.scopes)}
                  />
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <details className="integration-advanced-settings">
            <summary><ShieldCheck size={17} aria-hidden="true" /> Gelişmiş güvenlik ayarları <ChevronDown size={16} aria-hidden="true" /></summary>
            <div>
              <label className="input-group">
                <span className="input-label">İzin verilen sabit IP adresleri</span>
                <textarea
                  className="form-control"
                  rows={2}
                  value={ipAllowlist}
                  onChange={event => setIpAllowlist(event.target.value)}
                  placeholder="Örn. 203.0.113.10"
                />
                <small>Boş bırakırsanız her IP adresinden bağlantı kurulabilir. Birden fazlaysa virgülle ayırın.</small>
              </label>
              <label className="input-group">
                <span className="input-label">Son kullanma tarihi</span>
                <input
                  className="form-control"
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={expiresAt}
                  onChange={event => setExpiresAt(event.target.value)}
                />
              </label>
            </div>
          </details>

          <div className="admin-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn-primary" disabled={pending || !scopes.length}>
              <KeyRound size={17} aria-hidden="true" /> {pending ? 'Oluşturuluyor...' : 'Anahtarı oluştur'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}
