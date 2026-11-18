const crypto = require('node:crypto');
const MODULES = {
    home: 'Ana Sayfa',
    users: 'Kullanıcılar', profile: 'Profil', training: 'Eğitim', announcements: 'Duyurular',
    news: 'Haberler', documents: 'Belgeler', feedback: 'Öneri ve Şikâyet', careers: 'Kariyer',
    knowledge: 'Bilgi Portalı', surveys: 'Anketler', meals: 'Yemek Menüsü', service: 'Servis',
    polyvalence: 'Polivalans', settings: 'Sistem Ayarları', notifications: 'Bildirimler',
    integrations: 'Entegrasyonlar', leave: 'İzinler', directory: 'Rehber', session: 'Oturum', audit: 'Log Kayıtları'
};
const ACTIONS = {
    view: 'Veri okuma', create: 'Ekleme', update: 'Düzenleme', delete: 'Silme',
    export: 'Dışa aktarma', download: 'İndirme', approve: 'Onay', reject: 'Ret',
    assign: 'Atama', complete: 'Tamamlama', reopen: 'Yeniden açma', hold: 'Korumaya alma', release: 'Korumayı kaldırma',
    quiz: 'Sınav gönderimi', cancel: 'İptal', publish: 'Yayınlama', archive: 'Arşivleme', decision: 'Karar',
    analyze: 'PDF analizi',
    login_success: 'Giriş', login_failed: 'Başarısız giriş', logout: 'Çıkış', logout_all: 'Tüm oturumlardan çıkış', session_expired: 'Oturum süresi doldu'
};
const stamp = value => new Date(value).toISOString().replace('T', ' ').replace('Z', '');
const cutoff = (days, now = Date.now()) => stamp(Number(new Date(now)) - days * 86_400_000);
const auxiliaryReads = new Set([
    '/api/admin/announcements/departments',
    '/api/directory/birthdays/today',
    '/api/leave-requests/balance',
    '/api/meal-menu/today'
]);
const isPrivateActivity = url => {
    const path = String(url || '').split('?')[0];
    return /^\/api\/(?:mood-check|feedback|chatbot|reminders)(?:\/|$)/.test(path)
        && !/^\/api\/mood-check\/admin(?:\/|$)/.test(path);
};
const classify = (req) => {
    const path = String(req.originalUrl || '').split('?')[0];
    const method = req.method;
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method) || isPrivateActivity(path)) return null;
    if (path === '/api/admin/audit-logs/policy') return null;
    if (/\/watch(?:\/|$)/.test(path)) return null;
    if (method === 'GET' && (auxiliaryReads.has(path) || /^\/api\/meal-menu\/\d{4}-\d{2}-\d{2}\/rating$/.test(path))) return null;
    if (method === 'GET' && /[/-](?:summary|options|filters|unread-count|status)(?:\/|$)/.test(path)) return null;
    if (/^\/api\/(?:session|login|logout|refresh|certificates|weather|push|integrations\/v1)(?:\/|$)/.test(path)) return null;
    const mappings = [
        [/^\/api\/(?:announcements|news)\/home-preview\/?$/i, 'home'],
        [/^\/uploads\/documents\//, 'documents'],
        [/^\/uploads\/videos\/[^/]+\.pdf$/i, 'training'],
        [/^\/api\/admin\/audit-logs(?:\/|$)/, 'audit'],
        [/^\/api\/admin\/users?(?:\/|$|-)/, 'users'],
        [/^\/api\/(?:user\/profile|personal-info)(?:\/|$)/, 'profile'],
        [/^\/api\/(?:admin\/)?(?:all-videos|videos?|lessons?|assignments?|assign|stats)(?:\/|$)/, 'training'],
        [/^\/api\/(?:admin\/)?announcements(?:\/|$)/, 'announcements'],
        [/^\/api\/(?:admin\/)?news(?:\/|$)/, 'news'],
        [/^\/api\/(?:admin\/)?(?:documents|document-requests|document-request-types)(?:\/|$)/, 'documents'],
        [/^\/api\/admin\/feedback(?:\/|$)/, 'feedback'],
        [/^\/api\/(?:admin\/)?careers(?:\/|$)/, 'careers'],
        [/^\/api\/(?:admin\/)?knowledge(?:\/|$)/, 'knowledge'],
        [/^\/api\/(?:admin\/)?surveys(?:\/|$)/, 'surveys'],
        [/^\/api\/(?:admin\/)?meal-menu(?:\/|$)/, 'meals'],
        [/^\/api\/(?:admin\/)?service-routes(?:\/|$)/, 'service'],
        [/^\/api\/polyvalence(?:\/|$)/, 'polyvalence'],
        [/^\/api\/(?:admin\/)?(?:ai-settings|settings|mood-check\/admin)(?:\/|$)/, 'settings'],
        [/^\/api\/(?:admin\/)?notifications(?:\/|$)/, 'notifications'],
        [/^\/api\/admin\/integrations(?:\/|$)/, 'integrations'],
        [/^\/api\/leave-requests(?:\/|$)/, 'leave'],
        [/^\/api\/directory(?:\/|$)/, 'directory']
    ];
    const module = mappings.find(([pattern]) => pattern.test(path))?.[1];
    if (!module) return null;
    let action = ({ GET: 'view', POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' })[method];
    if (method === 'POST' && path === '/api/admin/meal-menu/parse-pdf') action = 'analyze';
    if (/\/export(?:[./]|$)|\.csv$/.test(path)) action = 'export';
    if (/\.pdf$|\/download(?:\/|$)/.test(path)) action = 'download';
    if (method === 'GET' && module === 'feedback' && /\/comments\/\d+\/attachment\/?$/.test(path)) action = 'download';
    if (path.startsWith('/uploads/')) action = 'download';
    if (method !== 'GET') {
        for (const [pattern, name] of [[/\/release$/, 'release'], [/\/hold$/, 'hold'], [/\/(?:approve|confirm)$/, 'approve'], [/\/reject$/, 'reject'], [/\/(?:assign|assignments)$/, 'assign'], [/\/complete$/, 'complete'], [/\/reopen$/, 'reopen'], [/\/quiz$/, 'quiz'], [/\/cancel$/, 'cancel'], [/\/publish$/, 'publish'], [/\/archive$/, 'archive'], [/\/decision$/, 'decision']]) {
            if (pattern.test(path)) action = name;
        }
        if (action === 'decision' && req.body?.decision === 'approved') action = 'approve';
        if (action === 'decision' && req.body?.decision === 'rejected') action = 'reject';
    }
    const ids = path.match(/(?:^|\/)(\d+)(?=\/|$)/g) || [];
    const auditTarget = path.match(/\/audit-logs\/(activity|security)\/([a-f0-9-]+)(?:\/|$)/);
    const resource = path.startsWith('/uploads/') ? 'dosya:' + crypto.createHash('sha256').update(path).digest('hex').slice(0, 24)
        : auditTarget ? auditTarget[1] + ':' + auditTarget[2] : ids.length ? ids.map(id => id.replace('/', '')).join('/') : null;
    return { module, action, resource_id: resource,
        method, critical: ['users', 'settings', 'integrations', 'audit'].includes(module) || ['delete', 'export', 'download', 'hold', 'release'].includes(action) };
};
const safeDetails = body => {
    if (!body || typeof body !== 'object') return {};
    // Field names only: no request payloads, free text, tokens, documents or anonymous responses.
    const fields = ['title', 'description', 'category', 'name', 'department', 'position', 'phone', 'address', 'birth_date', 'email',
        'permissions', 'role', 'status', 'decision', 'level', 'can_train', 'target_level', 'awards_badge', 'certificate_enabled', 'is_active', 'is_archived'];
    const changed_fields = fields.filter(key => Object.hasOwn(body, key));
    const values = {};
    for (const key of ['level', 'target_level']) if (Number.isInteger(body[key]) && body[key] >= 0 && body[key] <= 3) values[key] = body[key];
    if (typeof body.can_train === 'boolean') values.can_train = body.can_train;
    return { changed_fields, ...values };
};
module.exports = { MODULES, ACTIONS, stamp, cutoff, classify, safeDetails, isPrivateActivity };
