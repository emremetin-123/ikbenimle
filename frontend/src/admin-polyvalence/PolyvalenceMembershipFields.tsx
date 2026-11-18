import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { boolValue } from './utils';
import type { Membership, SetupResponse, SetupUser } from './types';

type Props = {
  editing: Membership | null;
  form: Record<string, unknown>;
  setup: SetupResponse;
  departments: SetupResponse['departments'];
  setField: (key: string, value: unknown) => void;
  setForm: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
};

const normalizeName = (value?: string | null) =>
  String(value || '').trim().toLocaleLowerCase('tr-TR');

const useUserOptions = (search: string) => {
  const deferredSearch = useDeferredValue(search.trim());
  return useQuery({
    queryKey: ['admin', 'polyvalence', 'membership-users', deferredSearch],
    queryFn: () => {
      const params = new URLSearchParams({ resource: 'users', page: '1', pageSize: '100' });
      if (deferredSearch) params.set('search', deferredSearch);
      return api.list<SetupUser>(`/api/polyvalence/admin/setup?${params.toString()}`);
    },
    staleTime: 5 * 60_000,
  });
};

export function PolyvalenceMembershipFields(props: Props) {
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [evaluatorSearch, setEvaluatorSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<SetupUser | null>(null);
  const [selectedEvaluator, setSelectedEvaluator] = useState<SetupUser | null>(null);
  const employeeQuery = useUserOptions(employeeSearch);
  const evaluatorQuery = useUserOptions(evaluatorSearch);
  const employees = employeeQuery.data?.items || [];
  const evaluators = evaluatorQuery.data?.items || [];
  const activeRoles = (departmentId: unknown) => props.setup.roles.filter(
    item => item.department_id === Number(departmentId) && !boolValue(item.is_archived),
  );

  const selectEmployee = (userIdValue: string) => {
    const userId = Number(userIdValue);
    const user = employees.find(item => item.id === userId);
    setSelectedEmployee(user || null);
    const department = props.departments.find(item =>
      normalizeName(item.source_department_name) === normalizeName(user?.department)
      || normalizeName(item.name) === normalizeName(user?.department),
    ) || props.departments[0];
    const role = activeRoles(department?.id).find(item =>
      normalizeName(item.name) === normalizeName(user?.position),
    );
    setSelectedEvaluator(user?.manager_id ? {
      id: user.manager_id,
      employee_id: '',
      name: user.manager_name || 'Kayıtlı üst amir',
    } : null);
    props.setForm(current => ({
      ...current,
      user_id: userId || '',
      department_id: department?.id || '',
      role_id: role?.id || '',
      evaluator_user_id: user?.manager_id || '',
    }));
  };

  const selectedEmployeeId = Number(props.form.user_id || 0);
  const selectedEvaluatorId = Number(props.form.evaluator_user_id || 0);
  const employeeFallback = selectedEmployeeId && !employees.some(item => item.id === selectedEmployeeId)
    ? selectedEmployee || (props.editing ? { id: props.editing.user_id, name: props.editing.user_name, employee_id: props.editing.employee_id } : null)
    : null;
  const evaluatorFallback = selectedEvaluatorId && !evaluators.some(item => item.id === selectedEvaluatorId)
    ? selectedEvaluator || (props.editing?.evaluator_name ? { id: selectedEvaluatorId, name: props.editing.evaluator_name, employee_id: '' } : null)
    : null;

  return <>
    <label>Çalışan ara<input value={employeeSearch} onChange={event => setEmployeeSearch(event.target.value)} placeholder="Ad, sicil, bölüm veya pozisyon" /></label>
    <label>Çalışan<select value={String(props.form.user_id || '')} onChange={event => selectEmployee(event.target.value)} required><option value="">Seçiniz</option>{employeeFallback && <option value={employeeFallback.id}>{employeeFallback.name} (#{employeeFallback.employee_id})</option>}{employees.map(item => <option key={item.id} value={item.id}>{item.name} (#{item.employee_id})</option>)}</select></label>
    <label>Polivalans bölümü<select value={String(props.form.department_id || '')} onChange={event => props.setForm(current => ({ ...current, department_id: Number(event.target.value), role_id: '' }))} required>{props.departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Pozisyon profili<select value={String(props.form.role_id || '')} onChange={event => props.setField('role_id', Number(event.target.value) || '')}><option value="">Tanımsız</option>{activeRoles(props.form.department_id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>Değerlendirecek amir ara<input value={evaluatorSearch} onChange={event => setEvaluatorSearch(event.target.value)} placeholder="Ad, sicil, bölüm veya pozisyon" /></label>
    <label>Değerlendirecek amir<select value={String(props.form.evaluator_user_id || '')} onChange={event => { const id = Number(event.target.value); props.setField('evaluator_user_id', id || ''); setSelectedEvaluator(evaluators.find(item => item.id === id) || null); }} required><option value="">Seçiniz</option>{evaluatorFallback && <option value={evaluatorFallback.id}>{evaluatorFallback.name}</option>}{evaluators.filter(item => item.id !== selectedEmployeeId).map(item => <option key={item.id} value={item.id}>{item.name} · {item.position || item.department || '-'}</option>)}</select></label>
  </>;
}
