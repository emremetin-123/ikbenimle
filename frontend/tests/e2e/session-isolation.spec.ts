import { expect, test, type Page } from '@playwright/test';
import { adminUser, mockAuthenticatedApi } from './fixtures';

type Account = 'A' | 'B';
const profile = (account: Account) => ({
  ...adminUser,
  id: account === 'A' ? 901 : 902,
  employee_id: `audit-${account.toLowerCase()}`,
  name: `Audit Kullanıcı ${account}`,
  role: 'employee',
  permissions: ['view_documents', 'view_service_routes'],
  email: `audit-${account.toLowerCase()}@example.invalid`,
  address: `SADECE_${account}_ADRES`,
  education_entries: [], skill_tags: [], hobby_tags: [],
});

const gate = () => {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
};

async function navigate(page: Page, path: string) {
  // Keep the same application instance, as clicking a client-side link does.
  await page.evaluate(path => {
    history.pushState({}, '', path);
    window.dispatchEvent(new Event('app:navigation'));
  }, path);
}

async function setup(page: Page) {
  await mockAuthenticatedApi(page);
  const state = {
    account: 'A' as Account | null,
    rejectBProfile: false,
    heldProfiles: null as ReturnType<typeof gate> | null,
    profileStarted: gate(),
    heldSession: null as { gate: ReturnType<typeof gate>; started: ReturnType<typeof gate>; status: number } | null,
    saves: [] as { account: Account | null; email: string; address: string }[],
  };
  await page.route('**/api/login', async route => {
    state.account = route.request().postDataJSON().employee_id === 'audit-a' ? 'A' : 'B';
    await route.fulfill({ json: profile(state.account) });
  });
  await page.route('**/api/logout', async route => {
    state.account = null;
    await route.fulfill({ json: { success: true } });
  });
  await page.route('**/api/session', async route => {
    const account = state.account;
    const held = state.heldSession;
    state.heldSession = null;
    if (held) {
      held.started.release();
      await held.gate.promise;
    }
    const status = held?.status ?? (account ? 200 : 401);
    await route.fulfill({ status, json: status === 200 && account ? profile(account) : { error: 'SESSION_EXPIRED' } });
  });
  await page.route('**/api/user/profile', async route => {
    const account = state.account;
    if (!account) return route.fulfill({ status: 401, json: { error: 'SESSION_EXPIRED' } });
    if (account === 'A' && state.heldProfiles) {
      state.profileStarted.release();
      await state.heldProfiles.promise;
    }
    if (account === 'B' && state.rejectBProfile) {
      return route.fulfill({ status: 503, json: { error: 'B_PROFIL_HATASI' } });
    }
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON();
      state.saves.push({ account, email: body.email, address: body.address });
      return route.fulfill({ json: { profile: { ...profile(account), ...body } } });
    }
    await route.fulfill({ json: profile(account) }).catch(() => { /* The old query may be aborted at logout. */ });
  });
  await page.route('**/api/documents?**', route => {
    const account = state.account;
    return route.fulfill({ json: {
      items: [{ id: account === 'A' ? 801 : 802, title: `${account}_TEST_BORDRO`, upload_date: '2026-11-03', file_path: `/uploads/documents/${account}.pdf` }],
      pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
    } });
  });
  await page.route('**/api/document-request-types', route => route.fulfill({ json: [] }));
  return state;
}

async function switchToB(page: Page) {
  const mobileMenu = page.getByRole('button', { name: 'Menüyü aç', exact: true });
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await page.locator('.employee-sidebar-logout').click();
  await expect(page.locator('#login-employee-id')).toBeVisible();
  await page.locator('#login-employee-id').fill('audit-b');
  await page.locator('#login-password').fill('fake-test-password');
  await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/anasayfa$/);
  await navigate(page, '/employee/kisisel-bilgiler');
}

test('account switch isolates profile, documents and profile writes', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/employee/belgelerim');
  await expect(page.getByText('A_TEST_BORDRO', { exact: true })).toBeVisible();
  await navigate(page, '/employee/kisisel-bilgiler');
  await expect(page.getByText(profile('A').email, { exact: true })).toBeVisible();
  await switchToB(page);
  await expect(page.getByText(profile('B').email, { exact: true })).toBeVisible();
  await expect(page.getByText(profile('A').address, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'İletişim Bilgileri bilgilerini düzenle' }).click();
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Profiliniz başarıyla güncellendi.');
  expect(state.saves).toEqual([{ account: 'B', email: profile('B').email, address: profile('B').address }]);
  await navigate(page, '/employee/belgelerim');
  await expect(page.getByText('B_TEST_BORDRO', { exact: true })).toBeVisible();
  await expect(page.getByText('A_TEST_BORDRO', { exact: true })).toHaveCount(0);
});

test('new account network failure never reveals cached old profile', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/employee/kisisel-bilgiler');
  await expect(page.getByText(profile('A').email, { exact: true })).toBeVisible();
  state.rejectBProfile = true;
  await switchToB(page);
  await expect(page.getByText('B_PROFIL_HATASI')).toBeVisible();
  await expect(page.getByText(profile('A').email, { exact: true })).toHaveCount(0);
  await expect(page.getByText(profile('A').address, { exact: true })).toHaveCount(0);
});

test('late old profile response cannot populate the new account cache', async ({ page }) => {
  const state = await setup(page);
  const held = gate();
  state.heldProfiles = held;
  await page.goto('/employee/kisisel-bilgiler');
  await state.profileStarted.promise;
  await switchToB(page);
  await expect(page.getByText(profile('B').email, { exact: true })).toBeVisible();
  await Promise.all([
    page.waitForResponse(async response => response.url().endsWith('/api/user/profile')
      && response.status() === 200 && (await response.json()).email === profile('A').email),
    Promise.resolve().then(() => held.release()),
  ]);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByText(profile('A').email, { exact: true })).toHaveCount(0);
  await expect(page.getByText(profile('B').email, { exact: true })).toBeVisible();
});

for (const status of [200, 401]) {
  test(`late old session ${status} cannot restore or expire a new login`, async ({ page }) => {
    const state = await setup(page);
    await page.goto('/employee/kisisel-bilgiler');
    await expect(page.getByText(profile('A').email, { exact: true })).toBeVisible();
    const held = { gate: gate(), started: gate(), status };
    state.heldSession = held;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await held.started.promise;
    await switchToB(page);
    await expect(page.getByText(profile('B').email, { exact: true })).toBeVisible();
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/api/session') && response.status() === status),
      Promise.resolve().then(() => held.gate.release()),
    ]);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(page.getByRole('heading', { name: profile('B').name, exact: true })).toBeVisible();
    await expect(page.getByText(profile('A').email, { exact: true })).toHaveCount(0);
  });
}

test('session expiry clears the previous account before a different login', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/employee/kisisel-bilgiler');
  await expect(page.getByText(profile('A').email, { exact: true })).toBeVisible();
  state.account = null;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('#login-employee-id')).toBeVisible();
  await page.locator('#login-employee-id').fill('audit-b');
  await page.locator('#login-password').fill('fake-test-password');
  await page.getByRole('button', { name: 'Giriş Yap', exact: true }).click();
  await expect(page).toHaveURL(/\/employee\/anasayfa$/);
  await navigate(page, '/employee/kisisel-bilgiler');
  await expect(page.getByText(profile('B').email, { exact: true })).toBeVisible();
  await expect(page.getByText(profile('A').email, { exact: true })).toHaveCount(0);
});

test('map stop names stay literal text without HTML elements or image requests', async ({ page }) => {
  await setup(page);
  const injectedName = '<strong data-audit="tooltip">DURAK</strong><img src="/__audit_html_probe__" onerror="window.__tooltipProbe=true">';
  const probes: string[] = [];
  page.on('request', request => { if (request.url().includes('/__audit_html_probe__')) probes.push(request.url()); });
  await page.route('https://*.tile.openstreetmap.org/**', route => route.abort());
  await page.route('https://router.project-osrm.org/**', route => route.abort());
  await page.route('**/api/service-routes?**', route => route.fulfill({ json: {
    items: [{ id: 1, name: 'Test Servis', color: '#2563eb', stops: [
      { id: 1, name: injectedName, latitude: 40.808, longitude: 29.43 },
      { id: 2, name: 'Normal durak', latitude: 40.81, longitude: 29.44 },
    ] }],
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
  } }));
  await page.goto('/employee/servis-guzergahlari');
  await page.locator('.leaflet-marker-icon').first().hover();
  await expect(page.locator('.leaflet-tooltip')).toHaveText(injectedName);
  await expect(page.locator('.leaflet-tooltip strong, .leaflet-tooltip img')).toHaveCount(0);
  expect(probes).toEqual([]);
  expect(await page.evaluate(() => '__tooltipProbe' in window)).toBe(false);
});
