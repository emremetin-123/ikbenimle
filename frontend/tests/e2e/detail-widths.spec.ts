import { expect, test } from '@playwright/test';
import { mockAuthenticatedApi } from './fixtures';

for (const width of [1440, 1920]) {
  test(`detail pages use the available desktop width at ${width}px and preserve actions`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'Desktop geometry check');
    await page.setViewportSize({ width, height: 1080 });
    await mockAuthenticatedApi(page);
    let applied = false;
    let submitted = false;
    await page.route('**/api/careers/jobs/12', route => route.fulfill({ json: { id: 12, title: 'Kalite Uzmanı', job_description: 'Üretim kalitesini takip eder.', qualifications: 'Kalite kontrol deneyimi', location: 'Bursa', work_model: 'Yerinde', user_applied: applied } }));
    await page.route('**/api/careers/jobs/12/apply', route => { applied = true; return route.fulfill({ json: { success: true } }); });
    const survey = { id: 12, title: 'Çalışan Görüşleri', description: 'Çalışma koşulları hakkında görüşleriniz', status: 'active', question_count: 1, has_responded: false, questions: [{ id: 121, question_text: 'Görüşünüz nedir?', question_type: 'text', options: [], is_required: true }] };
    await page.route('**/api/surveys?**', route => route.fulfill({ json: { items: [survey], pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 } } }));
    await page.route('**/api/surveys/12', route => route.fulfill({ json: { ...survey, has_responded: submitted } }));
    await page.route('**/api/surveys/12/responses', route => { submitted = true; return route.fulfill({ json: { success: true } }); });
    await page.route('**/api/admin/ai-settings', route => route.fulfill({ json: { gemini_model: 'test-model', chatbot_enabled: false, has_gemini_api_key: false } }));

    for (const [route, selector] of [['kariyer/12', '.career-detail-page'], ['anketler', '.survey-detail-page'], ['moduller/ai-ayarlari', '.ai-settings-card']]) {
      await page.goto('/employee/' + route);
      if (route === 'anketler') await page.getByRole('button', { name: /Çalışan Görüşleri/ }).click();
      const target = page.locator(selector);
      await expect(target).toBeVisible();
      const sidebar = page.locator('.sidebar');
      if (await sidebar.evaluate(element => element.classList.contains('collapsed'))) await sidebar.getByRole('button', { name: 'Menuyu Ac', exact: true }).click();
      let previousWidth = 0;
      for (const collapsed of [false, true]) {
        if (collapsed) await sidebar.getByRole('button', { name: 'Menuyu Kapat', exact: true }).click();
        await expect.poll(async () => Math.round((await sidebar.boundingBox())!.width)).toBe(collapsed ? 72 : 260);
        await expect.poll(async () => {
          const frame = (await page.locator('.dashboard-content-frame').boundingBox())!;
          const box = (await target.boundingBox())!;
          return Math.max(Math.abs(box.x - frame.x), Math.abs(box.width - frame.width));
        }).toBeLessThan(2);
        const box = (await target.boundingBox())!;
        if (collapsed) expect(box.width).toBeGreaterThan(previousWidth + 150);
        previousWidth = box.width;
        if (route === 'kariyer/12') {
          const footer = (await page.locator('.career-detail-actions').boundingBox())!;
          expect(Math.abs(footer.x - box.x)).toBeLessThan(2);
          expect(Math.abs(footer.width - box.width)).toBeLessThan(2);
          await expect(page.getByRole('button', { name: 'BAŞVUR', exact: true })).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      if (route === 'kariyer/12') { await page.getByRole('button', { name: 'BAŞVUR', exact: true }).click(); await expect(page.getByRole('button', { name: 'BAŞVURULDU', exact: true })).toBeDisabled(); }
      if (route === 'anketler') { await page.locator('.survey-question-card textarea').fill('Çalışma alanı düzenli.'); await page.getByRole('button', { name: 'Yanıtı Gönder', exact: true }).click(); await expect(page.getByText('Tamamlandı', { exact: true })).toBeVisible(); }
      await page.screenshot({ path: testInfo.outputPath(selector.slice(1) + '.png') });
    }
    await page.goto('/employee/egitimler/42');
    await expect(page.locator('video')).toBeVisible();
    const trainingWidth = await page.locator('.training-player-content').evaluate(element => ({ right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width }));
    expect(Math.abs(trainingWidth.right - width)).toBeLessThan(2);
    expect(trainingWidth.width).toBeGreaterThan(width - 400);
    await page.locator('video').dispatchEvent('ended');
    await expect(page.getByRole('heading', { name: 'Modül Sınavı' })).toBeVisible();
    const assessment = await page.locator('.training-assessment-card').boundingBox();
    const content = await page.locator('.training-player-content').evaluate(element => ({ box: element.getBoundingClientRect().width, padding: parseFloat(getComputedStyle(element).paddingLeft) + parseFloat(getComputedStyle(element).paddingRight) }));
    expect(Math.abs(assessment!.width - content.box + content.padding)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('training-assessment.png') });
  });
}
