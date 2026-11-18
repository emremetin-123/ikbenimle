import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { adminUser, expectModuleTitle, mockAuthenticatedApi } from './fixtures';

const root = '/api/admin/audit-logs';
test('admin filters, downloads, inspects and protects audit records', async ({ page }, testInfo) => {
  await mockAuthenticatedApi(page);
  const original = Array.from({ length: 27 }, (_, index) => ({ source: 'activity', id: String(index + 1), created_at: '2026-10-28 09:15:00.000', actor_id: 2,
    actor_name: 'Test Kullanıcı', actor_employee_id: '1002', module: 'polyvalence', module_label: 'Polivalans', action: 'update', action_label: 'Düzenleme',
    description: 'Polivalans · Düzenleme · Kayıt 10/' + index, resource_id: '10/' + index, outcome: index === 1 ? 'denied' : 'success', http_status: index === 1 ? 403 : 200, retention_days: 180,
    held_at: null as string | null, hold_reason: null as string | null, held_by_name: null as string | null, ip_address: '192.0.2.1', details: { changed_fields: ['level'], before: { level_value: 1 }, level_value: 2 }
  }));
  let holdAttempts = 0;
  let filteredUrl = '';
  await page.route('**/api/admin/audit-logs**', route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (path === root + '/policy') return route.fulfill({ json: {
      general_days: 180, critical_days: 365, purge_summary_years: 3, unfinished_count: 0, cleanup_overdue: false,
      last_purge: { created_at: '2026-10-28 00:05:00.000', general_count: 20, critical_count: 0, security_count: 1 },
      modules: [{ value: 'polyvalence', label: 'Polivalans' }], actions: [{ value: 'update', label: 'Düzenleme' }]
    } });
    if (path === root + '/export') return route.fulfill({ contentType: 'text/csv; charset=utf-8', body: '\uFEFFTarih;Kullanıcı\r\n2026-10-28;Test Kullanıcı' });
    if (path.endsWith('/hold')) {
      holdAttempts++;
      if (holdAttempts === 1) return route.fulfill({ status: 503, json: { message: 'Koruma şu anda kaydedilemiyor.' } });
      original[0].hold_reason = request.postDataJSON().reason; original[0].held_by_name = 'Test Yönetici'; original[0].held_at = '2026-10-28 10:00:00.000';
      return route.fulfill({ json: { success: true } });
    }
    if (path.endsWith('/release')) {
      original[0].held_at = null; original[0].hold_reason = null;
      return route.fulfill({ json: { success: true } });
    }
    if (path === root + '/activity/1') return route.fulfill({ json: original[0] });
    filteredUrl = request.url();
    const items = original.filter(row => (!url.searchParams.get('outcome') || row.outcome === url.searchParams.get('outcome')) && (!url.searchParams.get('held') || row.held_at));
    const pageNumber = Number(url.searchParams.get('page') || 1);
    return route.fulfill({ json: { items: items.slice((pageNumber - 1) * 25, pageNumber * 25), pagination: { page: pageNumber, pageSize: 25, total: items.length, totalPages: Math.ceil(items.length / 25) }, summary: { total: items.length, failed: items.filter(row => row.outcome === 'denied').length, held: items.filter(row => row.held_at).length } } });
  });
  await page.goto('/employee/moduller/log-kayitlari');
  await expectModuleTitle(page, 'Log Kayıtları');
  await expect(page.locator('.audit-table tbody tr')).toHaveCount(25);
  await expect(page.locator('.audit-table tbody tr').first()).toContainText('12:15:00');
  await page.getByRole('button', { name: 'Sonraki sayfa', exact: true }).click();
  await expect(page.locator('.audit-table tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Önceki sayfa', exact: true }).click();
  await expect(page.locator('.audit-table tbody tr')).toHaveCount(25);
  await page.getByLabel('Kullanıcı veya sicil').fill('Test');
  await page.getByLabel('Modül', { exact: true }).selectOption('polyvalence');
  await page.getByLabel('İşlem', { exact: true }).selectOption('update');
  await page.getByLabel('Sonuç', { exact: true }).selectOption('denied');
  await page.getByLabel('Başlangıç tarihi').fill('2026-10-01'); await page.getByLabel('Bitiş tarihi').fill('2026-10-28');
  await page.getByRole('button', { name: 'Filtrele', exact: true }).click();
  await expect(page.locator('.audit-table tbody tr')).toHaveCount(1);
  expect(new URL(filteredUrl).searchParams.get('page')).toBe('1');
  expect(new URL(filteredUrl).searchParams.get('user')).toBe('Test');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: "Excel'e Aktar" }).click();
  expect((await downloading).suggestedFilename()).toBe('Log_Kayitlari.csv');
  await page.getByRole('button', { name: 'Temizle', exact: true }).click();
  await expect(page.locator('.audit-table tbody tr')).toHaveCount(25);
  await page.locator('.audit-table tbody tr').first().getByRole('button').click();
  const dialog = page.getByRole('dialog', { name: 'Log Kaydı Detayı' });
  await expect(dialog.getByText('192.0.2.1', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Önceki puan: 1 · Kaydedilen puan: 2')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Korumaya al', exact: true })).toBeDisabled();
  await dialog.getByLabel('Koruma gerekçesi').fill('İnceleme devam ettiği için korunmalıdır.');
  await dialog.getByRole('button', { name: 'Korumaya al', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Koruma şu anda kaydedilemiyor.');
  await expect(dialog.getByLabel('Koruma gerekçesi')).toHaveValue('İnceleme devam ettiği için korunmalıdır.');
  await dialog.getByRole('button', { name: 'Korumaya al', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Korumayı kaldır', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('audit-detail.png') });
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(a11y.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  await dialog.getByRole('button', { name: 'Korumayı kaldır', exact: true }).click();
  const confirmation = page.getByRole('dialog', { name: 'Kaydın korumasını kaldır' });
  await confirmation.getByRole('button', { name: 'Korumayı kaldır', exact: true }).click();
  await expect(dialog.getByLabel('Koruma gerekçesi')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('Yalnız korunan kayıtlar').check();
  await page.getByRole('button', { name: 'Filtrele', exact: true }).click();
  await expect(page.getByText('Bu filtrelere uygun log kaydı bulunamadı.')).toBeVisible();
  await page.getByRole('button', { name: 'Temizle', exact: true }).click();
  await expect(page.locator('.audit-table tbody tr')).toHaveCount(25);
  await page.locator('.module-page-header').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('audit-list.png') });
  const pageA11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(pageA11y.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('employees with user-management permission cannot open audit data', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route('**/api/session', route => route.fulfill({ json: { ...adminUser, role: 'employee', permissions: ['manage_users'] } }));
  let requests = 0;
  await page.route('**/api/admin/audit-logs**', route => { requests++; return route.fulfill({ status: 403, json: {} }); });
  await page.goto('/employee/moduller/log-kayitlari');
  await expect(page.getByRole('alert')).toContainText('Bu alana erişiminiz yok');
  await expect(page.getByRole('link', { name: 'Log Kayıtları', exact: true })).toHaveCount(0);
  expect(requests).toBe(0);
});
