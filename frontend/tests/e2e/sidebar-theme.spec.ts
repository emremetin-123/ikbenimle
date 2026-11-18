import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

test('sidebar highlights stay violet when navigating between modules', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.goto('/employee/anasayfa');

  const mobileMenu = page.getByRole('button', { name: 'Menüyü aç', exact: true });
  const mobile = page.viewportSize()!.width <= 768;
  if (mobile) await mobileMenu.click();

  const nav = page.locator('.employee-sidebar-nav');
  const violet = 'rgb(109, 53, 232)';
  const hoverViolet = 'color(srgb 0.427451 0.207843 0.909804 / 0.38)';
  const home = nav.getByRole('link', { name: 'Ana Sayfa', exact: true });
  await expect(home).toHaveCSS('background-color', violet);
  const services = nav.getByRole('button', { name: 'Servisler', exact: true });
  if (!mobile) {
    await services.hover();
    await expect(services).toHaveCSS('background-color', hoverViolet);
  }
  await services.click();

  const route = nav.getByRole('link', { name: 'Servis Güzergahlarım', exact: true });
  if (!mobile) {
    await route.hover();
    await expect(route).toHaveCSS('background-color', hoverViolet);
  }
  await route.click();
  await expect(page).toHaveURL(/\/employee\/servis-guzergahlari$/);
  if (mobile) await mobileMenu.click();
  await expect(route).toHaveCSS('background-color', violet);
  if (!mobile) {
    await home.hover();
    await expect(home).toHaveCSS('background-color', hoverViolet);
  }

  await services.focus();
  await page.keyboard.press('Tab');
  await expect(route).toBeFocused();
  await expect(route).toHaveCSS('outline-color', 'rgb(196, 181, 253)');
});
