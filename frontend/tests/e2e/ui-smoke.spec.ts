import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectModuleTitle, mockAuthenticatedApi } from './fixtures';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
}

async function expectNoSeriousA11yViolations(page: import('@playwright/test').Page) {
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const blocking = result.violations.filter((violation) => violation.impact === 'critical' || violation.impact === 'serious');
  expect(blocking).toEqual([]);
}

test('login is usable and accessible', async ({ page }) => {
  await page.route('**/api/session', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.goto('/login');

  await expect(page.locator('.login-product-name')).toHaveText('İKBenimle');
  await expect(page.getByRole('button', { name: 'Giriş Yap' })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveCount(0);
  await page.getByLabel('Şifre', { exact: true }).fill('preview-password');
  await page.getByRole('button', { name: 'Şifreyi göster' }).click();
  await expect(page.getByLabel('Şifre', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Şifreyi gizle' }).click();
  await expect(page.getByLabel('Şifre', { exact: true })).toHaveAttribute('type', 'password');
  await expect(page.getByLabel('Şifre', { exact: true })).toHaveValue('preview-password');
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11yViolations(page);
});

test('employee home renders without overflow', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/anasayfa');

  await expect(page.getByRole('heading', { name: /Hoş geldin, Test Yönetici/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hızlı Erişim' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11yViolations(page);
});

test('profile sections are read-only until edited and structured details can be saved', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/kisisel-bilgiler');

  await expect(page.getByRole('button', { name: 'İletişim Bilgileri bilgilerini düzenle' })).toBeVisible();
  await expect(page.getByLabel('E-Posta Adresi')).toHaveCount(0);
  await page.getByRole('button', { name: 'Hakkımda bilgilerini düzenle' }).click();
  await page.getByRole('button', { name: 'İlk eğitim kaydını ekle' }).click();
  await page.getByLabel('Okul').fill('Uludağ Üniversitesi');
  await page.getByLabel('Bölüm').fill('Bilgisayar Mühendisliği');
  const skillsInput = page.getByRole('textbox', { name: 'Yetenekler ve Uzmanlıklar' });
  await skillsInput.fill('SQL');
  await page.getByRole('button', { name: 'Ekle', exact: true }).first().click();
  await skillsInput.fill('Excel');
  await page.locator('.profile-details-card-about').getByRole('button', { name: 'Kaydet' }).click();

  await expect(page.getByText('Uludağ Üniversitesi')).toBeVisible();
  await expect(page.locator('.profile-tag-readonly', { hasText: 'SQL' })).toBeVisible();
  await expect(page.locator('.profile-tag-readonly', { hasText: 'Excel' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11yViolations(page);
});

test('leave options share the violet palette and selection follows the chosen type', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route('**/api/leave-requests?**', route => route.fulfill({ json: {
    items: ['Onaylandı', 'Reddedildi', 'Beklemede'].map((status, index) => ({
      id: index + 1, status, leave_type: 'YILLIK İZİN', duration_type: 'Gün', duration_value: 1,
      start_datetime: '2026-11-10T08:00:00', end_datetime: '2026-11-10T17:00:00',
    })),
    pagination: { page: 1, pageSize: 10, total: 3, totalPages: 1 },
  } }));
  await page.goto('/employee/izinler');
  await expectModuleTitle(page, 'İzin Talebi ve Takip', 'İzinlerim');

  const annual = page.getByRole('button', { name: 'YILLIK İZİN', exact: true });
  const excuse = page.getByRole('button', { name: 'MAZERET', exact: true });
  await expect(annual).toHaveAttribute('aria-pressed', 'true');
  const highlight = 'linear-gradient(120deg, rgb(121, 67, 238), rgb(89, 36, 211))';
  await expect(annual).toHaveCSS('background-image', highlight);
  await excuse.click();
  await expect(excuse).toHaveAttribute('aria-pressed', 'true');
  await expect(excuse).toHaveCSS('background-image', highlight);
  await expect(annual).toHaveCSS('background-image', 'none');
  await expect(page.locator('.leave-request-summary')).toContainText('MAZERET');

  const submit = page.getByRole('button', { name: 'Talebi Gönder' });
  await expect(submit).toHaveCSS('background-color', 'rgb(109, 53, 232)');
  const statuses = page.locator('.leave-request-status');
  await expect(statuses).toHaveText(['Onaylandı', 'Reddedildi', 'Beklemede']);
  expect(new Set(await statuses.evaluateAll(labels => labels.map(label => getComputedStyle(label).background))).size).toBe(3);
  await expectNoHorizontalOverflow(page);
});

test('training dashboard keeps long certificate numbers separate from approval dates', async ({ page }) => {
  await mockAuthenticatedApi(page);
  const reference = `IKB-2026-${'1234567890'.repeat(6)}`;
  await page.route('**/api/admin/stats?**', (route) => {
    const overdue = new URL(route.request().url()).searchParams.get('status') === 'expired';
    return route.fulfill({ json: {
      items: overdue ? [] : [{
        assignment_id: 71, name: 'Test Çalışan', employee_id: '1002', title: 'İSG Eğitimi',
        status: 'completed', reference_id: reference, confirmed_at: '2026-11-10T12:00:00.000Z',
      }],
      pagination: { page: 1, pageSize: 25, total: overdue ? 0 : 1, totalPages: overdue ? 0 : 1 },
      summary: { total: 1, completed: 1, cancelled: 0, overdue: 0, passed: 1 },
    } });
  });
  await page.goto('/employee/moduller/egitimler');

  await expectModuleTitle(page, 'Eğitim İşlemleri');
  await expect(page.getByRole('heading', { name: 'Eğitim Durumu' })).toBeVisible();
  await expect(page.locator('.training-dashboard-metric.violet')).toContainText('%100');
  if (page.viewportSize()!.width <= 768) {
    await page.getByText('Tüm atama bilgileri', { exact: true }).click();
    const details = page.locator('.training-report-mobile-detail-list');
    await expect(details.locator('.mobile-data-row').filter({ hasText: 'Sertifika Ref' })).toContainText(reference);
    await expect(details.locator('.mobile-data-row').filter({ hasText: 'Onay Tarihi' })).toContainText('10.11.2026');
  } else {
    const tableRegion = page.getByRole('region', { name: 'Atama Kayıtları' });
    const certificate = tableRegion.getByRole('cell', { name: reference, exact: true });
    await expect(certificate).toBeVisible();
    await tableRegion.scrollIntoViewIfNeeded();
    await tableRegion.evaluate((region) => { region.scrollLeft = region.scrollWidth; });
    const approval = tableRegion.getByRole('cell', { name: '10.11.2026', exact: true });
    await expect(approval).toBeInViewport({ ratio: 1 });
    await expect(certificate).toBeInViewport({ ratio: 1 });
    expect(await certificate.evaluate((cell) => {
      const range = document.createRange();
      range.selectNodeContents(cell);
      const bounds = cell.getBoundingClientRect();
      return Array.from(range.getClientRects()).every((line) => line.left >= bounds.left && line.right <= bounds.right);
    })).toBe(true);
  }
  await expectNoHorizontalOverflow(page);
});

test('cancelled training assignment is labelled correctly and cannot be cancelled again', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route('**/api/admin/stats?**', (route) => {
    const url = new URL(route.request().url());
    const items = url.searchParams.get('status') === 'expired' ? [] : [{
      assignment_id: 71,
      name: 'Test Çalışan',
      employee_id: '1002',
      department: 'Pres',
      title: 'İSG Eğitimi',
      pass_score: 70,
      status: 'cancelled',
      quiz_score: null,
      assigned_at: '2026-10-01T09:00:00.000Z',
    }];
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items,
        pagination: { page: 1, pageSize: 25, total: items.length, totalPages: items.length ? 1 : 0 },
        summary: { total: items.length, completed: 0, cancelled: items.length, overdue: 0, passed: 0 },
      }),
    });
  });
  await page.goto('/employee/moduller/egitimler');

  await expect(page.locator('.badge-cancelled:visible')).toHaveText('Kaldırıldı');
  await expect(page.getByRole('button', { name: 'Test Çalışan eğitim atamasını kaldır' })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('employee training card uses the uploaded cover image', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/egitimler');

  const cover = page.getByRole('img', { name: 'Güvenli Video Eğitimi kapak görseli' });
  await expect(cover).toBeVisible();
  await expect(cover).toHaveAttribute('src', /\/uploads\/videos\/training-cover\.jpg$/);
  await expect(page.locator('img[src*="picsum.photos"]')).toHaveCount(0);
});

test('page data loading uses the centered accessible spinner', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route('**/api/videos?**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        pagination: { page: 1, pageSize: 12, total: 0, totalPages: 0 },
      }),
    });
  });

  await page.goto('/employee/egitimler');
  const loader = page.getByRole('status', { name: 'Eğitimler yükleniyor', exact: true });
  await expect(loader).toBeVisible();
  await expect(loader.locator('.ui-loading-spinner')).toBeVisible();
  await expect(loader.getByText('Eğitimler yükleniyor')).toBeHidden();
});

test('training editor supports multiple titled contents in one module', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/moduller/egitimler');
  await page.getByRole('button', { name: 'Yeni Eğitim Ekle' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yeni eğitim ekle' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Modül Başlığı').fill('Kaizen Temelleri');
  await dialog.getByLabel('İçerik Başlığı').fill('Kaizen nedir?');
  await expect(dialog.getByLabel('İçerik URL')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Video / PDF Ekle' }).click();
  await dialog.getByLabel('İçerik Başlığı').nth(1).fill('Örnek uygulama');
  await expect(dialog.getByLabel('İçerik Başlığı')).toHaveCount(2);
  await expect(dialog.getByText('Modül Sınavı (0)')).toBeVisible();
  await dialog.getByRole('button', { name: 'Soru Ekle' }).click();
  await dialog.getByPlaceholder('1. soru').fill('Kaizen sürekli gelişim midir?');
  await dialog.getByPlaceholder('1. seçenek').fill('Evet');
  await dialog.getByPlaceholder('2. seçenek').fill('Hayır');
  await expect(dialog.getByText('Modül Sınavı (1)')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('training module questions are included in the create request', async ({ page }) => {
  let submittedBody = '';
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/admin/video') {
      submittedBody = request.postData() || '';
    }
  });
  await mockAuthenticatedApi(page);
  await page.goto('/employee/moduller/egitimler');
  await page.getByRole('button', { name: 'Yeni Eğitim Ekle' }).click();
  const dialog = page.getByRole('dialog', { name: 'Yeni eğitim ekle' });
  await dialog.locator('.input-group').filter({ hasText: 'Eğitim Başlığı' }).locator('input').fill('Sınavlı Eğitim');
  await dialog.getByLabel('Rozet görseli', { exact: true }).setInputFiles({ name: 'badge.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
  await dialog.getByLabel('Modül Başlığı').fill('Temel Bilgiler');
  await dialog.getByLabel('İçerik Başlığı').fill('Giriş Videosu');
  await dialog.locator('.input-group').filter({ hasText: 'Video Süresi' }).locator('input').fill('300');
  await dialog.locator('.training-content-editor input[type="file"]').setInputFiles({
    name: 'egitim.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('video'),
  });
  await dialog.getByRole('button', { name: 'Soru Ekle' }).click();
  await dialog.getByPlaceholder('1. soru').fill('Doğru seçenek hangisi?');
  await dialog.getByPlaceholder('1. seçenek').fill('Doğru');
  await dialog.getByPlaceholder('2. seçenek').fill('Yanlış');
  await dialog.getByRole('button', { name: 'Eğitimi Kaydet' }).click();
  await expect(page.getByText('Eğitim ve tüm modülleri başarıyla eklendi.')).toBeVisible();
  expect(submittedBody).toContain('Doğru seçenek hangisi?');
  expect(submittedBody).toContain('"quizData"');
});

test('training assignment searches open from compact icon controls', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/moduller/egitimler');
  await page.getByRole('button', { name: 'Eğitim Ata' }).click();

  const dialog = page.getByRole('dialog', { name: 'Eğitim atama' });
  await expect(dialog.getByLabel('Eğitim arama metni')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Eğitim ara' }).click();
  await expect(dialog.getByLabel('Eğitim arama metni')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Eğitim aramasını kapat' })).toBeVisible();

  await expect(dialog.getByLabel('Çalışan arama metni')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Çalışan ara' }).click();
  await expect(dialog.getByLabel('Çalışan arama metni')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Çalışan aramasını kapat' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('training player locks native video controls and opens the quiz after completion', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/egitimler/42');

  const video = page.locator('video');
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('controlslist', /nodownload/);
  await expect(video).toHaveAttribute('controlslist', /noplaybackrate/);
  await expect(video).toHaveAttribute('disablepictureinpicture', '');
  await expect(page.getByRole('button', { name: 'Önce İçeriği Tamamla' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sınava Geç', exact: true })).toHaveCount(0);
  await expect(page.getByText('İçerik tamamlandığında sınava geçebilirsiniz.')).toBeVisible();

  const playbackRate = await video.evaluate((element) => {
    const media = element as HTMLVideoElement;
    media.playbackRate = 2;
    media.dispatchEvent(new Event('ratechange'));
    return media.playbackRate;
  });
  expect(playbackRate).toBe(1);

  const position = await video.evaluate((element) => {
    const media = element as HTMLVideoElement;
    let currentTime = 20;
    Object.defineProperty(media, 'currentTime', {
      configurable: true,
      get: () => currentTime,
      set: (value: number) => { currentTime = value; },
    });
    media.dispatchEvent(new Event('seeking'));
    return media.currentTime;
  });
  expect(position).toBe(0);

  await video.dispatchEvent('ended');
  await expect(page.getByRole('heading', { name: 'Modül Sınavı' })).toBeVisible();
});

test('quiz olmayan eğitim tamamlandıktan sonra çalışan onayı kaydedilir', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/egitimler/43');

  await page.locator('video').dispatchEvent('ended');
  await expect(page.getByRole('heading', { name: 'Eğitim Tamamlama' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Okudum ve onaylıyorum.' }).check();
  await page.getByRole('button', { name: 'Onayla' }).click();

  await expect(page.getByText('Eğitim başarıyla tamamlandı ve onaylandı.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Modül Sınavı' })).toHaveCount(0);
});

test('tamamlanan eğitime yeniden girildiğinde çalışan onayı tekrar açılabilir', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/egitimler/43');
  await page.locator('video').dispatchEvent('ended');
  await expect(page.getByRole('heading', { name: 'Eğitim Tamamlama' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Eğitimi Tamamla' })).toBeVisible();
  await page.getByRole('button', { name: 'Eğitimi Tamamla' }).click();
  await expect(page.getByRole('heading', { name: 'Eğitim Tamamlama' })).toBeVisible();
});

test('sertifikasız ve sınavsız eğitim tamamlandığında bitir aksiyonu görünür', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/egitimler/44');
  await page.locator('video').dispatchEvent('ended');
  await expect(page.getByRole('button', { name: 'Eğitimi Bitir' })).toBeVisible();
});

test('boş eski quiz kaydı yüzde yüz izlenen eğitimi aksiyonsuz bırakmaz', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/egitimler/45');

  await expect(page.getByRole('button', { name: 'İzlemeyi Tamamla' })).toBeVisible();
  await page.getByRole('button', { name: 'İzlemeyi Tamamla' }).click();
  await expect(page.getByRole('heading', { name: 'Eğitim Tamamlama' })).toBeVisible();
});

test('user creation modal is keyboard accessible', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/moduller/kullanicilar');

  await page.getByRole('button', { name: 'Yeni Kullanıcı Ekle' }).click();
  await expect(page.getByRole('dialog', { name: 'Yeni Kullanıcı Tanımla' })).toBeVisible();
  await expect(page.locator('[role="dialog"] :focus')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await expectNoSeriousA11yViolations(page);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Yeni Kullanıcı Ekle' })).toBeFocused();
});

for (const birthDate of ['1990-05-14T00:00:00.000Z', '1990-05-14', null]) {
  test(`user editing displays and preserves birth date ${birthDate}`, async ({ page }) => {
    await mockAuthenticatedApi(page);
    await page.route('**/api/admin/users?**', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        items: [{
          id: 12, employee_id: '1012', name: 'Test Çalışan', department: 'Pres',
          role: 'employee', permissions: [], status: 'active', birth_date: birthDate,
        }],
        pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
      }),
    }));
    await page.route('**/api/admin/users/12', (route) => route.fulfill({
      contentType: 'application/json', body: JSON.stringify({ success: true }),
    }));
    await page.goto('/employee/moduller/kullanicilar');
    await page.getByRole('button', { name: 'Test Çalışan kullanıcısını düzenle' }).click();

    const expectedDate = birthDate ? '1990-05-14' : '';
    await expect(page.getByLabel('Doğum Tarihi')).toHaveValue(expectedDate);
    const saveRequest = page.waitForRequest((request) => (
      request.url().endsWith('/api/admin/users/12') && request.method() === 'PUT'
    ));
    await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click();
    expect((await saveRequest).postDataJSON().birth_date).toBe(expectedDate);
    await expect(page.getByRole('dialog')).toBeHidden();
  });
}
