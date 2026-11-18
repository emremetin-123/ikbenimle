import { useDeferredValue, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Power, UserPlus, Users } from 'lucide-react';
import { ExportExcelButton } from './components/ExportExcelButton';
import { PaginationControls } from './components/PaginationControls';
import { FilterBar } from './components/FilterBar';
import { PageHeader } from './components/PageHeader';
import { Toolbar } from './components/Toolbar';
import { StatusBadge } from './components/StatusBadge';
import { api } from './services/api';
import { queryKeys } from './queryClient';
import type { AdminUser } from './types';
import { UserFormModal } from './admin-users/UserFormModal';
import { UserOptionModal } from './admin-users/UserOptionModal';
import { useAppFeedback } from './components/AppFeedback';
import { LoadingIndicator } from './components/LoadingIndicator';
import {
  createEmptyUserForm,
  isUserActive,
  userToFormValues,
  type UserFormValues,
} from './admin-users/userConfig';

type OptionField = 'department' | 'position';

interface OptionModalState {
  field: OptionField;
  value: string;
}

interface UpdateUserInput {
  id: number;
  values: UserFormValues;
}

const EMPTY_USERS: AdminUser[] = [];
const normalizeSearch = (value: string) => value.toLocaleLowerCase('tr-TR').trim();

export function AdminUsers() {
  const queryClient = useQueryClient();
  const feedback = useAppFeedback();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<UserFormValues>(createEmptyUserForm);
  const [customDepartments, setCustomDepartments] = useState<string[]>([]);
  const [customPositions, setCustomPositions] = useState<string[]>([]);
  const [optionModal, setOptionModal] = useState<OptionModalState | null>(null);
  const [managerSearch, setManagerSearch] = useState('');
  const [selectedManagerOption, setSelectedManagerOption] = useState<Pick<AdminUser, 'id' | 'name' | 'employee_id'> | null>(null);
  const deferredManagerSearch = useDeferredValue(managerSearch.trim());

  const usersQuery = useQuery({
    queryKey: [...queryKeys.adminUsers, { page, search: deferredSearch }],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        sort: 'name',
        order: 'asc',
      });
      if (deferredSearch) params.set('search', deferredSearch);
      return api.list<AdminUser>(`/api/admin/users?${params.toString()}`);
    },
    placeholderData: (previous) => previous,
  });
  const userOptionsQuery = useQuery({
    queryKey: [...queryKeys.adminUserOptions, deferredManagerSearch],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', pageSize: '100' });
      if (deferredManagerSearch) params.set('search', deferredManagerSearch);
      return api.list<AdminUser>(`/api/admin/users/options?${params.toString()}`);
    },
    staleTime: 5 * 60_000,
    enabled: formMode !== null,
  });
  const formOptionsQuery = useQuery({
    queryKey: [...queryKeys.adminUserOptions, 'form-options'],
    queryFn: () => api.get<{ departments: string[]; positions: string[] }>('/api/admin/users/form-options'),
    staleTime: 5 * 60_000,
    enabled: formMode !== null,
  });
  const users = usersQuery.data?.items || EMPTY_USERS;
  const userOptions = userOptionsQuery.data?.items || EMPTY_USERS;

  const invalidateUsers = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUsers }),
      queryClient.invalidateQueries({ queryKey: queryKeys.adminUserOptions }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (values: UserFormValues) => api.post<unknown>('/api/admin/users', { ...values }),
    onSuccess: async () => {
      await invalidateUsers();
      setFormMode(null);
      setFormValues(createEmptyUserForm());
      feedback.notifySuccess('Kullanıcı başarıyla oluşturuldu.');
    },
    onError: (error: Error) => feedback.notifyError(`Kullanıcı oluşturulamadı: ${error.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: UpdateUserInput) => api.put<unknown>(`/api/admin/users/${id}`, { ...values }),
    onSuccess: async () => {
      await invalidateUsers();
      setFormMode(null);
      setEditingUserId(null);
      setFormValues(createEmptyUserForm());
      feedback.notifySuccess('Kullanıcı bilgileri güncellendi.');
    },
    onError: (error: Error) => feedback.notifyError(`Kullanıcı güncellenemedi: ${error.message}`),
  });

  const statusMutation = useMutation({
    mutationFn: ({ user, status }: { user: AdminUser; status: 'active' | 'passive' }) => (
      api.put<unknown>(`/api/admin/users/${user.id}`, {
        ...userToFormValues(user),
        status,
      })
    ),
    onSuccess: async (_data, variables) => {
      await invalidateUsers();
      feedback.notifySuccess(variables.status === 'passive' ? 'Kullanıcı pasife alındı.' : 'Kullanıcı aktif hale getirildi.');
    },
    onError: (error: Error) => feedback.notifyError(`Kullanıcı durumu güncellenemedi: ${error.message}`),
  });

  const buildOptionList = (field: OptionField, currentValue = '') => {
    const userValues = field === 'department'
      ? (formOptionsQuery.data?.departments || [])
      : (formOptionsQuery.data?.positions || []);
    const customValues = field === 'department' ? customDepartments : customPositions;
    return [...new Set([...userValues, ...customValues, currentValue.trim()].filter(Boolean))]
      .sort((first, second) => first.localeCompare(second, 'tr'));
  };

  const departmentOptions = buildOptionList('department', formValues.department);
  const positionOptions = buildOptionList('position', formValues.position);
  const managerOptions: Array<Pick<AdminUser, 'id' | 'name' | 'employee_id'>> = userOptions.filter((user) => (
    user.id !== editingUserId
    && (isUserActive(user) || String(user.id) === formValues.manager_id)
  ));
  if (selectedManagerOption && !managerOptions.some(user => user.id === selectedManagerOption.id)) {
    managerOptions.unshift(selectedManagerOption);
  }

  const openCreateForm = () => {
    setEditingUserId(null);
    setFormValues(createEmptyUserForm());
    setManagerSearch('');
    setSelectedManagerOption(null);
    setFormMode('create');
  };

  const openEditForm = (user: AdminUser) => {
    setEditingUserId(user.id);
    setFormValues(userToFormValues(user));
    setManagerSearch('');
    setSelectedManagerOption(user.manager_id && user.manager_name ? {
      id: Number(user.manager_id),
      name: user.manager_name,
      employee_id: ''
    } : null);
    setFormMode('edit');
  };

  const closeForm = () => {
    if (createMutation.isPending || updateMutation.isPending) return;
    setFormMode(null);
    setEditingUserId(null);
    setOptionModal(null);
  };

  const submitForm = (event: FormEvent) => {
    event.preventDefault();
    if (formMode === 'create') {
      createMutation.mutate(formValues);
      return;
    }
    if (formMode === 'edit' && editingUserId !== null) {
      updateMutation.mutate({ id: editingUserId, values: formValues });
    }
  };

  const toggleUserStatus = async (user: AdminUser) => {
    const status = isUserActive(user) ? 'passive' : 'active';
    const message = status === 'passive'
      ? 'Bu kullanıcı pasife alınacak ve giriş yapamayacak. Emin misiniz?'
      : 'Bu kullanıcı tekrar aktif hale getirilecek. Emin misiniz?';
    if (await feedback.confirm({
      title: status === 'passive' ? 'Kullanıcıyı pasife al' : 'Kullanıcıyı aktifleştir',
      message,
      confirmLabel: status === 'passive' ? 'Pasife Al' : 'Aktifleştir',
      danger: status === 'passive',
    })) statusMutation.mutate({ user, status });
  };

  const isOptionInUse = (field: OptionField, value: string) => {
    const normalized = normalizeSearch(value);
    const values = field === 'department'
      ? (formOptionsQuery.data?.departments || [])
      : (formOptionsQuery.data?.positions || []);
    return values.some((item) => normalizeSearch(item) === normalized);
  };

  const addOption = () => {
    if (!optionModal) return;
    const value = optionModal.value.trim();
    if (!value) return;
    if (optionModal.field === 'department') {
      setCustomDepartments((current) => current.includes(value) ? current : [...current, value]);
      setFormValues((current) => ({ ...current, department: value }));
    } else {
      setCustomPositions((current) => current.includes(value) ? current : [...current, value]);
      setFormValues((current) => ({ ...current, position: value }));
    }
    setOptionModal(null);
  };

  const removeOption = (field: OptionField, value: string) => {
    if (isOptionInUse(field, value)) {
      feedback.notifyInfo('Bu değer bir kullanıcıda kayıtlı olduğu için kaldırılamaz. Önce ilgili kullanıcı kaydını güncelleyin.');
      return;
    }
    if (field === 'department') {
      setCustomDepartments((current) => current.filter((item) => item !== value));
      setFormValues((current) => current.department === value ? { ...current, department: '' } : current);
    } else {
      setCustomPositions((current) => current.filter((item) => item !== value));
      setFormValues((current) => current.position === value ? { ...current, position: '' } : current);
    }
  };

  const exportUsers = async () => {
    const allUsers = await api.listAll<AdminUser>('/api/admin/users?sort=name&order=asc');
    if (!allUsers.length) {
      feedback.notifyInfo('Dışa aktarılacak kullanıcı bulunamadı.');
      return;
    }
    const headers = ['Ad Soyad', 'Sicil No', 'Bölüm', 'Pozisyon', 'Üst Amir', 'Durum', 'Rol', 'Telefon', 'E-Posta', 'Kan Grubu', 'Doğum Tarihi', 'Adres', 'Acil Durum Kişi', 'Acil Durum Tel', 'Üst Beden', 'Alt Beden', 'Ayakkabı No'];
    const rows = allUsers.map((user) => [
      user.name,
      user.employee_id,
      user.department || '-',
      user.position || '-',
      user.manager_name || '-',
      isUserActive(user) ? 'Aktif' : 'Pasif',
      user.role,
      user.phone || '-',
      user.email || '-',
      user.blood_type || '-',
      user.birth_date || '-',
      (user.address || '-').replace(/(\r\n|\n|\r)/gm, ' '),
      user.emergency_contact_name || '-',
      user.emergency_contact_phone || '-',
      user.clothing_top || '-',
      user.clothing_bottom || '-',
      user.shoe_size || '-',
    ].join(';'));
    const blob = new Blob([`\uFEFF${[headers.join(';'), ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Kullanıcı_Listesi_${new Date().toLocaleDateString('tr-TR')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        className="admin-users-header-card"
        icon={<Users size={24} color="var(--primary)" />}
        title="Mevcut Kullanıcılar"
        description="Kullanıcıları arayın, düzenleyin veya yeni kullanıcı ekleyin."
        actions={
          <>
            <button type="button" className="btn-primary admin-users-create" onClick={openCreateForm}>
              <UserPlus size={18} /> Yeni Kullanıcı Ekle
            </button>
            <ExportExcelButton className="module-desktop-only" onClick={() => void exportUsers()} />
          </>
        }
      />

      <div className="premium-card admin-users-list-card">
        <Toolbar className="admin-users-toolbar">
          <h3>Kullanıcı Listesi</h3>
          <FilterBar ariaLabel="Kullanıcı filtreleri">
            <input className="form-control admin-users-search" aria-label="Kullanıcı ara" placeholder="Kullanıcı ara..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
          </FilterBar>
        </Toolbar>
        <div className="module-mobile-only admin-users-list-export">
          <ExportExcelButton onClick={() => void exportUsers()} />
        </div>
        {usersQuery.isLoading ? (
          <LoadingIndicator compact label="Kullanıcılar yükleniyor" />
        ) : usersQuery.isError ? (
          <div className="admin-users-error">
            <p>Kullanıcılar yüklenemedi.</p>
            <button type="button" className="btn-primary" onClick={() => usersQuery.refetch()}>Tekrar Dene</button>
          </div>
        ) : (
          <div className="table-container" role="region" aria-label="Kullanıcı listesi" tabIndex={0}>
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Personel</th>
                  <th>Sicil / Bölüm / Pozisyon</th>
                  <th className="admin-users-actions-cell">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="table-row-hover">
                    <td>
                      <div className="admin-users-name">{user.name}</div>
                      <div className="admin-users-role">{user.role === 'admin' ? 'Tam Yetkili' : 'Standart Kullanıcı'}</div>
                      <StatusBadge
                        tone={isUserActive(user) ? 'success' : 'neutral'}
                        className={`admin-users-status ${isUserActive(user) ? 'is-active' : 'is-passive'}`}
                      >
                        {isUserActive(user) ? 'Aktif' : 'Pasif'}
                      </StatusBadge>
                    </td>
                    <td>
                      <span className="admin-users-employee-id">#{user.employee_id}</span>
                      <span className="admin-users-divider">|</span>
                      <span>{user.department || 'Bölüm belirtilmemiş'}{user.position ? ` - ${user.position}` : ''}</span>
                      <div className="admin-users-manager">Üst Amir: {user.manager_name || '-'}</div>
                    </td>
                    <td className="admin-users-actions-cell">
                      <div className="admin-users-row-actions">
                        <button type="button" onClick={() => openEditForm(user)} title="Düzenle" aria-label={`${user.name} kullanıcısını düzenle`} className="btn-icon admin-users-edit">
                          <Edit size={18} />
                        </button>
                        <button type="button" onClick={() => toggleUserStatus(user)} disabled={statusMutation.isPending} title={isUserActive(user) ? 'Pasife Al' : 'Aktife Al'} aria-label={`${user.name} kullanıcısını ${isUserActive(user) ? 'pasife al' : 'aktife al'}`} className={`btn-icon admin-users-power ${isUserActive(user) ? 'is-deactivate' : 'is-activate'}`}>
                          <Power size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr><td colSpan={3} className="admin-users-empty">Arama ölçütüne uygun kullanıcı bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <PaginationControls pagination={usersQuery.data?.pagination} onPageChange={setPage} />
      </div>

      {formMode && (
        <UserFormModal
          mode={formMode}
          values={formValues}
          users={managerOptions}
          departmentOptions={departmentOptions}
          positionOptions={positionOptions}
          managerSearch={managerSearch}
          pending={createMutation.isPending || updateMutation.isPending}
          onChange={setFormValues}
          onManagerSearchChange={setManagerSearch}
          onManagerSelect={(managerId) => {
            setSelectedManagerOption(userOptions.find(user => String(user.id) === managerId) || null);
          }}
          onOpenOption={(field) => setOptionModal({ field, value: '' })}
          onClose={closeForm}
          onSubmit={submitForm}
        />
      )}

      {optionModal && (
        <UserOptionModal
          field={optionModal.field}
          value={optionModal.value}
          options={optionModal.field === 'department' ? departmentOptions : positionOptions}
          customOptions={optionModal.field === 'department' ? customDepartments : customPositions}
          isInUse={(value) => isOptionInUse(optionModal.field, value)}
          onValueChange={(value) => setOptionModal((current) => current ? { ...current, value } : current)}
          onAdd={addOption}
          onRemove={(value) => removeOption(optionModal.field, value)}
          onClose={() => setOptionModal(null)}
        />
      )}
    </>
  );
}
