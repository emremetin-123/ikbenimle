import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { MealMenuRating, PersonalReminder } from '../../src/types';
import { adminUser, mockAuthenticatedApi } from './fixtures';

const list = (items: unknown[]) => ({
  items,
  pagination: { page: 1, pageSize: 20, total: items.length, totalPages: items.length ? 1 : 0 },
});
const reminder = (id: number, text: string, completed = false): PersonalReminder => ({
  id, text, completed, pinned: false,
  created_at: '2026-11-06T08:00:00Z', updated_at: '2026-11-06T08:00:00Z', completed_at: null,
});

async function mockHome(page: Page) {
  await mockAuthenticatedApi(page);
  await page.route('**/api/session', route => route.fulfill({ json: { ...adminUser, photo_url: '/uploads/profiles/test-avatar.svg' } }));
  await page.route('**/api/news/home-preview', route => route.fulfill({ json: list(
    Array.from({ length: 4 }, (_, index) => ({
      id: index + 1, title: 'Şirket haberi ' + (index + 1), content: 'Haberin ayrıntılı içeriği ' + (index + 1),
      image_url: index % 2 ? '/uploads/news/test-cover.svg' : null, created_at: '2026-11-06T08:00:00Z',
    })),
  ) }));
  await page.route('**/api/announcements/home-preview', route => route.fulfill({ json: list([
    { id: 1, title: 'Kasım ayı eğitim takvimi', content: 'Takvim yayımlandı.', created_at: '2026-11-06T08:00:00Z' },
    { id: 2, title: 'Servis güzergahları güncellendi', content: 'Yeni güzergahlar.', created_at: '2026-11-05T08:00:00Z' },
  ]) }));
  await page.route('**/api/directory/birthdays/today?**', route => route.fulfill({ json: list([
    { id: 2, name: 'Örnek Çalışan', department: 'Üretim', photo_url: null },
  ]) }));
  await page.route('**/api/reminders', route => route.fulfill({ json: { items: [
    reminder(1, 'İş güvenliği eğitimi'), reminder(2, 'Ekip toplantısı'), reminder(3, 'Tamamlanan görev', true),
  ] } }));
}

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('home uses real summaries, profile access and an accessible responsive layout', async ({ page }, testInfo) => {
  const errors: string[] = [];
  let profileReads = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/user/profile') profileReads++;
  });
  page.on('pageerror', error => errors.push(error.message));
  await mockHome(page);
  await page.goto('/employee/anasayfa');
  await expect(page.getByRole('heading', { name: 'Ana Sayfa', exact: true })).toBeAttached();
  if (page.viewportSize()!.width <= 768) await expect(page.locator('.mobile-page-title')).toBeVisible();
  else await expect(page.getByRole('heading', { name: 'Ana Sayfa', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hoş geldin, Test Yönetici!' })).toBeVisible();
  const photo = page.locator('.home-profile-photo');
  await expect(photo).toHaveAttribute('src', /test-avatar\.svg$/);
  await expect(page.locator('.home-summary-card--violet')).toContainText('12 Gün');
  await expect(page.locator('.home-summary-card--teal')).toContainText('2 Adet');
  await expect(page.locator('.home-summary-card--coral')).toContainText('2 Adet');
  await expect(page.getByRole('navigation', { name: 'Hızlı erişim bağlantıları' }).getByRole('link')).toHaveCount(8);
  await expect(page.getByText('Kasım ayı eğitim takvimi', { exact: true })).toBeVisible();
  await expect(page.getByText('Örnek Çalışan', { exact: true })).toBeVisible();
  await expectNoOverflow(page);
  const avatarPlacement = await page.locator('.home-welcome').evaluate(section => {
    const heading = section.querySelector('h2')!.getBoundingClientRect();
    const avatar = section.querySelector('.home-profile-link')!.getBoundingClientRect();
    return avatar.left >= heading.right && Math.abs(avatar.top - heading.top) < 30;
  });
  expect(avatarPlacement).toBe(true);
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('home-first-screen.png') });
  await page.screenshot({ path: testInfo.outputPath('home-redesign.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(profileReads).toBe(0);
  await page.getByRole('link', { name: 'Profilimi görüntüle' }).click();
  await expect(page).toHaveURL(/\/employee\/kisisel-bilgiler$/);
  await expect.poll(() => profileReads).toBe(1);
});

test('news can be paged, opened by keyboard and resized between phone and desktop', async ({ page }) => {
  await mockHome(page);
  await page.goto('/employee/anasayfa');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('.home-news-dot')).toHaveCount(4);
  await page.getByRole('button', { name: 'Sonraki haberler' }).click();
  await expect(page.getByRole('button', { name: '2. haber sayfası', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '4. haber sayfası', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sonraki haberler' })).toBeDisabled();
  const lastNews = page.getByRole('button', { name: 'Şirket haberi 4 haberini aç' });
  await lastNews.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Şirket haberi 4', exact: true });
  await expect(dialog.getByText('Haberin ayrıntılı içeriği 4')).toBeVisible();
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(lastNews).toBeFocused();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator('.home-news-dot')).toHaveCount(2);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator('.home-news-dot')).toHaveCount(4);
  await expectNoOverflow(page);
});

test('reminder changes immediately update the summary and preserve editing and completion', async ({ page }) => {
  await mockHome(page);
  let items = [reminder(1, 'İlk hatırlatma')];
  await page.route('**/api/reminders**', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      const created = reminder(2, request.postDataJSON().text);
      items.push(created);
      return route.fulfill({ json: created });
    }
    if (request.method() === 'PUT') {
      const id = Number(new URL(request.url()).pathname.split('/').at(-1));
      items = items.map(item => item.id === id ? { ...item, ...request.postDataJSON() } : item);
      return route.fulfill({ json: items.find(item => item.id === id) });
    }
    return route.fulfill({ json: { items } });
  });
  await page.goto('/employee/anasayfa');
  const summary = page.locator('.home-summary-card--coral');
  await expect(summary).toContainText('1 Adet');
  await summary.click();
  const widget = page.getByRole('region', { name: 'Hatırlatmalarım', exact: true });
  await expect(widget).toBeFocused();
  await widget.getByRole('button', { name: 'Görev Ekle' }).click();
  await widget.getByRole('textbox', { name: 'Yeni hatırlatma', exact: true }).fill('Yeni görev');
  await widget.getByRole('button', { name: 'Hatırlatmayı ekle', exact: true }).click();
  await expect(widget.getByText('Yeni görev', { exact: true })).toBeVisible();
  await expect(summary).toContainText('2 Adet');
  await widget.getByRole('checkbox', { name: 'İlk hatırlatma hatırlatmasını tamamla', exact: true }).click();
  await expect(summary).toContainText('1 Adet');
  await widget.getByRole('button', { name: 'Tamamlananlar (1)' }).click();
  await expect(widget.locator('.is-completed')).toContainText('İlk hatırlatma');
  await expect(widget.getByRole('checkbox', { name: 'İlk hatırlatma hatırlatmasını yeniden aç', exact: true })).toBeChecked();
  await widget.getByLabel('Yeni görev seçenekleri').click();
  await widget.getByRole('button', { name: 'Düzenle', exact: true }).click();
  await widget.getByRole('textbox', { name: 'Hatırlatma metnini düzenle' }).fill('Güncellenen görev');
  await widget.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(widget.getByText('Güncellenen görev', { exact: true })).toBeVisible();
  await expectNoOverflow(page);
});

test('mood reasons, daily submission and optional HR callback still work', async ({ page }) => {
  await mockHome(page);
  let submitted = false;
  let callbackRequested = false;
  let moodBody: unknown;
  await page.route('**/api/mood-check**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/today')) return route.fulfill({ json: { submitted, callback_requested: callbackRequested } });
    if (path.endsWith('/callback-request')) callbackRequested = true;
    else { submitted = true; moodBody = route.request().postDataJSON(); }
    return route.fulfill({ json: { success: true } });
  });
  await page.goto('/employee/anasayfa');
  const mood = page.getByRole('region', { name: 'Bugün kendini nasıl hissediyorsun?' });
  await mood.getByRole('button', { name: 'Üzgün', exact: true }).click();
  await mood.getByRole('button', { name: 'İş yükü', exact: true }).click();
  await expect(mood.getByRole('status')).toHaveText('Bildirimin için teşekkür ederiz.');
  expect(moodBody).toEqual({ mood_id: 'sad', reason_key: 'workload' });
  for (const option of ['Çok iyi', 'İyi', 'Normal', 'Yorgun', 'Üzgün']) {
    await expect(mood.getByRole('button', { name: option, exact: true })).toBeVisible();
    await expect(mood.getByRole('button', { name: option, exact: true })).toBeDisabled();
  }
  await mood.getByRole('button', { name: 'Evet, aransın' }).click();
  await expect(mood.getByText('Geri aranma talebin İK ekibine iletildi.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Çok iyi', exact: true })).toBeDisabled();
});

test('meal rating saves and reopens with the saved scores', async ({ page }) => {
  await mockHome(page);
  let saved: MealMenuRating | null = null;
  await page.route('**/api/meal-menu/*/rating', async route => {
    if (route.request().method() === 'POST') {
      saved = { ...route.request().postDataJSON(), meal_date: '2026-09-05' };
      return route.fulfill({ json: { success: true, rating: saved } });
    }
    return route.fulfill({ json: saved });
  });
  await page.goto('/employee/anasayfa');
  await page.getByRole('button', { name: 'Yemeği değerlendir', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Yemek Değerlendirme' });
  for (const label of ['Yemeklerin lezzeti ve kalitesi', 'Çalışanların tutumu', 'Servis alanı temizliği']) {
    await dialog.getByRole('radiogroup', { name: label }).getByRole('radio', { name: '4 puan', exact: true }).click();
  }
  await dialog.getByRole('button', { name: 'Gönder', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Değerlendirmeyi güncelle', exact: true }).click();
  await expect(dialog.getByRole('radio', { name: '4 puan', exact: true }).first()).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expectNoOverflow(page);
});

test('failed data loads keep the page usable and do not present false zero values', async ({ page }) => {
  await mockHome(page);
  for (const path of ['leave-requests/balance', 'videos/summary', 'reminders', 'news/home-preview', 'announcements/home-preview', 'meal-menu/today']) {
    await page.route('**/api/' + path, route => route.fulfill({ status: 503, json: { message: 'Geçici hata' } }));
  }
  await page.goto('/employee/anasayfa');
  await expect(page.locator('.home-summary-card--violet')).toContainText('Bakiye alınamadı');
  await expect(page.locator('.home-summary-card--teal .home-summary-value')).toHaveText('—');
  await expect(page.locator('.home-summary-card--coral .home-summary-value')).toHaveText('—');
  await expect(page.getByText('Haberler yüklenemedi.', { exact: true })).toBeVisible();
  await expect(page.getByText('Duyurular yüklenemedi.', { exact: true })).toBeVisible();
  await expect(page.getByText('Yemek menüsü yüklenemedi.', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Hızlı erişim bağlantıları' }).getByRole('link')).toHaveCount(8);
  await expectNoOverflow(page);
});
