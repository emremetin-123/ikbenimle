import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mockPolyvalenceApi } from './polyvalence-fixtures';

test('thirty employees and thirty skills stay compact, searchable and saved across accordion changes', async ({ page }, testInfo) => {
  await mockPolyvalenceApi(page, true);
  const levels = ['Bilgisi yok', 'Gelişim gerekli', 'Bağımsız uygulayabilir', 'Uzman'].map((label, level_value) => ({ label, level_value }));
  const members = Array.from({ length: 30 }, (_, memberIndex) => ({
    id: memberIndex + 1, user_id: 100 + memberIndex, name: 'Çalışan ' + String(memberIndex + 1).padStart(2, '0'), employee_id: String(2000 + memberIndex), position: 'Montaj çalışanı',
    assessments: Array.from({ length: 30 }, (_, skillIndex) => ({ id: memberIndex * 100 + skillIndex + 1, skill_id: skillIndex + 1, skill_name: 'Üretim becerisi ' + String(skillIndex + 1).padStart(2, '0'), category: skillIndex < 15 ? 'Teknik' : 'Kalite', target_level: 2, level: null as number | null, can_train: false, note: '', version_no: 0 })),
  }));
  let conflict = false;
  await page.route('**/api/polyvalence/tasks/1', route => route.fulfill({ json: {
    id: 1, department_name: 'Montaj', period_name: '2026 Sonbahar Değerlendirmesi', due_date: '2026-10-31', status: 'in_progress', period_status: 'open', levels, members,
    progress: { total: 900, completed: 0, percent: 0 },
  } }));
  await page.route('**/api/polyvalence/tasks/1/assessments/*', route => {
    if (conflict) return route.fulfill({ status: 409, json: { message: 'Kayıt başka bir kullanıcı tarafından güncellendi.' } });
    const row = members.flatMap(member => member.assessments).find(item => item.id === Number(route.request().url().split('/').pop()))!;
    const body = route.request().postDataJSON();
    expect(body.version_no).toBe(row.version_no);
    Object.assign(row, body, { version_no: row.version_no + 1 });
    return route.fulfill({ json: { level_value: row.level, can_train: row.can_train, note: row.note, version_no: row.version_no } });
  });
  await page.goto('/employee/polivalans');
  await page.getByRole('button', { name: /2026 Sonbahar Değerlendirmesi/ }).click();
  const employees = page.locator('.poly-accordion-member-heading > button');
  await expect(employees).toHaveCount(30);
  await expect(page.locator('.poly-compact-assessment')).toHaveCount(0);
  const first = page.getByRole('button', { name: /^Çalışan 01 / });
  await first.click();
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.poly-compact-assessment')).toHaveCount(30);
  const region = page.getByRole('region', { name: 'Çalışan 01 becerileri', exact: true });
  const geometry = await region.evaluate(element => ({ height: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(geometry.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.6 + 1);
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.height * 2);
  const row = page.locator('.poly-compact-assessment').first();
  expect((await row.boundingBox())!.height).toBeLessThan(page.viewportSize()!.width > 760 ? 90 : 140);
  const group = page.getByRole('group', { name: 'Üretim becerisi 01 yetkinlik seviyesi' });
  await group.getByRole('button', { name: '3 Uzman', exact: true }).click();
  await expect(group.getByRole('button', { name: '3 Uzman', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await row.getByLabel('Eğitim verebilir').click();
  const dialog = page.getByRole('dialog', { name: 'Yetkinlik değerlendirmesi' });
  await expect(dialog.getByRole('alert')).toContainText('açıklama zorunludur');
  await dialog.getByLabel('Değerlendirme açıklaması').fill('Eğitim verebilecek düzeyde gözlendi.');
  await dialog.getByRole('button', { name: 'Değerlendirmeyi kaydet' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row.getByLabel('Eğitim verebilir')).toBeChecked();
  await row.getByText('Değerlendirme yorumu', { exact: true }).click();
  await expect(row.getByText('Eğitim verebilecek düzeyde gözlendi.')).toBeVisible();
  await first.click();
  await expect(first).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: /^Çalışan 02 / }).click();
  await expect(page.locator('.poly-accordion-member-heading > button[aria-expanded=true]')).toHaveCount(1);
  await first.click();
  await expect(group.getByRole('button', { name: '3 Uzman', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: testInfo.outputPath('compact-evaluation.png') });
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(accessibility.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
  conflict = true;
  await group.getByRole('button', { name: '2 Bağımsız uygulayabilir', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('başka bir kullanıcı');
  await expect(group.getByRole('button', { name: '3 Uzman', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Atanan çalışan ara').fill('Çalışan 30');
  await expect(employees).toHaveCount(1);
  await page.getByRole('button', { name: /^Çalışan 30 / }).click();
  await page.getByRole('button', { name: /^Bekleyen/ }).click();
  await expect(employees).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Önceki çalışan', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Sonraki çalışan', exact: true })).toHaveCount(0);
  const last = page.getByRole('button', { name: /^Çalışan 30 / });
  await last.focus();
  await last.press('Enter');
  await expect(last).toHaveAttribute('aria-expanded', 'false');
  await last.press('Space');
  await expect(last).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
