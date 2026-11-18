import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';

const require = createRequire(import.meta.url);
const PDFDocument = require('../../../backend/node_modules/pdfkit');
const pdf = () => new Promise<Buffer>(resolve => {
  const document = new PDFDocument();
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  document.on('end', () => resolve(Buffer.concat(chunks)));
  document.text('Example ERP payroll - sample data only'); document.end();
});

test('ERP PDF appears in the actual employee portal and another employee cannot download it', async ({ page, request }, testInfo) => {
  const base = 'http://127.0.0.1:5191';
  const fixture = await (await request.get(base + '/preview/fixture')).json();
  const headers = { Authorization: `Bearer ${fixture.api_key}` };
  const employee = await request.post(base + '/api/integrations/v1/employees/upsert', {
    headers: { ...headers, 'Idempotency-Key': 'payroll-browser-employee-0001' },
    data: { employees: [{ external_employee_id: 'erp-owner', employee_id: 'owner', name: 'Deneme Calisani', department: 'Uretim' }] },
  });
  expect(employee.status()).toBe(200);
  const bytes = await pdf();
  const upload = () => request.post(base + '/api/integrations/v1/payrolls/upsert', {
    headers, multipart: { external_employee_id: 'erp-owner', external_payroll_id: 'erp-payroll-1', period: '2026-11', revision: '1',
      file: { name: 'payroll.pdf', mimeType: 'application/pdf', buffer: bytes } },
  });
  expect((await upload()).status()).toBe(200);
  expect((await upload()).headers()['x-idempotent-replay']).toBe('true');
  await page.goto(base + '/preview/login/owner');
  await expect(page.getByRole('heading', { name: '2026-11 Bordrosu' })).toBeVisible();
  await expect(page.locator('.document-payroll-card')).toHaveCount(1);
  const list = await page.request.get(base + '/api/documents');
  const filePath = (await list.json()).items[0].file_path;
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Dosyayı İndir' }).click();
  const download = await downloading;
  const target = await download.path();
  expect(await fs.readFile(target!)).toEqual(bytes);
  await page.screenshot({ path: testInfo.outputPath('erp-payroll-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('erp-payroll-mobile.png'), fullPage: true });
  await page.goto(base + '/preview/login/other');
  await expect(page.getByText('Sisteme yüklenmiş herhangi bir bordronuz bulunmuyor.')).toBeVisible();
  expect((await page.request.get(base + filePath)).status()).toBe(403);
});
