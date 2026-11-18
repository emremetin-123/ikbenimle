import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

test('knowledge dialog stays aligned after visiting home and filters never overlap', async ({ page }, testInfo) => {
  await mockAuthenticatedApi(page);
  const category = { id: 1, name: 'İş Süreçleri', item_count: 4 };
  const subcategories = ['İnsan Kaynakları', 'Çalışan Deneyimi', 'Uzun Alt Başlık ve Sık Sorulan Sorular', 'Üretim Süreçleri'];
  const entries = subcategories.map((name, index) => ({ id: index + 1, category_id: 1,
    sub_category: name, question: `${name} için süreç nasıl işler?`, is_featured: index === 0,
    answer: ('Ayrıntılı süreç açıklaması. ').repeat(20) + 'A'.repeat(100) }));
  await page.route('**/api/knowledge/categories**', route => {
    const url = new URL(route.request().url());
    const isItems = url.pathname.endsWith('/items');
    const filter = url.searchParams.get('subCategory');
    const items = isItems ? entries.filter(item => !filter || item.sub_category === filter) : [category];
    return route.fulfill({ json: { items, category, sub_categories: subcategories,
      pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 } } });
  });
  // Home's lazy stylesheet used to override the portal's generic modal-content class.
  await page.goto('/employee/anasayfa');
  await expect(page.getByRole('heading', { name: /Hoş geldin/ })).toBeVisible();
  const openMenu = page.getByRole('button', { name: 'Menüyü aç', exact: true });
  if (await openMenu.isVisible()) await openMenu.click();
  await page.getByRole('button', { name: 'Bilgi Portalı', exact: true }).click();
  await page.getByRole('link', { name: 'Bilgi Portalı', exact: true }).click();
  const tile = page.locator('.category-card');
  await tile.click();
  const dialog = page.getByRole('dialog', { name: 'İş Süreçleri içerikleri' });
  await expect(dialog.getByRole('button', { name: 'Tümü', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('.knowledge-item')).toHaveCount(4);
  const layout = await dialog.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const body = element.querySelector('.knowledge-dialog-body')!;
    const buttons = Array.from(element.querySelectorAll('.knowledge-filter-button')).map(button => button.getBoundingClientRect());
    return { centered: Math.abs(rect.x + rect.width / 2 - innerWidth / 2) < 2,
      bodyAligned: Math.abs(rect.width - body.getBoundingClientRect().width) < 3,
      overflow: element.scrollWidth > element.clientWidth + 1,
      inside: rect.y >= 0 && rect.bottom <= innerHeight,
      overlap: buttons.some((a, index) => buttons.slice(index + 1).some(b => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1)),
    };
  });
  expect(layout).toEqual({ centered: true, bodyAligned: true, overflow: false, inside: true, overlap: false });
  expect(await page.evaluate(() => {
    const assistant = document.querySelector('.portal-chatbot-button')?.getBoundingClientRect();
    return assistant ? !document.elementFromPoint(assistant.x + assistant.width / 2, assistant.y + assistant.height / 2)?.closest('.portal-chatbot') : true;
  })).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('knowledge-dialog.png') });
  const accessibility = await new AxeBuilder({ page }).include('.knowledge-dialog').withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  await dialog.getByRole('button', { name: subcategories[2], exact: true }).click();
  await expect(dialog.locator('.knowledge-item')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: subcategories[2], exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'KAPAT', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(tile).toBeFocused();
});
