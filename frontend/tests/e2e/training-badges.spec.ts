import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const image = { name: 'ozel-rozet.png', mimeType: 'image/png', buffer: png };

test('training creator requires an uploaded badge and submits the selected design', async ({ page }, testInfo) => {
  await mockAuthenticatedApi(page);
  let submitted = '';
  await page.route('**/api/admin/video', async route => {
    submitted = route.request().postDataBuffer()?.toString('latin1') || '';
    await route.fulfill({ json: { success: true, videoId: 900 } });
  });
  await page.goto('/employee/moduller/egitimler');
  await page.getByRole('button', { name: 'Yeni Eğitim Ekle' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yeni eğitim ekle' });
  await dialog.locator('.input-group').filter({ hasText: 'Eğitim Başlığı' }).locator('input').fill('Özel Rozet Eğitimi');
  await dialog.getByLabel('Modül Başlığı').fill('Temel Bilgiler');
  await dialog.getByLabel('İçerik Başlığı').fill('Eğitim Videosu');
  await dialog.locator('.training-content-editor input[type=file]').setInputFiles({ name: 'video.mp4', mimeType: 'video/mp4', buffer: Buffer.from('test-video') });
  await dialog.locator('.input-group').filter({ hasText: 'Video Süresi (sn)' }).locator('input').fill('60');
  await dialog.getByRole('button', { name: 'Eğitimi Kaydet' }).click();
  await expect(page.getByText('Hata: Rozet verilecek eğitimler için rozet görseli yükleyin.', { exact: true })).toBeVisible();
  expect(submitted).toBe('');
  const upload = dialog.getByLabel('Rozet görseli', { exact: true });
  await upload.setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(dialog.getByRole('alert')).toHaveText('JPEG, PNG, GIF veya WebP formatında bir görsel seçin.');
  await upload.setInputFiles(image);
  await expect(dialog.getByRole('img', { name: 'Rozet önizlemesi' })).toBeVisible();
  await dialog.locator('.training-badge-field').getByRole('button', { name: 'Kaldır' }).click();
  await expect(dialog.getByRole('img', { name: 'Rozet önizlemesi' })).toHaveCount(0);
  await upload.setInputFiles(image);
  await dialog.getByRole('button', { name: 'Eğitim kuralları' }).click();
  await dialog.getByLabel('Rozet verilsin', { exact: true }).uncheck();
  await expect(upload).toHaveCount(0);
  await dialog.getByLabel('Rozet verilsin', { exact: true }).check();
  await expect(dialog.getByRole('img', { name: 'Rozet önizlemesi' })).toBeVisible();
  await dialog.locator('.training-badge-field').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('badge-upload.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await dialog.getByRole('button', { name: 'Eğitimi Kaydet' }).click();
  await expect(dialog).toHaveCount(0);
  expect(submitted).toContain('name="badge_image_file"; filename="ozel-rozet.png"');
  expect(submitted).toContain('name="awards_badge"\r\n\r\ntrue');
});

test('profile and directory render uploaded badge art with no built-in emblem', async ({ page }, testInfo) => {
  await mockAuthenticatedApi(page);
  const badge = { id: 90, title: 'Özel Rozet Eğitimi', badge_image_url: '/uploads/videos/custom-badge.png' };
  const oldBadge = { id: 91, title: 'Eski Kazanım' };
  const user = { id: 42, name: 'Rozet Sahibi', department: 'Kalite', badges: [badge, oldBadge] };
  await page.route('**/api/videos?**', route => route.fulfill({ json: { items: [badge, oldBadge], pagination: { page: 1, pageSize: 12, total: 2, totalPages: 1 } } }));
  await page.route('**/api/directory**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/api/directory/42' ? user : { items: [user], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } } }));
  await page.route('**/uploads/videos/custom-badge.png?badgeSize=256', route => route.fulfill({ contentType: 'image/png', body: png }));
  for (const route of ['kisisel-bilgiler', 'rehber']) {
    await page.goto(`/employee/${route}`);
    if (route === 'rehber') await page.locator('.directory-card').click();
    const cards = page.locator('.achievement-collection-card');
    await expect(cards).toHaveCount(2);
    const art = cards.filter({ has: page.locator('img') }).locator('img');
    await expect(art).toHaveAttribute('src', /\/uploads\/videos\/custom-badge.png\?badgeSize=256$/);
    await expect(art).toHaveAttribute('loading', 'eager');
    await expect(art).toHaveAttribute('fetchpriority', 'high');
    await expect.poll(() => art.evaluate(element => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await expect(art).toHaveCSS('object-fit', 'contain');
    const mobile = page.viewportSize()!.width <= 768;
    const imageBox = (await art.boundingBox())!;
    const cardBox = (await cards.filter({ has: page.locator('img') }).boundingBox())!;
    if (mobile) {
      expect(imageBox.width).toBeLessThanOrEqual(72);
      expect(imageBox.height).toBeLessThanOrEqual(72);
      expect(cardBox.width).toBeLessThanOrEqual(88);
      expect(cardBox.width).toBeGreaterThanOrEqual(44);
    } else {
      expect(imageBox.width).toBeGreaterThan(72);
    }
    await expect(cards.filter({ hasText: oldBadge.title }).locator('img, svg')).toHaveCount(0);
    await expect(page.locator('.achievement-collection-emblem')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await cards.filter({ has: page.locator('img') }).screenshot({ path: testInfo.outputPath(`badge-${route}.png`) });
  }
});

test('training editor replaces badge art and can remove it when badges are disabled', async ({ page }) => {
  await mockAuthenticatedApi(page);
  const video = { id: 90, title: 'Rozetli Eğitim', awards_badge: 1, requires_quiz: 0, requires_full_watch: 0, badge_image_url: '/uploads/videos/original.png' };
  await page.route('**/api/admin/all-videos?**', route => route.fulfill({ json: { items: [video], pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 } } }));
  const submitted: string[] = [];
  await page.route('**/api/admin/video/90', route => {
    if (route.request().method() === 'PUT') {
      submitted.push(route.request().postDataBuffer()?.toString('latin1') || '');
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: { lessons: [{ id: 1, title: 'Mevcut İçerik', module_id: 1, module_title: 'Temel Modül', content_type: 'pdf', url: '/uploads/videos/lesson.pdf' }] } });
  });
  await page.route('**/uploads/videos/original.png', route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.goto('/employee/moduller/egitimler');
  for (const replace of [true, false]) {
    await page.getByRole('button', { name: 'Rozetli Eğitim eğitimini düzenle', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Eğitimi düzenle' });
    await expect(dialog.getByRole('img', { name: 'Rozet önizlemesi' })).toHaveAttribute('src', /original.png$/);
    await dialog.locator('.training-badge-field').getByRole('button', { name: 'Kaldır' }).click();
    const save = dialog.locator('button[type=submit]');
    if (replace) {
      await save.click();
      await expect(page.getByText('Hata: Rozet verilecek eğitimler için rozet görseli yükleyin.', { exact: true })).toBeVisible();
      expect(submitted).toHaveLength(0);
      await dialog.getByLabel('Rozet görseli', { exact: true }).setInputFiles(image);
    } else {
      await dialog.getByRole('button', { name: 'Eğitim kuralları' }).click();
      await dialog.getByLabel('Rozet verilsin', { exact: true }).uncheck();
    }
    await save.click();
    await expect(dialog).toHaveCount(0);
  }
  expect(submitted[0]).toContain('name="badge_image_file"; filename="ozel-rozet.png"');
  expect(submitted[0]).toContain('name="remove_badge_image"\r\n\r\nfalse');
  expect(submitted[1]).toContain('name="remove_badge_image"\r\n\r\ntrue');
  expect(submitted[1]).toContain('name="awards_badge"\r\n\r\nfalse');
  expect(submitted[1]).not.toContain('name="badge_image_file"');
});
