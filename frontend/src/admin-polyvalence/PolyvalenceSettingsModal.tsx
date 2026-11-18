import { lazy, Suspense, useState } from 'react';
import { CalendarClock, Layers3, SlidersHorizontal, Users, X } from 'lucide-react';
import { ModalShell } from '../components/ModalShell';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { PolyvalenceFormModal } from './PolyvalenceFormModal';
import { boolValue } from './utils';
import type { AdminView, ModalKind, SetupResponse } from './types';

const CatalogPanel = lazy(() => import('./PolyvalenceCatalogPanel').then(module => ({ default: module.PolyvalenceCatalogPanel })));
const MembershipPanel = lazy(() => import('./PolyvalenceMembershipPanel').then(module => ({ default: module.PolyvalenceMembershipPanel })));
const StandardsPanel = lazy(() => import('./PolyvalenceStandardsPanel').then(module => ({ default: module.PolyvalenceStandardsPanel })));
const tabs = [
  ['definitions', Layers3, 'Beceriler ve Hedefler'],
  ['members', Users, 'Çalışan Eşleşmeleri'],
  ['standards', CalendarClock, 'Değerlendirme Takvimi'],
  ['levels', SlidersHorizontal, 'Seviye Tanımları'],
] as const;

type Props = {
  setup: SetupResponse;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function PolyvalenceSettingsModal(props: Props) {
  const [view, setView] = useState<Exclude<AdminView, 'periods'>>('definitions');
  const [departmentId, setDepartmentId] = useState(0);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const departments = props.setup.departments.filter(item => !boolValue(item.is_archived));
  const selectedDepartmentId = departments.some(item => item.id === departmentId) ? departmentId : departments[0]?.id || 0;
  const openModal = (kind: ModalKind, item?: Record<string, unknown>) => { setEditing(item || null); setModal(kind); setError(''); };
  const closeModal = () => { setModal(null); setEditing(null); };

  return <>
    <ModalShell ariaLabel="Polivalans Ayarları" onClose={props.onClose} overlayClassName="admin-modal-overlay poly-settings-overlay" surfaceClassName="poly-workspace poly-settings-modal">
      <header className="poly-settings-heading"><div><h2>Polivalans Ayarları</h2><p>Bölüm becerileri, çalışan eşleşmeleri ve değerlendirme düzeni.</p></div>
        <button type="button" className="poly-icon-button" aria-label="Polivalans ayarlarını kapat" onClick={props.onClose}><X size={20} /></button>
      </header>
      <nav className="poly-workspace-nav poly-settings-nav" aria-label="Polivalans ayar bölümleri">
        {tabs.map(([key, Icon, label]) => <button type="button" key={key} aria-current={view === key ? 'page' : undefined} onClick={() => { setView(key); setError(''); }}><Icon size={17} aria-hidden="true" /><span>{label}</span></button>)}
      </nav>
      <div className="poly-settings-content">
        {props.loading ? <LoadingIndicator label="Polivalans ayarları yükleniyor" /> : props.error ? <div className="poly-alert" role="alert">{props.error}<button type="button" onClick={props.onRetry}>Tekrar dene</button></div> : <>
          {(view === 'definitions' || view === 'standards') && <div className="poly-settings-context"><label className="poly-field">Bölüm
            <select aria-label="Bölüm" value={selectedDepartmentId} onChange={event => setDepartmentId(Number(event.target.value))}>
              {!departments.length && <option value="0">Bölüm bulunmuyor</option>}
              {departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label></div>}
          {error && <div className="poly-alert" role="alert">{error}<button type="button" aria-label="Ayar uyarısını kapat" onClick={() => setError('')}><X size={16} /></button></div>}
          <Suspense fallback={<LoadingIndicator compact label="Ayar bölümü hazırlanıyor" />}>
            {view === 'definitions' && <CatalogPanel setup={props.setup} departmentId={selectedDepartmentId} onOpenModal={openModal} onError={setError} />}
            {view === 'members' && <MembershipPanel setup={props.setup} onOpenModal={openModal} onError={setError} />}
            {(view === 'standards' || view === 'levels') && <StandardsPanel setup={props.setup} departmentId={selectedDepartmentId} mode={view === 'levels' ? 'levels' : 'schedules'} onOpenModal={openModal} onError={setError} />}
          </Suspense>
        </>}
      </div>
    </ModalShell>
    {modal && <PolyvalenceFormModal kind={modal} editing={editing} setup={props.setup} definitionDepartmentId={selectedDepartmentId} targetDepartmentId={selectedDepartmentId} onClose={closeModal} onSaved={props.onSaved} onError={setError} />}
  </>;
}
