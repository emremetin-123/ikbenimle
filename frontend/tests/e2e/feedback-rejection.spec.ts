import { expect, test } from '@playwright/test';
import { adminUser, mockAuthenticatedApi } from './fixtures';

for (const [decisionValue, decisionLabel] of [['rejected', 'Reddedildi'], ['needs_revision', 'Revizyon istendi']]) {
test(`${decisionLabel} is displayed in management, filters and employee detail`, async ({ page }) => {
  await mockAuthenticatedApi(page);
  let record = { id: 41, user_id: 1, type: 'suggestion', title: 'Ret kararı kontrolü', content: 'Örnek öneri',
    status: 'in_review', display_status: 'in_review', decision: '', public_response: '', user_name: 'Test Çalışan', created_at: '2026-10-26', viewer_role: 'owner', can_comment: false };
  const empty = { items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } };
  await page.route('**/api/admin/feedback**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/decision')) {
      const result = route.request().postDataJSON();
      record = { ...record, ...result, display_status: result.decision };
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname.endsWith('/detail')) return route.fulfill({ json: record });
    if (url.pathname.endsWith('/thread')) return route.fulfill({ json: { participants: [], comments: [], history: [] } });
    if (url.pathname.endsWith('/user-options')) return route.fulfill({ json: empty });
    const items = !url.searchParams.get('status') || url.searchParams.get('status') === record.display_status ? [record] : [];
    return route.fulfill({ json: { ...empty, items, pagination: { ...empty.pagination, total: items.length, totalPages: 1 } } });
  });
  await page.route('**/api/feedback/**', route => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({ json: path.endsWith('/detail') ? record : path.endsWith('/thread')
      ? { participants: [], comments: [], history: [] } : [record] });
  });
  await page.goto('/employee/moduller/geribildirim');
  await page.getByRole('button', { name: record.title, exact: true }).click();
  await page.getByRole('button', { name: /Talep detayını aç/ }).click();
  await expect(page.getByRole('combobox', { name: 'Süreç aşaması' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sonuçlandır', exact: true }).click();
  const decision = page.getByRole('dialog');
  await decision.getByRole('combobox', { name: 'Karar', exact: true }).selectOption(decisionValue);
  await decision.getByLabel('Çalışana gönderilecek yanıt').fill('Resmî yanıt');
  const save = page.waitForRequest(request => request.url().endsWith('/41/decision') && request.method() === 'PUT');
  await decision.getByRole('button', { name: 'Yanıtı gönder ve kapat' }).click();
  expect((await save).postDataJSON()).toMatchObject({ decision: decisionValue });
  await expect(decision).toHaveCount(0);
  await expect(page.locator('.module-page-header-actions')).toContainText(decisionLabel);
  await expect(page.getByRole('button', { name: 'Kaydı yeniden aç' })).toBeVisible();
  await page.getByRole('button', { name: 'Kayıtlara dön' }).click();
  const status = page.getByRole('combobox', { name: 'Durum', exact: true });
  await status.selectOption(decisionValue);
  await expect(page.locator('.fb-table tbody')).toContainText(decisionLabel);
  await status.selectOption('completed');
  await expect(page.getByRole('button', { name: record.title, exact: true })).toHaveCount(0);
  await page.goto('/employee/oneri-sikayet');
  await expect(page.locator('.fb-table tbody')).toContainText(decisionLabel);
  await page.getByRole('button', { name: record.title, exact: true }).click();
  await expect(page.locator('.module-page-header-actions')).toContainText(decisionLabel);
});
}

test('the assignee adds a participant and sends a comment with an optional attachment', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route('**/api/session', route => route.fulfill({ json: { ...adminUser, role: 'employee' } }));
  const record = {
    id: 41, user_id: 2, assigned_to_user_id: 1, type: 'suggestion', title: 'İş akışı önerisi',
    content: 'Örnek öneri', status: 'assigned', display_status: 'assigned', created_at: '2026-10-26',
    viewer_role: 'assignee', can_comment: true, can_internal_comment: true, can_add_participants: true,
  };
  const candidate = { id: 3, employee_id: '1003', name: 'Test Katılımcı', department: 'Üretim' };
  const participants = [{ id: 1, user_id: 1, name: adminUser.name }];
  const comments: { id: number; user_name: string; comment: string; is_public: boolean; created_at: string; attachment_name: string }[] = [];
  const filename = 'inceleme-notu.pdf';
  const pdf = '%PDF-1.7\n%%EOF\n';
  await page.route('**/api/feedback/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/mine')) return route.fulfill({ json: [] });
    if (url.pathname.endsWith('/participating')) return route.fulfill({ json: [record] });
    if (url.pathname.endsWith('/detail')) return route.fulfill({ json: record });
    if (url.pathname.endsWith('/thread')) return route.fulfill({ json: { comments, participants, history: [] } });
    if (url.pathname.endsWith('/participant-options')) {
      const items = candidate.name.includes(url.searchParams.get('search') || '') ? [candidate] : [];
      return route.fulfill({ json: { items, pagination: { page: 1, pageSize: 15, total: items.length, totalPages: 1 } } });
    }
    if (url.pathname.endsWith('/participants')) {
      expect(route.request().postDataJSON()).toEqual({ user_ids: [candidate.id] });
      participants.push({ id: 2, user_id: candidate.id, name: candidate.name });
      record.status = 'in_review';
      record.display_status = 'in_review';
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname.endsWith('/comments')) {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data');
      const body = route.request().postDataBuffer()?.toString();
      expect(body).toContain('name="is_public"\r\n\r\nfalse');
      expect(body).toContain(`filename="${filename}"`);
      expect(body).toContain(pdf);
      comments.push({ id: 12, user_name: adminUser.name, comment: 'İnceleme notu', is_public: false, created_at: '2026-10-26', attachment_name: filename });
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ body: pdf, contentType: 'application/pdf', headers: { 'Content-Disposition': `attachment; filename="${filename}"` } });
  });

  await page.goto('/employee/oneri-sikayet');
  await page.getByRole('button', { name: /Dahil Olduklarım/ }).click();
  await page.getByRole('button', { name: record.title, exact: true }).click();
  await expect(page.locator('.module-page-header-actions')).toContainText('Atandı');
  const invite = page.getByRole('button', { name: 'Katılımcı ekle', exact: true });
  await invite.click();
  const dialog = page.getByRole('dialog', { name: 'Katılımcı ekle' });
  await dialog.getByRole('textbox', { name: 'Kişi ara' }).fill('Test Katılımcı');
  await dialog.getByRole('combobox', { name: 'Katılımcı' }).selectOption(String(candidate.id));
  await dialog.getByRole('button', { name: 'Katılımcı ekle', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.module-page-header-actions')).toContainText('İnceleniyor');
  await page.getByText('Süreç ekibi · 2 kişi').click();
  await expect(page.getByText(candidate.name, { exact: true })).toBeVisible();

  await page.getByRole('textbox', { name: 'Görüşünüz' }).fill('İnceleme notu');
  const addFile = page.getByRole('button', { name: 'Dosya ekle', exact: true });
  const chooser = page.waitForEvent('filechooser');
  await addFile.click();
  const file = { name: filename, mimeType: 'application/pdf', buffer: Buffer.from(pdf) };
  await (await chooser).setFiles(file);
  await expect(page.getByText(filename, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ek dosyayı kaldır' }).click();
  await expect(page.getByText(filename, { exact: true })).toHaveCount(0);
  await page.locator('.fb-composer input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Görüşü gönder', exact: true }).click();
  const attachment = page.getByRole('link', { name: filename, exact: true });
  await expect(attachment).toHaveAttribute('href', /\/41\/comments\/12\/attachment$/);
  const download = page.waitForEvent('download');
  await attachment.click();
  expect((await download).suggestedFilename()).toBe(filename);
  await expect(addFile).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});
