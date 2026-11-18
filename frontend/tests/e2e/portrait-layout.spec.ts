import { expect, test, type Locator } from '@playwright/test';
import { adminUser, mockAuthenticatedApi } from './fixtures';

async function expectCenteredPortrait(portrait: Locator, frame: Locator, minimum: number) {
  await expect(portrait).toBeVisible();
  const image = (await portrait.boundingBox())!;
  const outer = (await frame.boundingBox())!;
  expect(image.width).toBeGreaterThanOrEqual(minimum);
  expect(Math.abs(image.width - image.height)).toBeLessThan(1);
  expect(Math.abs(image.x + image.width / 2 - outer.x - outer.width / 2)).toBeLessThan(1);
  expect(Math.abs(image.y + image.height / 2 - outer.y - outer.height / 2)).toBeLessThan(1);
  await expect(portrait).toHaveCSS('object-fit', 'cover');
}

for (const orientation of ['landscape', 'portrait', 'missing']) {
  test(`${orientation} profile photo stays large, round and centered without the camera covering it`, async ({ page }, testInfo) => {
    await mockAuthenticatedApi(page);
    const photoPath = orientation === 'missing' ? null : '/uploads/profiles/portrait-test.svg';
    await page.route('**/api/session', route => route.fulfill({ json: { ...adminUser, photo_url: photoPath } }));
    await page.route('**/api/user/profile', route => route.fulfill({ json: {
      ...adminUser, photo_path: photoPath,
    } }));
    await page.route('**/uploads/profiles/portrait-test.svg', route => route.fulfill({
      contentType: 'image/svg+xml',
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="${orientation === 'landscape' ? 320 : 160}" height="${orientation === 'landscape' ? 160 : 320}" viewBox="0 0 160 160"><rect width="160" height="160" fill="#d9caff"/><circle cx="80" cy="55" r="27" fill="#6d35e8"/><path d="M25 160v-35a55 55 0 0 1 110 0v35" fill="#6d35e8"/></svg>`,
    }));
    await page.goto('/employee/anasayfa');
    await expectCenteredPortrait(page.locator('.home-profile-photo'), page.locator('.home-profile-link'), 80);
    if (orientation === 'landscape') await page.screenshot({ path: testInfo.outputPath('home-portrait.png') });
    await page.getByRole('link', { name: 'Profilimi görüntüle' }).click();
    const portrait = page.locator('.profile-avatar-image');
    await expectCenteredPortrait(portrait, page.locator('.profile-avatar-shell'), 100);
    const image = (await portrait.boundingBox())!;
    const mark = (await page.locator('.profile-avatar-edit-mark').boundingBox())!;
    const touch = (await page.getByRole('button', { name: 'Profil fotoğrafını değiştir' }).boundingBox())!;
    expect(touch.width).toBeGreaterThanOrEqual(44);
    expect(touch.height).toBeGreaterThanOrEqual(44);
    expect(mark.width / image.width).toBeLessThan(0.3);
    const overlapWidth = Math.max(0, Math.min(image.x + image.width, mark.x + mark.width) - Math.max(image.x, mark.x));
    const overlapHeight = Math.max(0, Math.min(image.y + image.height, mark.y + mark.height) - Math.max(image.y, mark.y));
    expect(overlapWidth * overlapHeight / (image.width * image.height)).toBeLessThan(0.08);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (orientation === 'landscape') await page.screenshot({ path: testInfo.outputPath('profile-portrait.png') });
    if (page.viewportSize()!.width <= 768) {
      await page.setViewportSize({ width: 320, height: 740 });
      await expectCenteredPortrait(portrait, page.locator('.profile-avatar-shell'), 100);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  });
}
