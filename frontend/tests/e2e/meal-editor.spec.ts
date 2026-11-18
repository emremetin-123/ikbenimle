import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

test('meal menu starts with ratings and header opens the persistent menu editor', async ({ page }, testInfo) => {
  await mockAuthenticatedApi(page);
  let menus: { id: number; meal_date: string; items: string[] }[] = [];
  await page.route('**/api/admin/meal-menu**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/bulk')) {
      menus = route.request().postDataJSON().menus.map((item: { meal_date: string; items: string[] }, index: number) => ({ ...item, id: index + 1 }));
      return route.fulfill({ json: { saved: menus.length } });
    }
    if (url.pathname.endsWith('/parse-pdf')) return route.fulfill({ json: {
      menus: [{ meal_date: `${new Date().toISOString().slice(0, 7)}-02`, items: ['PDF menüsü'] }], parser: 'table', source_file: 'test.pdf', raw_text: 'Örnek PDF menüsü',
    } });
    if (url.pathname.endsWith('/ratings/summary')) return route.fulfill({ json: { summary: [], overall: { response_count: 0 } } });
    return route.fulfill({ json: { items: menus, pagination: { page: 1, pageSize: 31, total: menus.length, totalPages: 1 } } });
  });
  await page.goto('/employee/moduller/yemek-menusu');
  await expect(page.getByRole('heading', { name: 'Değerlendirme', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menü / PDF İşlemleri' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'PDF Oku' })).toHaveCount(0);
  const open = page.getByRole('button', { name: 'Menü Ekle', exact: true });
  await open.click();
  const dialog = page.getByRole('dialog', { name: 'Menü Ekle', exact: true });
  await dialog.getByRole('button', { name: 'Gün Ekle' }).click();
  await dialog.getByLabel('1. günün yemekleri').fill('Çorba\nPilav');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  await open.click();
  await expect(dialog.getByLabel('1. günün yemekleri')).toHaveValue('Çorba\nPilav');
  const publish = page.waitForRequest(request => request.url().endsWith('/api/admin/meal-menu/bulk') && request.method() === 'PUT');
  await dialog.getByRole('button', { name: 'Yayınla', exact: true }).click();
  expect((await publish).postDataJSON().menus[0].items).toEqual(['Çorba', 'Pilav']);
  await expect(dialog.getByText('1 günlük menü yayınlandı.', { exact: true })).toBeVisible();
  await dialog.getByLabel('PDF', { exact: true }).setInputFiles({ name: 'test.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nTest') });
  await dialog.getByRole('button', { name: 'PDF Oku', exact: true }).click();
  await expect(dialog.getByLabel('1. günün yemekleri')).toHaveValue('PDF menüsü');
  const result = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('meal-editor.png') });
  await dialog.getByRole('button', { name: 'Menü düzenleyiciyi kapat' }).click();
  await expect(page.getByRole('heading', { name: 'Değerlendirme', exact: true })).toBeVisible();
});
