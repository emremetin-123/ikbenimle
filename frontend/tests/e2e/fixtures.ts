import { expect, type Page, type Route } from '@playwright/test';

export async function expectModuleTitle(page: Page, title: string, mobileTitle = title) {
  const heading = page.getByRole('heading', { name: title, exact: true, level: 1 });
  await expect(heading).toBeAttached();
  if (page.viewportSize()!.width <= 768) await expect(page.locator('.mobile-page-title')).toHaveText(mobileTitle);
  else await expect(heading).toBeVisible();
}

export const adminUser = {
  id: 1,
  employee_id: '1001',
  name: 'Test Yönetici',
  department: 'Pres',
  position: 'Bölüm Amiri',
  role: 'admin',
  permissions: [],
  photo_url: null,
  session_policy: {
    idle_timeout_ms: 1_800_000,
    absolute_timeout_ms: 28_800_000,
    warning_duration_ms: 120_000,
  },
};

const paginated = (items: unknown[] = []) => ({
  items,
  pagination: { page: 1, pageSize: 20, total: items.length, totalPages: items.length ? 1 : 0 },
});

const json = (route: Route, body: unknown, status = 200) => route.fulfill({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
});

export async function mockAuthenticatedApi(page: Page) {
  let training43Completed = false;
  let training44Completed = false;
  let profile = {
    ...adminUser,
    photo_path: null,
    leave_balance: 12,
    email: 'test@example.com',
    phone: '05551234567',
    education_entries: [],
    skill_tags: [],
    hobby_tags: [],
  };
  await page.addInitScript(() => {
    Reflect.deleteProperty(Object.getPrototypeOf(navigator), 'serviceWorker');
  });

  await page.route('**/uploads/**', (route) => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225"><rect width="400" height="225" fill="#dbeafe"/></svg>',
  }));

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === '/api/session' || path === '/api/login') return json(route, adminUser);
    if (path === '/api/logout') return json(route, { success: true });
    if (path === '/api/user/profile' && route.request().method() === 'PUT') {
      profile = { ...profile, ...route.request().postDataJSON() };
      return json(route, { success: true, profile });
    }
    if (path === '/api/user/profile') return json(route, profile);
    if (path === '/api/polyvalence/my-tasks/summary') return json(route, { has_tasks: false });
    if (path === '/api/polyvalence/my-tasks') return json(route, []);
    if (path === '/api/videos/summary') return json(route, { pending: 2, completed: 4, total: 6, expired: 0, badges: 0 });
    if (path === '/api/videos') {
      if (url.searchParams.get('status') === 'completed') return json(route, paginated());
      return json(route, paginated([{
        id: 42,
        assignment_id: 4200,
        title: 'Güvenli Video Eğitimi',
        description: 'Dosyadan yüklenen kapak görseli',
        category: 'İSG',
        cover_image_url: '/uploads/videos/training-cover.jpg',
      }]));
    }
    if (path === '/api/video/42') return json(route, {
      video: {
        id: 42,
        title: 'Güvenli Video Eğitimi',
        disable_forward_seek: 1,
        pause_on_blur: 0,
        certificate_enabled: 0,
        pass_score: 70,
      },
      lessons: [{
        id: 420,
        title: 'Zorunlu Video',
        description: 'İleri sarma kapalı eğitim içeriği',
        url: 'data:video/mp4;base64,',
        content_type: 'video',
        status: 'assigned',
        last_position: 0,
        max_position: 0,
        quiz: { questions: [{ text: 'İçeriği tamamladınız mı?', options: ['Evet', 'Hayır'] }] },
      }],
      assignment: { id: 4200, status: 'assigned' },
    });
    if (path === '/api/video/43') return json(route, {
      video: {
        id: 43,
        title: 'Sınavsız Video Eğitimi',
        disable_forward_seek: 1,
        pause_on_blur: 0,
        certificate_enabled: 1,
        pass_score: 70,
      },
      lessons: [{
        id: 430,
        title: 'Sınavsız Video',
        description: 'Tamamlandıktan sonra çalışan onayı gerektirir.',
        url: 'data:video/mp4;base64,',
        content_type: 'video',
        status: training43Completed ? 'completed' : 'assigned',
        last_position: training43Completed ? 306 : 0,
        max_position: training43Completed ? 306 : 0,
        content_progress_percent: training43Completed ? 100 : 0,
        quiz: null,
      }],
      assignment: { id: 4300, status: 'assigned' },
    });
    if (path === '/api/video/44') return json(route, {
      video: {
        id: 44,
        title: 'Sertifikasız Eğitim',
        disable_forward_seek: 1,
        pause_on_blur: 0,
        certificate_enabled: 0,
        pass_score: 70,
      },
      lessons: [{
        id: 440,
        title: 'Son Video',
        description: 'Sınav veya sertifika gerektirmeyen içerik.',
        url: 'data:video/mp4;base64,',
        content_type: 'video',
        status: training44Completed ? 'completed' : 'assigned',
        last_position: training44Completed ? 30 : 0,
        max_position: training44Completed ? 30 : 0,
        quiz: null,
      }],
      assignment: { id: 4400, status: training44Completed ? 'completed' : 'assigned' },
    });
    if (path === '/api/video/45') return json(route, {
      video: {
        id: 45,
        title: 'Eski Quiz Kayıtlı Eğitim',
        disable_forward_seek: 1,
        pause_on_blur: 0,
        certificate_enabled: 1,
        pass_score: 70,
      },
      lessons: [{
        id: 450,
        title: 'Tamamlanan Video',
        description: 'Kullanılabilir sorusu olmayan eski quiz kaydı.',
        url: 'data:video/mp4;base64,',
        content_type: 'video',
        status: 'watched',
        last_position: 306,
        max_position: 306,
        content_progress_percent: 100,
        quiz: null,
      }],
      assignment: { id: 4500, status: 'assigned' },
    });
    if (path === '/api/lesson/420/watch/start') return json(route, { progress_token: 'progress-token' });
    if (path === '/api/lesson/420/watch') return json(route, { status: 'watched' });
    if (path === '/api/lesson/430/watch/start') return json(route, { progress_token: 'progress-token' });
    if (path === '/api/lesson/430/watch') {
      training43Completed = true;
      return json(route, { status: 'completed', watch_percent: 100 });
    }
    if (path === '/api/lesson/440/watch/start') return json(route, { progress_token: 'progress-token' });
    if (path === '/api/lesson/440/watch') {
      training44Completed = true;
      return json(route, { status: 'completed', watch_percent: 100 });
    }
    if (path === '/api/lesson/450/watch/start') return json(route, { progress_token: 'progress-token' });
    if (path === '/api/lesson/450/watch') return json(route, { status: 'completed', watch_percent: 100 });
    if (path === '/api/assignment/4300/confirm') return json(route, { success: true, reference_id: 'CERT-20261007-0123456789ABCDEF0123456789ABCDEF' });
    if (path === '/api/leave-requests/balance') return json(route, { available: true, balance_days: 12 });
    if (path === '/api/weather/today') return json(route, { city: 'Bursa', temperature: 24, max_temperature: 27, min_temperature: 16, weather_code: 1 });
    if (path === '/api/meal-menu/today') return json(route, { meal_date: '2026-09-05', items: ['Mercimek çorbası', 'Pilav', 'Ayran'] });
    if (/^\/api\/meal-menu\/[^/]+\/rating$/.test(path)) return json(route, null);
    if (['/api/news', '/api/news/home-preview', '/api/announcements', '/api/announcements/home-preview'].includes(path) || path.startsWith('/api/directory/')) return json(route, paginated());
    if (path === '/api/reminders') return json(route, { items: [] });
    if (path === '/api/mood-check/today') return json(route, { submitted: false, callback_requested: false });
    if (path === '/api/push/vapid-public-key') return json(route, { publicKey: null });
    if (path === '/api/admin/users/options' || path === '/api/admin/all-videos/options') return json(route, paginated());
    if (path === '/api/admin/all-videos') return json(route, paginated());
    if (path === '/api/admin/stats/options') return json(route, { departments: [] });
    if (path === '/api/admin/stats') return json(route, {
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      summary: { total: 0, completed: 0, expired: 0, pending: 0, in_progress: 0 },
    });

    return json(route, paginated());
  });
}
