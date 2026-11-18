import type { FormEvent } from 'react';
import { Plus, UserPlus, X } from 'lucide-react';
import type { AdminUser, Permission, UserRole } from '../types';
import { FormField } from '../components/FormField';
import { ModalShell } from '../components/ModalShell';
import {
  ALL_MODULE_PERMISSION_IDS,
  MODULE_PERMISSIONS,
  type UserFormValues,
} from './userConfig';

interface UserFormModalProps {
  mode: 'create' | 'edit';
  values: UserFormValues;
  users: Array<Pick<AdminUser, 'id' | 'name' | 'employee_id'>>;
  departmentOptions: string[];
  positionOptions: string[];
  managerSearch: string;
  pending: boolean;
  onChange: (values: UserFormValues) => void;
  onManagerSearchChange: (value: string) => void;
  onManagerSelect: (managerId: string) => void;
  onOpenOption: (field: 'department' | 'position') => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

const clothingSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

export function UserFormModal({
  mode,
  values,
  users,
  departmentOptions,
  positionOptions,
  managerSearch,
  pending,
  onChange,
  onManagerSearchChange,
  onManagerSelect,
  onOpenOption,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const setField = <K extends keyof UserFormValues>(field: K, value: UserFormValues[K]) => {
    onChange({ ...values, [field]: value });
  };

  const setRole = (role: UserRole) => {
    onChange({
      ...values,
      role,
      permissions: role === 'admin' ? [...ALL_MODULE_PERMISSION_IDS] : values.permissions,
    });
  };

  const setPermission = (permission: Permission, checked: boolean) => {
    const permissions = checked
      ? [...new Set([...values.permissions, permission])]
      : values.permissions.filter((item) => item !== permission);
    setField('permissions', permissions);
  };

  const permissionPanel = (prefix: 'view_' | 'manage_', title: string, accented = false) => (
    <div className={`admin-user-permission-panel${accented ? ' is-accented' : ''}`}>
      <h4>
        {title}
      </h4>
      <div className="admin-user-permission-list">
        {MODULE_PERMISSIONS.filter(({ id }) => id.startsWith(prefix)).map((permission) => (
          <label key={permission.id} className="admin-user-permission">
            <input
              type="checkbox"
              checked={values.role === 'admin' || values.permissions.includes(permission.id)}
              disabled={values.role === 'admin'}
              onChange={(event) => setPermission(permission.id, event.target.checked)}
              className="admin-user-permission-checkbox"
            />
            {permission.label}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <ModalShell onClose={onClose} labelledBy="admin-user-form-title">
        <div className="admin-modal-header">
          <h2 id="admin-user-form-title" className="admin-user-form-title">
            <UserPlus size={24} color="var(--primary)" />
            {mode === 'create' ? 'Yeni Kullanıcı Tanımla' : 'Kullanıcı Bilgilerini Güncelle'}
          </h2>
          <button type="button" className="admin-modal-close" onClick={onClose} title="Kapat" aria-label="Kapat">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="responsive-grid-3">
            <FormField controlId="admin-user-employee-id" label="Sicil No" className="admin-user-field">
              <input
                id="admin-user-employee-id"
                className="form-control"
                value={values.employee_id}
                onChange={(event) => setField('employee_id', event.target.value.replace(/\D/g, ''))}
                required
              />
            </FormField>
            <FormField controlId="admin-user-name" label="Ad Soyad" className="admin-user-field">
              <input id="admin-user-name" className="form-control" value={values.name} onChange={(event) => setField('name', event.target.value)} required />
            </FormField>
            <FormField
              controlId="admin-user-password"
              label={mode === 'create' ? 'Şifre' : 'Yeni Şifre'}
              className="admin-user-field"
            >
              <input
                id="admin-user-password"
                className="form-control"
                type="password"
                value={values.password}
                onChange={(event) => setField('password', event.target.value)}
                required={mode === 'create'}
                minLength={10}
                placeholder={mode === 'edit' ? 'Değişmeyecekse boş bırakın' : undefined}
              />
            </FormField>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-department">Bölüm</label>
              <div className="select-add-row">
                <select id="admin-user-department" className="form-control" value={values.department} onChange={(event) => setField('department', event.target.value)} required={mode === 'create'}>
                  <option value="">Bölüm seçiniz</option>
                  {departmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <button type="button" className="btn-add-option" onClick={() => onOpenOption('department')} title="Yeni bölüm ekle" aria-label="Yeni bölüm ekle">
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-position">Pozisyon / Ünvan</label>
              <div className="select-add-row">
                <select id="admin-user-position" className="form-control" value={values.position} onChange={(event) => setField('position', event.target.value)}>
                  <option value="">Pozisyon seçiniz</option>
                  {positionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <button type="button" className="btn-add-option" onClick={() => onOpenOption('position')} title="Yeni pozisyon ekle" aria-label="Yeni pozisyon ekle">
                  <Plus size={18} />
                </button>
              </div>
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-manager-search">Üst Amir Ara</label>
              <input id="admin-user-manager-search" className="form-control" value={managerSearch} onChange={(event) => onManagerSearchChange(event.target.value)} placeholder="Ad, sicil, bölüm veya pozisyon" />
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-manager">Üst Amir</label>
              <select id="admin-user-manager" className="form-control" value={values.manager_id} onChange={(event) => { setField('manager_id', event.target.value); onManagerSelect(event.target.value); }}>
                <option value="">Üst amir seçilmedi</option>
                {users.map((manager) => (
                  <option key={manager.id} value={manager.id}>{manager.name}{manager.employee_id ? ` - #${manager.employee_id}` : ''}</option>
                ))}
              </select>
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-status">Durum</label>
              <select id="admin-user-status" className="form-control" value={values.status} onChange={(event) => setField('status', event.target.value === 'passive' ? 'passive' : 'active')}>
                <option value="active">Aktif</option>
                <option value="passive">Pasif</option>
              </select>
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-role">Rol</label>
              <select id="admin-user-role" className="form-control" value={values.role} onChange={(event) => setRole(event.target.value as UserRole)}>
                <option value="employee">Standart Kullanıcı</option>
                <option value="admin">Tam Yetkili Kullanıcı</option>
              </select>
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-email">E-Posta</label>
              <input id="admin-user-email" className="form-control" type="email" value={values.email} onChange={(event) => setField('email', event.target.value)} />
            </div>
            <div className="input-group admin-user-field admin-user-permissions">
              <label className="input-label admin-user-permissions-title">
                Sistem Yetkileri
              </label>
              <div className="responsive-grid-2 admin-user-permission-grid">
                {permissionPanel('view_', 'Çalışma Alanı Modülleri')}
                {permissionPanel('manage_', 'Ek İşlem Yetkileri', true)}
              </div>
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-phone">Telefon</label>
              <input id="admin-user-phone" className="form-control" value={values.phone} onChange={(event) => setField('phone', event.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-blood-type">Kan Grubu</label>
              <input id="admin-user-blood-type" className="form-control" value={values.blood_type} onChange={(event) => setField('blood_type', event.target.value)} />
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-birth-date">Doğum Tarihi</label>
              <input id="admin-user-birth-date" className="form-control" type="date" value={values.birth_date} onChange={(event) => setField('birth_date', event.target.value)} />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="admin-user-address">Ev Adresi</label>
              <textarea id="admin-user-address" className="form-control" value={values.address} onChange={(event) => setField('address', event.target.value)} rows={3} placeholder="Açık adresi giriniz" />
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-clothing-top">Üst Beden</label>
              <select id="admin-user-clothing-top" className="form-control" value={values.clothing_top} onChange={(event) => setField('clothing_top', event.target.value)}>
                <option value="">Seçiniz</option>
                {clothingSizes.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-clothing-bottom">Alt Beden</label>
              <select id="admin-user-clothing-bottom" className="form-control" value={values.clothing_bottom} onChange={(event) => setField('clothing_bottom', event.target.value)}>
                <option value="">Seçiniz</option>
                {clothingSizes.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-shoe-size">Ayakkabı No</label>
              <input id="admin-user-shoe-size" className="form-control" value={values.shoe_size} onChange={(event) => setField('shoe_size', event.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-emergency-name">Acil Durum Kişisi</label>
              <input id="admin-user-emergency-name" className="form-control" value={values.emergency_contact_name} onChange={(event) => setField('emergency_contact_name', event.target.value)} />
            </div>
            <div className="input-group admin-user-field">
              <label className="input-label" htmlFor="admin-user-emergency-phone">Acil Durum Tel</label>
              <input id="admin-user-emergency-phone" className="form-control" value={values.emergency_contact_phone} onChange={(event) => setField('emergency_contact_phone', event.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
          <div className="admin-modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel admin-user-modal-secondary">İptal</button>
            <button type="submit" className="btn-primary admin-user-modal-primary" disabled={pending}>
              {pending ? 'Kaydediliyor...' : mode === 'create' ? 'Kullanıcı Kaydet' : 'Değişiklikleri Kaydet'}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
