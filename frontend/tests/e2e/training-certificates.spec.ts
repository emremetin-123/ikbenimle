import { expect, test, type Download } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

function samplePdf() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] >>'];
  let content = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((body, index) => { offsets.push(content.length); content += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = content.length;
  content += `xref\n0 4\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(content);
}

async function readDownload(download: Download) {
  const chunks = [];
  for await (const chunk of (await download.createReadStream())!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test('profile badge and training certificate preview and download the same server PDF', async ({ page }, testInfo) => {
  await mockAuthenticatedApi(page);
  const certificate = { id: 80, assignment_id: 800, title: 'İş Güvenliği Eğitimi', status: 'completed', category: 'Teknik', certificate_enabled: 1, reference_id: 'CERT-800', quiz_score: 90, completed_at: '2026-10-01' };
  await page.route('**/api/videos?**', route => route.fulfill({ json: {
    items: new URL(route.request().url()).searchParams.get('status') === 'completed' ? [certificate] : [],
    pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
  } }));
  let requests = 0;
  let unavailable = true;
  const pdf = samplePdf();
  await page.route('**/api/assignment/800/certificate.pdf', route => {
    requests++;
    return unavailable
      ? route.fulfill({ status: 503, json: { error: 'Sertifika geçici olarak yüklenemedi.' } })
      : route.fulfill({ contentType: 'application/pdf', body: pdf });
  });
  for (const source of ['profile', 'trainings']) {
    await page.goto(source === 'profile' ? '/employee/kisisel-bilgiler' : '/employee/egitimler');
    const opener = source === 'profile' ? page.getByRole('button', { name: certificate.title, exact: true }) : page.getByRole('button', { name: 'Sertifikayı Görüntüle' });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Eğitim Sertifikası' });
    await expect(dialog).toBeVisible();
    if (source === 'profile') {
      await expect(dialog.getByRole('alert')).toHaveText('Sertifika geçici olarak yüklenemedi.');
      unavailable = false;
      await dialog.getByRole('button', { name: 'Tekrar Dene' }).click();
    }
    await expect(dialog.locator('iframe')).toHaveAttribute('src', /^blob:/);
    if (source === 'profile') await page.screenshot({ path: testInfo.outputPath('certificate-preview.png') });
    await expect(dialog.getByRole('link', { name: 'Yeni Sekmede Aç' })).toHaveAttribute('href', await dialog.locator('iframe').getAttribute('src') as string);
    const downloaded = page.waitForEvent('download');
    await dialog.getByRole('link', { name: 'PDF İndir' }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe('Sertifika_CERT-800.pdf');
    expect(await readDownload(download)).toEqual(pdf);
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(bounds.height).toBeLessThanOrEqual(page.viewportSize()!.height);
    await page.getByRole('button', { name: 'Sertifikayı kapat' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  expect(requests).toBeGreaterThanOrEqual(3);
});

test('a badge with certificates disabled never requests or invents a certificate', async ({ page }) => {
  await mockAuthenticatedApi(page);
  await page.route('**/api/videos?**', route => route.fulfill({ json: {
    items: [{ id: 81, assignment_id: 810, title: 'Katılım Rozeti', status: 'completed', certificate_enabled: 0 }],
    pagination: { page: 1, pageSize: 12, total: 1, totalPages: 1 },
  } }));
  let requests = 0;
  await page.route('**/api/assignment/*/certificate.pdf', route => { requests++; return route.abort(); });
  await page.goto('/employee/kisisel-bilgiler');
  await page.getByRole('button', { name: 'Katılım Rozeti', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Bu eğitim için onaylanmış bir sertifika bulunmuyor.');
  await expect(page.getByRole('link', { name: 'PDF İndir' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests).toBe(0);
});
