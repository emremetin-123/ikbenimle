import { expect, test } from '@playwright/test';
import { mockPolyvalenceApi } from './polyvalence-fixtures';

test('report chart distinguishes attainment from completion and handles no targets', async ({ page }, testInfo) => {
  await mockPolyvalenceApi(page);
  let empty = false;
  await page.route('**/api/polyvalence/admin/report-dashboard?*', route => route.fulfill({ json: {
    positions: [{ key: 'Montaj çalışanı', name: 'Montaj çalışanı' }],
    summary: { polyvalence_rate: empty ? 0 : 75, average_skill_per_employee: 3, critical_risk_count: 1, completion_percent: 50, completed_employees: 1, total_employees: 2 },
    operation_risks: [{ skill_name: 'Kaynak kontrolü', department_name: 'Montaj', qualified_count: 1, min_qualified_count: 2 }],
    heatmap: { departments: empty ? [] : [{ id: 'Montaj çalışanı', name: 'Montaj çalışanı' }], categories: empty ? [] : ['Teknik'], cells: empty ? [] : [{ department_id: 'Montaj çalışanı', category: 'Teknik', score: 75 }] },
    department_comparison: empty ? [] : [{ department_id: 'Montaj çalışanı', name: 'Montaj çalışanı', score: 75 }],
    top_employees: empty ? [] : [{ employee_id: 'test', name: 'Test Çalışan', position: 'Montaj çalışanı', department_name: 'Montaj', completed: 3, target_total: 4, score: 75 }], development_skills: [],
  } }));
  await page.goto('/employee/moduller/polivalans?view=reports');
  await page.getByRole('button', { name: 'Montaj 2026 Sonbahar Değerlendirmesi raporunu aç' }).click();
  await expect(page.getByRole('img', { name: 'Hedefi karşılayan %75, hedefin altında veya değerlendirilmemiş %25' })).toBeVisible();
  await expect(page.getByLabel('Çalışan değerlendirme ilerlemesi')).toHaveAttribute('value', '50');
  await expect(page.getByLabel('Test Çalışan hedef karşılama')).toHaveAttribute('value', '3');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('report-preview.png'), fullPage: true });
  empty = true;
  await page.getByRole('combobox', { name: /^Pozisyon/ }).selectOption('Montaj çalışanı');
  await expect(page.getByRole('img', { name: /Hedefi karşılayan/ })).toHaveCount(0);
  await expect(page.getByText('Hedefli değerlendirme bulunmuyor.').first()).toBeVisible();
});
