import { expect, test } from '@playwright/test';
import { adminUser, mockAuthenticatedApi } from './fixtures';

test('saved education does not prevent birthday and clothing updates', async ({ page }) => {
  await mockAuthenticatedApi(page);
  let profile = {
    ...adminUser, birth_date: '1995-03-12', clothing_top: 'L', clothing_bottom: 'M',
    shoe_size: '42', email: 'profile@example.com', phone: '05551234567',
    education_entries: [{ id: 27, school: 'Test Üniversitesi', department: 'İktisat', start_year: 2014, end_year: 2018, is_current: false }],
    skill_tags: ['Excel'], hobby_tags: ['Kitap'],
  };
  let saves = 0;
  const taskReads: string[] = [];
  page.on('request', request => {
    if (request.url().includes('/api/polyvalence/')) taskReads.push(new URL(request.url()).pathname);
  });
  await page.route('**/api/user/profile', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: profile });
    const body = route.request().postDataJSON();
    // Match the server's strict education write contract, including on repeat saves.
    const allowed = ['school', 'department', 'start_year', 'end_year', 'is_current'];
    if (body.education_entries.some((entry: Record<string, unknown>) => Object.keys(entry).some(key => !allowed.includes(key)))) {
      return route.fulfill({ status: 400, json: { error: 'VALIDATION_ERROR', message: 'Gönderilen bilgiler geçerli değil.' } });
    }
    saves++;
    profile = { ...profile, ...body, education_entries: body.education_entries.map((entry: object) => ({ ...entry, id: 27 })) };
    return route.fulfill({ json: { success: true, profile } });
  });
  await page.goto('/employee/kisisel-bilgiler');
  await page.getByRole('button', { name: 'İletişim Bilgileri bilgilerini düzenle' }).click();
  await page.locator('input[type="date"]').fill('1996-04-20');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Profiliniz başarıyla güncellendi.');
  await page.getByRole('button', { name: 'Detaylı Bilgiler bilgilerini düzenle' }).click();
  await page.locator('.profile-details-card-details select').nth(1).selectOption('XL');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Detaylı Bilgiler bilgilerini düzenle' })).toBeVisible();
  expect(saves).toBe(2);
  await page.reload();
  await expect(page.locator('.profile-details-card-contact')).toContainText('1996-04-20');
  await expect(page.locator('.profile-details-card-details')).toContainText('XL');
  await expect(page.getByText('Test Üniversitesi', { exact: true })).toBeVisible();
  expect(profile.skill_tags).toEqual(['Excel']);
  expect(profile.clothing_bottom).toBe('M');
  expect(taskReads.length).toBeGreaterThan(0);
  expect(taskReads.every(path => path === '/api/polyvalence/my-tasks/summary')).toBe(true);
});
