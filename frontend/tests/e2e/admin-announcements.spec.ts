import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

test('managed announcements start collapsed and keep attachments and delete accessible', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route('**/api/admin/announcements**', route => route.fulfill({ json:
    new URL(route.request().url()).pathname.endsWith('/departments') ? [] : {
      items: [{ id: 1, title: 'Test şirket duyurusu', content: 'Duyurunun ayrıntılı içeriği.',
        created_at: '2026-10-26T09:00:00Z', author_name: 'Test Yönetici', visible_until: '2026-11-01',
        target_department: 'Kalite', attachment_path: '/uploads/announcements/test.pdf',
        attachment_name: 'Duyuru eki.pdf', attachment_type: 'application/pdf' }],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    },
  }));
  await page.goto('/employee/moduller/duyurular');
  const row = page.locator('.admin-announcement-row');
  const summary = row.locator('summary');
  await expect(summary).toContainText('Test şirket duyurusu');
  await expect(row.getByText('Duyurunun ayrıntılı içeriği.')).toBeHidden();
  await expect(row.getByRole('link', { name: 'Duyuru eki.pdf' })).toBeHidden();
  await summary.click();
  await expect(row.getByText('Duyurunun ayrıntılı içeriği.')).toBeVisible();
  await expect(row.getByRole('link', { name: 'Duyuru eki.pdf' })).toHaveAttribute('href', /\/uploads\/announcements\/test\.pdf$/);
  const accessibility = await new AxeBuilder({ page }).include('.admin-announcements-list-card').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(row.getByText('Duyurunun ayrıntılı içeriği.')).toBeHidden();
  await row.getByRole('button', { name: 'Test şirket duyurusu duyurusunu sil' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Vazgeç', exact: true }).click();
  await expect(row.locator('details')).not.toHaveAttribute('open');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
