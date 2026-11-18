import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockPolyvalenceApi } from './polyvalence-fixtures';
import { mockAuthenticatedApi } from './fixtures';

test('employee module headers share typography and fit every viewport', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await mockPolyvalenceApi(page);
  await page.route('**/api/document-request-types', route => route.fulfill({ json: [] }));
  await page.route('**/api/feedback/mine', route => route.fulfill({ json: [] }));
  await page.route('**/api/feedback/participating', route => route.fulfill({ json: [] }));
  const modules = [
    ['kariyer', 'Kariyer Merkezi'],
    ['duyurular', 'Şirket Duyuruları'],
    ['egitimler', 'Eğitimlerim'],
    ['izinler', 'İzin Talebi ve Takip'],
    ['belgelerim', 'Belgelerim'],
    ['oneri-sikayet', 'Öneri ve Şikâyet'],
    ['rehber', 'Çalışan Rehberi'],
    ['bilgi-portali', 'Bilgi Portalı'],
    ['anketler', 'Anketler'],
    ['servis-guzergahlari', 'Servis Güzergahlarım'],
    ['polivalans', 'Ekibimi Değerlendir'],
    ['moduller/polivalans?view=reports', 'Dönemler ve Raporlar'],
  ];
  let reference: { fontSize: string; fontFamily: string; lineHeight: string; iconWidth: number } | undefined;
  for (const [route, title] of modules) {
    await page.goto(`/employee/${route}`);
    const header = page.locator('.module-page-header');
    await expect(header.getByRole('heading', { name: title, level: 1, exact: true })).toBeAttached();
    if (page.viewportSize()!.width <= 768) {
      await expect(page.locator('.mobile-page-title')).not.toBeEmpty();
      await expect(page.locator('.mobile-header')).toHaveCSS('background-color', 'rgb(65, 54, 110)');
      await expect(page.getByRole('navigation', { name: 'Mobil ana menü' }).getByRole('link')).toHaveCount(3);
      if (route === 'belgelerim') {
        const button = header.getByRole('button', { name: 'Belge Talep Et' });
        await expect(button).toHaveCSS('border-top-color', 'rgb(109, 53, 232)');
        const action = (await button.boundingBox())!;
        const tabs = (await page.locator('.documents-page-tabs').boundingBox())!;
        expect(action.height).toBeGreaterThanOrEqual(44);
        expect(action.x + action.width).toBeCloseTo(tabs.x + tabs.width, 0);
        expect(tabs.y - (action.y + action.height)).toBeCloseTo(12, 0);
      }
    } else await expect(header.locator('h1')).toBeVisible();
    const metrics = await header.evaluate(element => {
      const title = element.querySelector('h1')!;
      const style = getComputedStyle(title);
      return { fontSize: style.fontSize, fontFamily: style.fontFamily, lineHeight: style.lineHeight, iconWidth: element.querySelector('.module-page-header-icon')!.getBoundingClientRect().width };
    });
    reference ??= metrics;
    expect(metrics, route).toEqual(reference);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), route).toBe(true);
    const accessibility = await new AxeBuilder({ page }).include('.module-page-header').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(accessibility.violations.filter(item => item.impact === 'serious' || item.impact === 'critical'), route).toEqual([]);
    if (['kariyer', 'rehber', 'moduller/polivalans?view=reports'].includes(route)) {
      await page.screenshot({ path: testInfo.outputPath(`${route.split('/').at(-1)!.split('?')[0]}.png`) });
    }
  }
  for (const route of ['anasayfa', 'kisisel-bilgiler']) {
    await page.goto(`/employee/${route}`);
    await expect(page.locator('.module-page-header')).toHaveCount(1);
    await expect(page.locator('h1')).toBeAttached();
  }
});

test('management module headers use the shared style and preserve create actions', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await mockAuthenticatedApi(page);
  await page.route('**/api/admin/announcements/departments', route => route.fulfill({ json: [] }));
  await page.route('**/api/admin/document-request-types', route => route.fulfill({ json: [] }));
  await page.route('**/api/mood-check/admin**', route => route.fulfill({ json: {
    items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    departments: [], summary: { total: 20, average_score: 3.5, callbacks: 0,
      anonymity_threshold: 5, suppressed: false, mood_counts: {}, reason_counts: {}, departments: {} },
  } }));
  const modules = [
    ['servis-guzergahlari', 'Servis Güzergahları İşlemleri', ''],
    ['egitimler', 'Eğitim İşlemleri', 'Yeni Eğitim Ekle'],
    ['kariyer', 'Kariyer İşlemleri', 'Yeni İlan'],
    ['duyurular', 'Duyuru İşlemleri', 'Yeni Duyuru Ekle'],
    ['haberler', 'Şirket Haberleri Yönetimi', 'Yeni Haber Ekle'],
    ['belgeler', 'Belge İşlemleri', ''],
    ['anketler', 'Anketler', 'Yeni Anket'],
    ['duygu-analizi', 'Duygu Durumu Analizi', ''],
    ['bilgi-portali', 'Bilgi İşlemleri', 'Kategori Ekle'],
    ['yemek-menusu', 'Yemek Menüsü', ''],
  ];
  let fontSize: string | undefined;
  for (const [route, title, createAction] of modules) {
    await page.goto(`/employee/moduller/${route}`);
    const header = page.locator('.module-page-header');
    await expect(header.getByRole('heading', { name: title, level: 1, exact: true })).toBeAttached();
    if (page.viewportSize()!.width <= 768) {
      await expect(page.locator('.mobile-page-title')).not.toBeEmpty();
      await expect(page.locator('.mobile-header')).toHaveCSS('background-color', 'rgb(65, 54, 110)');
    } else await expect(header.locator('h1')).toBeVisible();
    const size = await header.locator('h1').evaluate(element => getComputedStyle(element).fontSize);
    fontSize ??= size;
    expect(size, route).toEqual(fontSize);
    if (route === 'duygu-analizi') {
      const analyze = header.getByRole('button', { name: 'AI Analiz Et' });
      await expect(analyze).toBeEnabled();
      if (page.viewportSize()!.width <= 768) await expect(analyze).toHaveCSS('border-top-color', 'rgb(109, 53, 232)');
      const exportArea = page.viewportSize()!.width <= 768 ? page.locator('.mood-admin-card') : header;
      await expect(exportArea.getByRole('button', { name: "Excel'e Aktar" })).toBeEnabled();
      await expect(page.getByRole('button', { name: "Excel'e Aktar" })).toHaveCount(1);
    }
    if (route === 'servis-guzergahlari') {
      const actionArea = page.viewportSize()!.width <= 768 ? header : page.locator('.service-route-sidebar');
      await expect(page.getByRole('button', { name: 'Yeni Hat' })).toHaveCount(1);
      await actionArea.getByRole('button', { name: 'Yeni Hat' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), route).toBe(true);
    const result = await new AxeBuilder({ page }).include('.module-page-header').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(result.violations.filter(item => item.impact === 'serious' || item.impact === 'critical'), route).toEqual([]);
    if (['duyurular', 'duygu-analizi', 'yemek-menusu'].includes(route)) {
      await page.screenshot({ path: testInfo.outputPath(`admin-${route}.png`) });
    }
    if (createAction) {
      await header.getByRole('button', { name: createAction }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  }
});

test('mobile training actions keep equal touch targets and stack on narrow screens', async ({ page }) => {
  test.skip(page.viewportSize()!.width !== 375, 'Exercises the mobile breakpoint once.');
  await mockAuthenticatedApi(page);
  await page.goto('/employee/moduller/egitimler');
  const assign = page.getByRole('button', { name: 'Eğitim Ata', exact: true });
  const create = page.getByRole('button', { name: 'Yeni Eğitim Ekle', exact: true });
  await expect(assign).toBeVisible();
  await expect(create).toBeVisible();
  const first = (await assign.boundingBox())!;
  const second = (await create.boundingBox())!;
  expect(first.width).toBeCloseTo(second.width, 0);
  expect(first.y).toBe(second.y);
  expect(first.height).toBeGreaterThanOrEqual(44);
  expect(first.height).toBe(second.height);
  await page.setViewportSize({ width: 320, height: 812 });
  const narrowFirst = (await assign.boundingBox())!;
  const narrowSecond = (await create.boundingBox())!;
  expect(narrowFirst.x).toBe(narrowSecond.x);
  expect(narrowFirst.width).toBe(narrowSecond.width);
  expect(narrowSecond.y - (narrowFirst.y + narrowFirst.height)).toBeCloseTo(8, 0);
});
