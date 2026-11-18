import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

test('knowledge categories are created from the header dialog and errors keep the form open', async ({ page }, testInfo) => {
  await mockAuthenticatedApi(page);
  const categories: { id: number; name: string; item_count: number }[] = [];
  let fail = true;
  await page.route('**/api/admin/knowledge/categories**', route => {
    if (route.request().method() === 'POST') {
      if (fail) { fail = false; return route.fulfill({ status: 400, json: { error: 'CATEGORY_EXISTS', message: 'Bu kategori zaten var.' } }); }
      const body = route.request().postDataJSON();
      categories.push({ id: 1, name: body.name, item_count: 0 });
      return route.fulfill({ json: { id: 1 } });
    }
    return route.fulfill({ json: { items: categories, pagination: { page: 1, pageSize: 12, total: categories.length, totalPages: 1 } } });
  });
  await page.goto('/employee/moduller/bilgi-portali');
  await expect(page.getByRole('heading', { name: 'Yeni Kategori Ekle' })).toHaveCount(0);
  const open = page.locator('.module-page-header-actions').getByRole('button', { name: 'Kategori Ekle' });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Kategori Ekle', exact: true });
  await expect(dialog.getByRole('button', { name: 'Ekle', exact: true })).toBeDisabled();
  await dialog.getByLabel('Kategori adı', { exact: true }).fill('   ');
  await expect(dialog.getByRole('button', { name: 'Ekle', exact: true })).toBeDisabled();
  await dialog.getByLabel('Kategori adı', { exact: true }).fill('  Yeni Kategori  ');
  await dialog.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Bu kategori zaten var.');
  expect(await dialog.evaluate(element => element.getBoundingClientRect().height < innerHeight - 32)).toBe(true);
  await expect(dialog.getByLabel('Kategori adı', { exact: true })).toHaveValue('  Yeni Kategori  ');
  const accessibility = await new AxeBuilder({ page }).include('.knowledge-category-modal').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('category-modal.png') });
  const save = page.waitForRequest(request => request.method() === 'POST' && request.url().endsWith('/api/admin/knowledge/categories'));
  await dialog.getByLabel('Kategori adı', { exact: true }).press('Enter');
  expect((await save).postDataJSON()).toMatchObject({ name: 'Yeni Kategori', order_index: 0 });
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.category-admin-toggle')).toContainText('Yeni Kategori');
  await expect(open).toBeFocused();
  await open.click();
  await expect(dialog.getByLabel('Kategori adı', { exact: true })).toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
