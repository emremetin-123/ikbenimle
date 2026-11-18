import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

test('directory uses small photos for cards and larger photos in the profile', async ({ page }) => {
  await mockAuthenticatedApi(page);
  const user = { id: 42, name: 'Rehber Test Kullanıcısı', department: 'Kalite', photo_path: '/uploads/avatars/test.png', badges: [] };
  await page.route('**/api/directory**', route => route.fulfill({
    json: new URL(route.request().url()).pathname === '/api/directory/42'
      ? user : { items: [user], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 } },
  }));
  await page.route('**/uploads/avatars/test.png*', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="blue"/></svg>',
  }));
  await page.goto('/employee/rehber');
  const card = page.locator('.directory-card');
  await expect(card.getByRole('img', { name: user.name })).toHaveAttribute('src', /avatarSize=160$/);
  await expect(card.getByRole('img', { name: user.name })).toHaveAttribute('loading', 'eager');
  await card.click();
  const photo = page.getByRole('dialog').getByRole('img', { name: user.name });
  await expect(photo).toHaveAttribute('src', /avatarSize=320$/);
  await expect(photo).toBeVisible();
});
