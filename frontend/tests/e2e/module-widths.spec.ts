import { expect, test } from '@playwright/test';
import { mockPolyvalenceApi } from './polyvalence-fixtures';

for (const width of [1440, 1920]) {
  test(`module pages fill the desktop content at ${width}px with either sidebar state`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop geometry check');
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 1080 });
    await mockPolyvalenceApi(page);
    await page.route('**/api/document-request-types', route => route.fulfill({ json: [] }));
    await page.route('**/api/admin/document-request-types', route => route.fulfill({ json: [] }));
    await page.route('**/api/admin/announcements/departments', route => route.fulfill({ json: [] }));
    await page.route('**/api/feedback/mine', route => route.fulfill({ json: [] }));
    await page.route('**/api/feedback/participating', route => route.fulfill({ json: [] }));
    const routes = [
      'anasayfa', 'kariyer', 'duyurular', 'egitimler', 'izinler', 'belgelerim',
      'oneri-sikayet', 'rehber', 'bilgi-portali', 'anketler',
      'servis-guzergahlari', 'polivalans', 'kisisel-bilgiler',
      'moduller/polivalans?view=reports', 'moduller/anketler',
      'moduller/bilgi-portali', 'moduller/egitimler', 'moduller/kariyer',
      'moduller/duyurular', 'moduller/haberler', 'moduller/belgeler',
      'moduller/yemek-menusu', 'moduller/geribildirim',
    ];
    for (const route of routes) {
      await page.goto(`/employee/${route}`);
      const header = page.locator('.module-page-header, .profile-hero').first();
      await expect(header, route).toBeVisible();
      const sidebar = page.locator('.sidebar');
      if (await sidebar.evaluate(element => element.classList.contains('collapsed'))) {
        await sidebar.getByRole('button', { name: 'Menuyu Ac', exact: true }).click();
      }
      let expandedWidth = 0;
      for (const collapsed of [false, true]) {
        if (collapsed) await sidebar.getByRole('button', { name: 'Menuyu Kapat', exact: true }).click();
        await expect.poll(async () => {
          const frame = await page.locator('.dashboard-content-frame').boundingBox();
          const heading = await header.boundingBox();
          if (!frame || !heading) return Infinity;
          return Math.max(Math.abs(heading.x - frame.x), Math.abs(heading.x + heading.width - frame.x - frame.width));
        }, { message: `${route}: header must align with both content edges (collapsed=${collapsed})` }).toBeLessThan(2);
        // Wait for the sidebar transition before comparing the available space.
        await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(collapsed ? 72 : 260);
        const headingWidth = (await header.boundingBox())!.width;
        if (collapsed) expect(headingWidth, route).toBeGreaterThan(expandedWidth + 150);
        else expandedWidth = headingWidth;
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true);
      }
      if (route === 'kariyer' || route === 'anasayfa') await page.screenshot({ path: testInfo.outputPath(`${route}-${width}.png`) });
    }
  });
}
