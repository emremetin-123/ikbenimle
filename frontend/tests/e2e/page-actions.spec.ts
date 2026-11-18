import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

test('document request opens from the page header and existing tabs remain available', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route('**/api/document-request-types', route => route.fulfill({ json: [{ id: 1, name: 'Çalışma Belgesi', fields: [] }] }));
  await page.goto('/employee/belgelerim');
  const request = page.locator('.module-page-header-actions').getByRole('button', { name: 'Belge Talep Et', exact: true });
  await expect(request).toBeVisible();
  await expect(page.locator('.document-tab-bar').getByRole('button', { name: 'Belge Talep Et' })).toHaveCount(0);
  await request.click();
  await expect(page.getByRole('heading', { name: 'Yeni Belge Talebi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Talebi Gönder' })).toBeVisible();
  await page.getByRole('button', { name: 'Bordrolarım', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yeni Belge Talebi' })).toHaveCount(0);
  await expect(request).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('feedback exports from a green button in the requests table header', async ({ page }, testInfo) => {
  await mockAuthenticatedApi(page);
  await page.route('**/api/admin/feedback?**', route => route.fulfill({ json: {
    items: [{ id: 1, title: 'Örnek talep', type: 'suggestion', content: 'Test içeriği', status: 'pending' }],
    pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
  } }));
  await page.goto('/employee/moduller/geribildirim');
  await expect(page.locator('.module-page-header-actions')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rapor indir' })).toHaveCount(0);
  const table = page.getByRole('region', { name: 'Talepler', exact: true });
  const exportButton = table.locator('.fb-section-heading').getByRole('button', { name: "Excel'e Aktar", exact: true });
  await expect(exportButton).toBeEnabled();
  expect(await exportButton.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(4, 120, 87)');
  const download = page.waitForEvent('download');
  await exportButton.click();
  expect((await download).suggestedFilename()).toMatch(/^geri_bildirim_raporu_.*\.csv$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('feedback-table-export.png') });
});
