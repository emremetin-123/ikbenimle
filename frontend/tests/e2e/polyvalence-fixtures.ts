import type { Page } from '@playwright/test';
import { adminUser, mockAuthenticatedApi } from './fixtures';

export async function mockPolyvalenceApi(page: Page, evaluator = false) {
  await mockAuthenticatedApi(page);
  if (evaluator) await page.route('**/api/session', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...adminUser, id: 9, role: 'employee', department: 'Montaj', permissions: ['view_polyvalence_reports'] }) }));
  const departments = [{ id: 1, name: 'Montaj', is_archived: false }, { id: 2, name: 'Bakım', is_archived: false }];
  const periods = departments.map(department => ({ id: department.id * 10, department_id: department.id, department_name: department.name, name: '2026 Sonbahar Değerlendirmesi', start_date: '2026-10-01', end_date: '2026-10-31', due_date: '2026-10-31', status: 'open', task_total: 1, task_completed: 0 }));
  const levels = ['Bilgisi yok', 'Gelişim gerekli', 'Bağımsız uygulayabilir', 'Uzman'].map((label, level_value) => ({ level_value, label, description: label }));
  const skills = [{ id: 101, department_id: 1, category_id: 1, category_name: 'Teknik', name: 'Montaj kontrolü' }, { id: 102, department_id: 1, category_id: 1, category_name: 'Teknik', name: 'Ölçüm cihazı kullanımı' }, { id: 103, department_id: 2, category_id: 2, category_name: 'Teknik', name: 'Periyodik bakım' }];
  const setup = {
    departments, roles: [{ id: 1, department_id: 1, name: 'Montaj çalışanı' }, { id: 2, department_id: 2, name: 'Bakım çalışanı' }],
    categories: [{ id: 1, department_id: 1, name: 'Teknik' }, { id: 2, department_id: 2, name: 'Teknik' }], skills,
    targets: skills.map((skill, index) => ({ id: index + 1, role_id: skill.department_id, skill_id: skill.id, target_level: 2, criticality: 'normal', min_qualified_count: 1 })),
    levels, schedules: [{ id: 1, department_id: 1, frequency_months: 6, duration_days: 30, reminder_days: '7,3,1', next_start_date: '2027-04-01', is_active: true }],
    users: [], memberships: [], videos: [{ id: 50, title: 'Kontrol eğitimi' }], training_links: [{ skill_id: 101, video_id: 50 }], active_membership_count: 2,
  };
  const members = ['Test Çalışan A', 'Test Çalışan B'].map((name, index) => ({ id: index + 1, user_id: index + 30, name, employee_id: '20' + index, position: 'Montaj çalışanı', assessments: skills.slice(0, 2).map((skill, i) => ({ id: 1000 + index * 10 + i, skill_id: skill.id, skill_name: skill.name, category: 'Teknik', target_level: 2, level: null as number | null, can_train: false, note: '', version_no: 0 })) }));
  let taskStatus = 'pending';
  const visiblePeriods = () => evaluator ? periods.slice(0, 1) : periods;
  const taskSummary = () => ({ id: 1, period_id: 10, period_name: periods[0].name, department_name: 'Montaj', due_date: '2026-10-31', status: taskStatus, total: 4, completed: members.flatMap(item => item.assessments).filter(item => item.level != null).length, member_count: 2, progress_percent: 0 });
  await page.route('**/api/polyvalence/**', async route => {
    const url = new URL(route.request().url()), path = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/my-tasks/summary')) return json({ has_tasks: true });
    if (path.endsWith('/my-tasks')) return json([taskSummary()]);
    if (path.endsWith('/tasks/1')) return json({ ...taskSummary(), period_status: 'open', levels, members, progress: { total: 4, completed: taskSummary().completed, percent: taskSummary().completed * 25 } });
    if (path.includes('/tasks/1/assessments/')) {
      const id = Number(path.split('/').pop());
      const row = members.flatMap(item => item.assessments).find(item => item.id === id)!;
      const body = route.request().postDataJSON();
      if (body.version_no !== row.version_no) return json({ message: 'Kayıt başka bir kullanıcı tarafından güncellendi.' }, 409);
      if ((row.level != null && body.level < row.level || row.can_train !== body.can_train) && !body.note) return json({ message: 'Açıklama zorunludur.' }, 400);
      Object.assign(row, { level: body.level, can_train: body.can_train, note: body.note, version_no: row.version_no + 1 });
      taskStatus = 'in_progress';
      return json({ level_value: row.level, can_train: row.can_train, note: row.note, version_no: row.version_no });
    }
    if (path.endsWith('/tasks/1/complete')) { taskStatus = 'completed'; return json({ success: true }); }
    if (path.endsWith('/admin/periods')) return json(visiblePeriods());
    if (path.endsWith('/report-period-groups')) return json([{ key: '2026-10-01_2026-10-31', label: '2026 Sonbahar', start_date: '2026-10-01', end_date: '2026-10-31', period_count: visiblePeriods().length, departments: visiblePeriods().map(item => ({ id: item.department_id, name: item.department_name, period_id: item.id, status: item.status })) }]);
    if (path.endsWith('/open-period-gaps')) return json([]);
    if (path.endsWith('/admin/setup')) return json(url.searchParams.has('resource') ? { items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } } : setup);
    if (path.endsWith('/report-dashboard')) {
      const id = Number(url.searchParams.get('period_id') || 0);
      const visible = id ? departments.filter(item => item.id === id / 10) : departments;
      return json({ group: { key: '2026-10-01_2026-10-31' }, selected_department_id: id ? id / 10 : 'all', positions: [{ key: 'Montaj çalışanı', name: 'Montaj çalışanı' }], departments: visible, summary: { polyvalence_rate: 50, average_skill_per_employee: 1, critical_risk_count: 0, completion_percent: 50, completed_employees: 1, total_employees: 2 }, operation_risks: [], heatmap: { departments: [{ id: 'Montaj çalışanı', name: 'Montaj çalışanı' }], categories: ['Teknik'], cells: [{ department_id: 'Montaj çalışanı', category: 'Teknik', score: 50 }] }, department_comparison: [{ department_id: 'Montaj çalışanı', name: 'Montaj çalışanı', score: 50 }], top_employees: [], development_skills: [] });
    }
    if (/\/periods\/\d+\/report$/.test(path)) return json({ period: periods.find(item => item.id === Number(path.split('/').at(-2))), tasks: [{ id: 1, evaluator_name: 'Test Değerlendirici', status: 'completed', member_count: 2, total: 4, completed: 4 }], rows: members.flatMap(member => member.assessments.map(item => ({ employee_id_snapshot: member.employee_id, employee_name_snapshot: member.name, position_snapshot: member.position, skill_name_snapshot: item.skill_name, category_name_snapshot: item.category, target_level_snapshot: 2, level_value: member.id === 1 ? 2 : null, can_train: false }))) });
    if (path.endsWith('/audit')) return json({ logs: [] });
    if (path.endsWith('/admin/schedules/run')) return json({ opened: 0, closed: 0, skipped: 1, errors: [] });
    if (path.endsWith('/admin/skills') && route.request().method() === 'POST') return json({ id: 104 });
    if (/\/admin\/skills\/\d+$/.test(path)) return json({ id: Number(path.split('/').pop()) });
    return json({ success: true });
  });
}
