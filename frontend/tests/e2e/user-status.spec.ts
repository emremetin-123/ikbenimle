import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

test('user can be deactivated and reactivated without submitting read-only list fields', async ({ page }) => {
  await mockAuthenticatedApi(page);
  const user = {
    id: 12, employee_id: '1012', name: 'Test Çalışan', department: 'Pres',
    position: 'Operatör', role: 'employee', permissions: '["view_education","view_documents"]',
    status: 'active', manager_id: 1, manager_name: 'Test Yönetici',
    photo_path: '/uploads/avatars/employee.jpg', phone: '05551234567',
    birth_date: '1990-05-14T00:00:00.000Z', email: 'employee@example.com',
  };
  const submissions: Record<string, unknown>[] = [];
  await page.route('**/api/admin/users?**', route => route.fulfill({ json: {
    items: [user], pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
  } }));
  await page.route('**/api/admin/users/12', route => {
    const body = route.request().postDataJSON();
    submissions.push(body);
    if (['id', 'manager_name', 'photo_path'].some(key => key in body)) {
      return route.fulfill({ status: 400, json: { error: 'VALIDATION_ERROR' } });
    }
    user.status = body.status;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/employee/moduller/kullanicilar');

  await page.getByRole('button', { name: 'Test Çalışan kullanıcısını pasife al', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Vazgeç', exact: true }).click();
  expect(submissions).toHaveLength(0);

  for (const [action, confirmation, status, message, nextAction] of [
    ['pasife al', 'Pasife Al', 'passive', 'Kullanıcı pasife alındı.', 'aktife al'],
    ['aktife al', 'Aktifleştir', 'active', 'Kullanıcı aktif hale getirildi.', 'pasife al'],
  ]) {
    await page.getByRole('button', { name: `Test Çalışan kullanıcısını ${action}`, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: confirmation, exact: true }).click();
    await expect(page.getByText(message, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: `Test Çalışan kullanıcısını ${nextAction}`, exact: true })).toBeVisible();
    expect(submissions.at(-1)).toMatchObject({
      employee_id: '1012', name: 'Test Çalışan', department: 'Pres', position: 'Operatör',
      role: 'employee', permissions: ['view_education', 'view_documents'], status,
      manager_id: '1', phone: '05551234567', birth_date: '1990-05-14', email: 'employee@example.com',
    });
    expect(submissions.at(-1)).not.toHaveProperty('id');
    expect(submissions.at(-1)).not.toHaveProperty('manager_name');
    expect(submissions.at(-1)).not.toHaveProperty('photo_path');
  }
  expect(submissions).toHaveLength(2);
});
