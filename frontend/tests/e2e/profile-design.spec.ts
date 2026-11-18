import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { adminUser, mockAuthenticatedApi } from './fixtures';

async function mockProfile(page: Page) {
  await mockAuthenticatedApi(page);
  const state = {
    profile: {
      ...adminUser, photo_path: null as string | null,
      email: 'test@example.com', phone: '05551234567', birth_date: '1992-05-18', address: 'Bursa',
      emergency_contact_name: 'Yakın Kişi', emergency_contact_phone: '05559876543', blood_type: 'A+',
      clothing_top: 'L', clothing_bottom: 'M', shoe_size: '42',
      education_entries: [{ id: 27, school: 'Uludağ Üniversitesi', department: 'Endüstri Mühendisliği', start_year: 2010, end_year: 2014, is_current: false }],
      skill_tags: ['Excel', 'Süreç İyileştirme', 'Takım Yönetimi'], hobby_tags: ['Fotoğrafçılık', 'Doğa Yürüyüşü'],
    },
    saveFails: false, photoFails: false, saves: 0, photos: 0,
  };
  await page.route('**/api/session', route => route.fulfill({ json: { ...adminUser, photo_url: state.profile.photo_path } }));
  await page.route('**/api/user/profile', route => {
    if (route.request().method() === 'PUT') {
      state.saves++;
      if (state.saveFails) return route.fulfill({ status: 422, json: { message: 'Bilgiler kaydedilemedi. Tekrar deneyin.' } });
      state.profile = { ...state.profile, ...route.request().postDataJSON() };
      return route.fulfill({ json: { profile: state.profile } });
    }
    return route.fulfill({ json: state.profile });
  });
  await page.route('**/api/videos/summary', route => route.fulfill({ json: { completed: 4, badges: 15, pending: 2, total: 6, expired: 0 } }));
  await page.route('**/api/videos?**', route => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({ json: {
      items: [{ id: current, assignment_id: current * 100, title: current === 1 ? 'İş Sağlığı ve Güvenliği' : 'Liderlik Eğitimi', certificate_enabled: 0 }],
      pagination: { page: current, pageSize: 12, total: 15, totalPages: 2 },
    } });
  });
  await page.route('**/api/personal-info/photo', route => {
    state.photos++;
    if (state.photoFails) return route.fulfill({ status: 400, json: { message: 'Fotoğraf yüklenemedi.' } });
    state.profile.photo_path = `/uploads/profiles/avatar-${state.photos}.png`;
    return route.fulfill({ json: { photo_path: state.profile.photo_path } });
  });
  return state;
}

test('profile shares the theme, adapts to screen width and has accessible edit forms', async ({ page }, testInfo) => {
  await mockProfile(page);
  await page.goto('/employee/kisisel-bilgiler');
  const mobile = page.viewportSize()!.width <= 768;
  await expect(page.locator('h1')).toHaveText('Profilim');
  await expect(page.getByRole('heading', { name: adminUser.name })).toBeVisible();
  await expect(page.locator('.profile-summary-card--violet')).toContainText('4');
  // The total comes from the summary, not the current page's single badge.
  await expect(page.locator('.profile-summary-card--teal')).toContainText('15');
  await expect(page.locator('.profile-summary-card--coral')).toContainText('1001');
  await expect(page.locator('.profile-details-card-contact')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.locator('.profile-canvas')).toHaveCSS('background-color', 'rgb(245, 243, 252)');
  if (mobile) {
    await expect(page.locator('.mobile-page-title')).toHaveText('Profilim');
    await expect(page.getByRole('navigation', { name: 'Mobil ana menü' }).getByRole('link', { name: 'Profilim' })).toHaveClass(/active/);
  }
  const contact = (await page.locator('.profile-details-card-contact').boundingBox())!;
  const about = (await page.locator('.profile-details-card-about').boundingBox())!;
  expect(mobile ? about.y > contact.y : Math.abs(about.y - contact.y) < 2).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('profile-redesign.png'), fullPage: true });
  for (const section of ['İletişim Bilgileri', 'Hakkımda', 'Detaylı Bilgiler']) {
    await page.getByRole('button', { name: `${section} bilgilerini düzenle` }).click();
    const result = await new AxeBuilder({ page }).include('.profile-page').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'İptal', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Sonraki sayfa' }).click();
  await expect(page.getByRole('button', { name: 'Liderlik Eğitimi', exact: true })).toBeVisible();
  await expect(page.locator('.profile-summary-card--teal')).toContainText('15');
  await page.getByRole('button', { name: 'Liderlik Eğitimi', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Eğitim Sertifikası' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Liderlik Eğitimi', exact: true })).toBeFocused();
});

test('cancel and failed saves preserve data and allow a successful retry', async ({ page }) => {
  const state = await mockProfile(page);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/employee/kisisel-bilgiler');
  const edit = page.getByRole('button', { name: 'İletişim Bilgileri bilgilerini düzenle' });
  await edit.click();
  await page.getByLabel('Telefon Numarası').fill('05550000000');
  await page.getByRole('button', { name: 'İptal', exact: true }).click();
  expect(state.saves).toBe(0);
  await edit.click();
  await expect(page.getByLabel('Telefon Numarası')).toHaveValue('05551234567');
  await page.getByLabel('Telefon Numarası').fill('05550000000');
  state.saveFails = true;
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.locator('.profile-message')).toHaveText('Bilgiler kaydedilemedi. Tekrar deneyin.');
  await expect(page.getByLabel('Telefon Numarası')).toHaveValue('05550000000');
  state.saveFails = false;
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.locator('.profile-message')).toHaveText('Profiliniz başarıyla güncellendi.');
  await expect(edit).toBeVisible();
  await page.reload();
  await expect(page.locator('.profile-details-card-contact')).toContainText('05550000000');
  await expect(page.getByText('Uludağ Üniversitesi', { exact: true })).toBeVisible();
  expect(state.profile.clothing_bottom).toBe('M');
  expect(state.profile.skill_tags).toEqual(['Excel', 'Süreç İyileştirme', 'Takım Yönetimi']);
  expect(errors).toEqual([]);
});

test('photo failures can be retried and refresh both profile and sidebar', async ({ page }) => {
  const state = await mockProfile(page);
  await page.goto('/employee/kisisel-bilgiler');
  const photo = { name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aENsAAAAASUVORK5CYII=', 'base64') };
  state.photoFails = true;
  await page.getByLabel('Profil fotoğrafı', { exact: true }).setInputFiles(photo);
  await expect(page.locator('.profile-message')).toHaveText('Fotoğraf yüklenemedi.');
  state.photoFails = false;
  await page.getByLabel('Profil fotoğrafı', { exact: true }).setInputFiles(photo);
  await expect(page.locator('.profile-message')).toHaveText('Profil fotoğrafı güncellendi.');
  await expect(page.locator('.profile-avatar-image')).toHaveAttribute('src', /avatar-2\.png$/);
  await expect(page.locator('.sidebar-avatar img')).toHaveAttribute('src', /avatar-2\.png$/);
  expect(state.photos).toBe(2);
});

test('read failures stay distinct from empty data and recover without reloading', async ({ page }) => {
  await mockProfile(page);
  let failed = true;
  for (const endpoint of ['user/profile', 'videos/summary', 'videos?**']) {
    await page.route(`**/api/${endpoint}`, route => failed
      ? route.fulfill({ status: 503, json: { message: 'Geçici hata' } })
      : route.fallback());
  }
  await page.goto('/employee/kisisel-bilgiler');
  await expect(page.getByText('Profil bilgileri alınamadı', { exact: true })).toBeVisible();
  await expect(page.getByText('Rozetler alınamadı', { exact: true })).toBeVisible();
  await expect(page.getByText('Eğitim özeti alınamadı', { exact: true })).toBeVisible();
  await expect(page.locator('.profile-summary-card--violet strong')).toHaveText('—');
  await expect(page.locator('.profile-summary-card--teal strong')).toHaveText('—');
  await expect(page.getByText('Henüz kazanılmış bir rozetiniz bulunmuyor.')).toHaveCount(0);
  failed = false;
  for (const title of ['Profil bilgileri alınamadı', 'Rozetler alınamadı', 'Eğitim özeti alınamadı']) {
    await page.getByRole('alert').filter({ hasText: title }).getByRole('button', { name: 'Yeniden Dene' }).click();
  }
  await expect(page.locator('.profile-details-card-contact')).toBeVisible();
  await expect(page.getByRole('button', { name: 'İş Sağlığı ve Güvenliği', exact: true })).toBeVisible();
  await expect(page.locator('.profile-summary-card--teal strong')).toHaveText('15');
});
