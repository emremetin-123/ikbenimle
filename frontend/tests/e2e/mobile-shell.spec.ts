import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

test('system modules share the mobile bars and keep navigation usable', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(page.viewportSize()!.width > 768, 'Mobile bars are hidden on desktop.');
  await mockAuthenticatedApi(page);
  await page.route('**/api/admin/audit-logs**', route => route.fulfill({ json: route.request().url().includes('/policy') ? {
    general_days: 180, critical_days: 365, purge_summary_years: 3,
    unfinished_count: 0, cleanup_overdue: false, last_purge: null, modules: [], actions: [],
  } : {
    items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 }, summary: { total: 0, failed: 0, held: 0 },
  } }));
  for (const [path, title] of [
    ['anasayfa', 'Ana Sayfa'], ['kisisel-bilgiler', 'Profilim'],
    ['moduller/kullanicilar', 'Kullanıcılar'], ['moduller/ai-ayarlari', 'AI Ayarları'],
    ['moduller/api-entegrasyonlari', 'Entegrasyonlar'], ['moduller/bildirimler', 'Bildirimler'],
    ['moduller/log-kayitlari', 'Log Kayıtları'],
  ]) {
    await page.goto(`/employee/${path}`);
    const header = page.locator('.mobile-header');
    await expect(header.locator('.mobile-page-title')).toHaveText(title);
    await expect(header).toHaveCSS('background-color', 'rgb(65, 54, 110)');
    const bottom = page.getByRole('navigation', { name: 'Mobil ana menü' });
    await expect(bottom.getByRole('link')).toHaveCount(3);
    const bounds = await bottom.getByRole('link').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { top: box.top, width: box.width, height: box.height };
    }));
    expect(bounds.every(box => box.width >= 44 && box.height >= 44)).toBe(true);
    expect(Math.max(...bounds.map(box => box.top)) - Math.min(...bounds.map(box => box.top))).toBeLessThan(1);
    await page.getByRole('button', { name: 'Menüyü aç', exact: true }).click();
    await expect(page.locator('.sidebar')).toHaveClass(/mobile-open/);
    await page.locator('.sidebar-overlay').click({ position: { x: page.viewportSize()!.width - 10, y: 20 } });
    await expect(page.locator('.sidebar')).not.toHaveClass(/mobile-open/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const result = await new AxeBuilder({ page }).include('.mobile-header').include('.bottom-nav').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations).toEqual([]);
    if (path === 'moduller/kullanicilar') {
      await expect(page.getByRole('button', { name: 'Yeni Kullanıcı Ekle', exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('users-mobile-shell.png') });
    }
  }
  await page.getByRole('navigation', { name: 'Mobil ana menü' }).getByRole('link', { name: 'Profilim' }).click();
  await expect(page.locator('.mobile-page-title')).toHaveText('Profilim');
  await expect(page.getByRole('navigation', { name: 'Mobil ana menü' }).getByRole('link', { name: 'Profilim' })).toHaveClass(/active/);
});

test('training player uses the same mobile shell and keeps back and course menu controls', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 768, 'Mobile bars are hidden on desktop.');
  await mockAuthenticatedApi(page);
  await page.goto('/employee/egitimler/42');
  await expect(page.locator('.mobile-page-title')).toHaveText('Güvenli Video Eğitimi');
  await expect(page.getByRole('navigation', { name: 'Mobil ana menü' })).toBeVisible();
  await page.getByRole('button', { name: 'Eğitim menüsünü aç' }).click();
  await expect(page.locator('.training-player-sidebar')).toHaveClass(/mobile-open/);
  await page.locator('.sidebar-overlay.active').click({ position: { x: page.viewportSize()!.width - 10, y: 20 } });
  await page.getByRole('button', { name: 'Geri dön', exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/egitimler$/);
});
