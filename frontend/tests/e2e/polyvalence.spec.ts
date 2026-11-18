import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockPolyvalenceApi } from './polyvalence-fixtures';
import { expectModuleTitle } from './fixtures';

test('schedule explains open-period blocking and reminder days', async ({ page }, testInfo) => {
  await mockPolyvalenceApi(page);
  await page.goto('/employee/moduller/polivalans?view=management');
  await page.getByRole('button', { name: 'Değerlendirme Takvimi', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Polivalans Ayarları', exact: true });
  await expect(dialog.getByRole('status')).toContainText('dönemi açık');
  await expect(dialog).toContainText('7, 3 ve 1 gün önce');
  await page.screenshot({ path: testInfo.outputPath('schedule-explanation.png') });
  await noOverflow(page);
});

test('only a completed period can close from its list row after confirmation', async ({ page }) => {
  await mockPolyvalenceApi(page);
  let closed = false;
  await page.route('**/api/polyvalence/admin/periods', route => route.fulfill({ json: [
    { id: 10, department_id: 1, department_name: 'Montaj', name: 'Test Dönemi', start_date: '2026-10-01', end_date: '2026-10-31', due_date: '2026-10-31', status: closed ? 'closed' : 'open', task_total: 1, task_completed: 1 },
  ] }));
  await page.route('**/api/polyvalence/admin/periods/10/close', route => {
    closed = true;
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/employee/moduller/polivalans?view=reports');
  const periodRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Montaj Test Dönemi raporunu aç' }) });
  await expect(periodRow.getByRole('button', { name: 'Dönemi kapat', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Dönemi kapat', exact: true }).click();
  expect(closed).toBe(false);
  const dialog = page.getByRole('dialog', { name: 'Dönemi kapat', exact: true });
  await expect(dialog).toContainText('artık düzenlenemez');
  await dialog.getByRole('button', { name: 'Dönemi kapat', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Geçmiş dönemler · 1' })).toBeVisible();
  expect(closed).toBe(true);
});

async function noOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
}

test('management combines workshop skills and position targets without changing report scope', async ({ page }) => {
  await mockPolyvalenceApi(page);
  await page.goto('/employee/moduller/polivalans?view=management');
  await expect(page.getByRole('dialog', { name: 'Polivalans Ayarları', exact: true })).toBeVisible();
  await expect(page.getByText('Montaj kontrolü', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Montaj kontrolü beceri ve hedefini düzenle' }).click();
  const dialog = page.getByRole('dialog', { name: 'Beceri ve Hedefi Düzenle', exact: true });
  await expect(dialog.getByLabel('Beceri adı')).toHaveValue('Montaj kontrolü');
  await expect(dialog.getByLabel('Hedef seviye')).toHaveValue('2');
  await dialog.getByLabel('Hedef seviye').selectOption('3');
  const save = page.waitForRequest(request => request.url().endsWith('/admin/targets') && request.method() === 'PUT');
  await dialog.getByRole('button', { name: 'Beceri ve hedefi kaydet' }).click();
  expect((await save).postDataJSON()).toMatchObject({ skill_id: 101, role_id: 1, target_level: 3 });
  await expect(dialog).toBeHidden();
  await page.getByLabel('Bölüm', { exact: true }).selectOption('2');
  await expect(page.getByText('Periyodik bakım', { exact: true })).toBeVisible();
  await expect(page.getByText('Montaj kontrolü', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Değerlendirme Takvimi' }).click();
  await expect(page.getByText('Bu bölümde takvim tanımlanmamış.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Takvim oluştur' }).click();
  await expect(page.getByRole('dialog').getByLabel('Bölüm', { exact: true })).toHaveValue('2');
  await page.keyboard.press('Escape');
  await noOverflow(page);
});

test('report opens the selected workshop and exposes actual employee results', async ({ page }) => {
  await mockPolyvalenceApi(page);
  await page.goto('/employee/moduller/polivalans?view=reports');
  const request = page.waitForRequest(request => request.url().includes('/report-dashboard?'));
  await page.getByRole('button', { name: 'Montaj 2026 Sonbahar Değerlendirmesi raporunu aç' }).click();
  expect(new URL((await request).url()).searchParams.get('period_id')).toBe('10');
  await expect(page.getByRole('heading', { name: 'Çalışan bazında sonuçlar' })).toBeVisible();
  await page.getByRole('button', { name: 'Detay', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Test Çalışan A · Beceri detayları' })).toBeVisible();
  await page.getByLabel('Rapor kapsamı').selectOption('2');
  await expect(page.getByRole('heading', { name: 'Bakım', exact: true })).toBeVisible();
  await noOverflow(page);
});

test('evaluator sees workshop reports and no management controls', async ({ page }) => {
  await mockPolyvalenceApi(page, true);
  await page.goto('/employee/moduller/polivalans?view=management');
  await expectModuleTitle(page, 'Dönemler ve Raporlar', 'Polivalans Raporları');
  await expect(page.getByRole('button', { name: 'Yönetim', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Polivalans Ayarları', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bakım 2026 Sonbahar Değerlendirmesi raporunu aç' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Montaj 2026 Sonbahar Değerlendirmesi raporunu aç' }).click();
  await expect(page.getByLabel('Rapor kapsamı')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Yeniden aç' })).toHaveCount(0);
  await noOverflow(page);
});

test('evaluation saves scores, requests reasons, and locks completed tasks', async ({ page }) => {
  await mockPolyvalenceApi(page, true);
  await page.goto('/employee/polivalans');
  await page.getByRole('button', { name: /2026 Sonbahar Değerlendirmesi/ }).click();
  await page.getByRole('button', { name: /Test Çalışan A/ }).click();
  const ratings = page.getByRole('group', { name: 'Montaj kontrolü yetkinlik seviyesi' });
  await ratings.getByRole('button', { name: '3 Uzman', exact: true }).click();
  await expect(ratings.getByRole('button', { name: '3 Uzman', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await ratings.getByRole('button', { name: '1 Gelişim gerekli', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Yetkinlik değerlendirmesi' });
  await expect(dialog.getByRole('alert')).toContainText('açıklama zorunludur');
  await dialog.getByLabel('Değerlendirme açıklaması').fill('Gözlem sonucuna göre güncellendi.');
  await dialog.getByRole('button', { name: 'Değerlendirmeyi kaydet' }).click();
  await expect(dialog).toBeHidden();
  await expect(ratings.getByRole('button', { name: '1 Gelişim gerekli', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: 'Ölçüm cihazı kullanımı yetkinlik seviyesi' }).getByRole('button', { name: '2 Bağımsız uygulayabilir', exact: true }).click();
  await page.getByRole('button', { name: 'Sonraki çalışan' }).click();
  await expect(page.getByRole('button', { name: /Test Çalışan B/ })).toHaveAttribute('aria-expanded', 'true');
  for (const name of ['Montaj kontrolü', 'Ölçüm cihazı kullanımı']) {
    const group = page.getByRole('group', { name: name + ' yetkinlik seviyesi' });
    await group.getByRole('button', { name: '2 Bağımsız uygulayabilir', exact: true }).click();
    await expect(group.getByRole('button', { name: '2 Bağımsız uygulayabilir', exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('button', { name: 'Görevi tamamla', exact: true }).click();
  await expect(page.getByText('Görev tamamlandı.', { exact: false })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Montaj kontrolü yetkinlik seviyesi' }).getByRole('button').first()).toBeDisabled();
  await noOverflow(page);
});

test('polyvalence management and evaluation have no serious accessibility violations', async ({ page }) => {
  await mockPolyvalenceApi(page);
  for (const path of ['/employee/moduller/polivalans?view=management', '/employee/polivalans', '/employee/moduller/polivalans?view=reports']) {
    await page.goto(path);
    if (path === '/employee/polivalans') {
      await page.getByRole('button', { name: /2026 Sonbahar Değerlendirmesi/ }).click();
      await page.getByRole('button', { name: /Test Çalışan A/ }).click();
    }
    else if (path.endsWith('management')) await expect(page.getByRole('heading', { name: 'Pozisyon becerileri' })).toBeVisible();
    else {
      await page.getByRole('button', { name: 'Montaj 2026 Sonbahar Değerlendirmesi raporunu aç' }).click();
      await expect(page.getByRole('heading', { name: 'Çalışan bazında sonuçlar' })).toBeVisible();
    }
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
    await noOverflow(page);
  }
});

test('retry after a target save fails keeps the new skill instead of creating it twice', async ({ page }) => {
  await mockPolyvalenceApi(page);
  let creations = 0;
  let targetAttempts = 0;
  await page.route('**/api/polyvalence/admin/skills', route => {
    creations += 1;
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 104 }) });
  });
  await page.route('**/api/polyvalence/admin/targets', route => {
    targetAttempts += 1;
    return route.fulfill({ status: targetAttempts === 1 ? 500 : 200, contentType: 'application/json', body: JSON.stringify(targetAttempts === 1 ? { message: 'Hedef kaydedilemedi.' } : { success: true }) });
  });
  await page.goto('/employee/moduller/polivalans?view=management');
  await page.getByRole('button', { name: 'Beceri ve hedef ekle' }).click();
  const dialog = page.getByRole('dialog', { name: 'Beceri ve Hedef Ekle', exact: true });
  await dialog.getByLabel('Beceri adı').fill('Yeni kontrol becerisi');
  await dialog.getByRole('button', { name: 'Beceri ve hedefi kaydet' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Beceri bilgileri kaydedildi');
  await dialog.getByRole('button', { name: 'Beceri ve hedefi kaydet' }).click();
  await expect(dialog).toBeHidden();
  expect(creations).toBe(1);
  expect(targetAttempts).toBe(2);
});

test('settings open from a report, nested dialogs close independently and report context remains', async ({ page }) => {
  await mockPolyvalenceApi(page);
  await page.goto('/employee/moduller/polivalans?view=reports');
  const settingsButton = page.getByRole('button', { name: 'Polivalans Ayarları', exact: true });
  await expect(page.getByRole('button', { name: 'Beceriler ve Hedefler' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Montaj 2026 Sonbahar Değerlendirmesi raporunu aç' }).click();
  await page.getByRole('combobox', { name: 'Pozisyon', exact: true }).selectOption('Montaj çalışanı');
  await settingsButton.click();
  const settings = page.getByRole('dialog', { name: 'Polivalans Ayarları', exact: true });
  await expect(settings).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await settings.getByRole('button', { name: 'Beceri ve hedef ekle' }).click();
  const editor = page.getByRole('dialog', { name: 'Beceri ve Hedef Ekle', exact: true });
  await expect(editor).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(editor).toBeHidden();
  await expect(settings).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await expect(settings.getByRole('button', { name: 'Beceri ve hedef ekle' })).toBeFocused();
  const close = settings.getByRole('button', { name: 'Polivalans ayarlarını kapat' });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  expect(await settings.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await expect(settingsButton).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await expect(page.getByRole('combobox', { name: 'Pozisyon', exact: true })).toHaveValue('Montaj çalışanı');
  await expect(page.getByRole('heading', { name: 'Montaj', exact: true })).toBeVisible();
  await noOverflow(page);
});
