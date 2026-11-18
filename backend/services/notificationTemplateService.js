const { getSettings, setSetting } = require('./appSettingsService');

const EVENT_TEMPLATES = [
    {
        key: 'history_today',
        group: 'Günlük İçerikler',
        label: 'Tarihte Bugün',
        description: 'Türkçe Vikipedi’den bugünün tarihinde yaşanan bir olay, her gün seçilen saatte bildirim abonelerine gönderilir. Saat Türkiye saatidir.',
        defaultEnabled: false,
        defaultTime: '10:00',
        defaultTitle: 'Tarihte bugün · {date}',
        defaultBody: '{event} — Kaynak: Türkçe Vikipedi (CC BY-SA)',
        defaultUrl: 'https://tr.wikipedia.org/',
        variables: ['{date}', '{event}', '{sourceUrl}']
    },
    {
        key: 'quote_daily',
        group: 'Günlük İçerikler',
        label: 'Günün Sözü',
        description: '365 Türkçe sözden oluşan havuzdan her gün bir söz, seçilen saatte bildirim abonelerine gönderilir. Havuz bitmeden tekrar etmez. Saat Türkiye saatidir.',
        defaultEnabled: false,
        defaultTime: '09:00',
        defaultTitle: 'Günün sözü',
        defaultBody: '“{quote}” — {author}',
        defaultUrl: '/employee/anasayfa',
        variables: ['{quote}', '{author}', '{date}', '{sourceUrl}']
    },
    {
        key: 'birthday_today',
        group: 'Genel',
        label: 'Bugün Doğanlar',
        description: 'Doğum günü bugün olan aktif çalışanlar varsa tüm bildirim abonelerine gönderilir.',
        defaultEnabled: true,
        defaultTime: '09:30',
        defaultTitle: 'Bugün doğum günü olanlar var',
        defaultBody: 'Bugün {names} doğum gününü kutluyor. Nice mutlu yıllar!',
        defaultUrl: '/employee/anasayfa',
        variables: ['{names}', '{count}']
    },
    {
        key: 'announcement_created',
        group: 'Duyurular ve Haberler',
        label: 'Yeni Duyuru Yayınlandı',
        description: 'Yeni duyuru yayınlandığında hedef kitleye gönderilir.',
        defaultEnabled: true,
        defaultTitle: 'Yeni duyuru yayınlandı',
        defaultBody: '{title}',
        defaultUrl: '/employee/duyurular',
        variables: ['{title}', '{department}']
    },
    {
        key: 'training_assigned',
        group: 'Eğitim',
        label: 'Eğitim Atandı',
        description: 'Çalışana yeni eğitim atandığında gönderilir.',
        defaultEnabled: true,
        defaultTitle: 'Yeni eğitim atandı',
        defaultBody: '{trainingTitle} eğitimi size atandı.',
        defaultUrl: '/employee/egitimler',
        variables: ['{trainingTitle}', '{dueDate}']
    },
    {
        key: 'polyvalence_period_opened',
        group: 'Polivalans',
        label: 'Polivalans Değerlendirmesi Açıldı',
        description: 'Amire yeni polivalans değerlendirme görevi açıldığında gönderilir.',
        defaultEnabled: true,
        defaultTitle: 'Polivalans değerlendirmesi açıldı',
        defaultBody: '{department} / {periodName} değerlendirmeleri sizi bekliyor.',
        defaultUrl: '/employee/polivalans',
        variables: ['{department}', '{periodName}']
    },
    {
        key: 'polyvalence_due_reminder',
        group: 'Polivalans',
        label: 'Polivalans Hatırlatma',
        description: 'Açık polivalans görevlerinde son tarihe göre hatırlatma gönderilir.',
        defaultEnabled: true,
        defaultTitle: 'Polivalans değerlendirme hatırlatması',
        defaultBody: '{department} / {periodName} için {dueText}.',
        defaultUrl: '/employee/polivalans',
        variables: ['{department}', '{periodName}', '{daysLeft}', '{dueText}']
    },
    {
        key: 'mood_daily',
        group: 'Rutinler',
        label: 'Günlük Duygu Durumu',
        description: 'Günlük duygu durumu hatırlatıcısının metin ve saat ayarlarını yönetir.',
        defaultEnabled: false,
        defaultTime: '09:00',
        defaultTitle: 'Bugün kendini nasıl hissediyorsun?',
        defaultBody: 'Günlük duygu durumunu paylaşmak ister misin?',
        defaultUrl: '/employee/anasayfa',
        variables: []
    }
];

const settingKey = (templateKey, field) => `notification_template_${templateKey}_${field}`;

const isEnabledValue = (value, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    return !(value === false || value === 0 || value === '0' || value === 'false');
};

const getTemplateDefinitions = () => EVENT_TEMPLATES;

const hydrateTemplate = (definition, settings) => ({
    ...definition,
    enabled: isEnabledValue(
        settings[settingKey(definition.key, 'enabled')],
        definition.defaultEnabled
    ),
    scheduled_time: settings[settingKey(definition.key, 'time')]
        || definition.defaultTime
        || '',
    title: settings[settingKey(definition.key, 'title')] || definition.defaultTitle,
    body: settings[settingKey(definition.key, 'body')] || definition.defaultBody,
    url: settings[settingKey(definition.key, 'url')] || definition.defaultUrl
});

const getTemplates = async (db) => {
    const keys = EVENT_TEMPLATES.flatMap(template => [
        settingKey(template.key, 'enabled'),
        settingKey(template.key, 'time'),
        settingKey(template.key, 'title'),
        settingKey(template.key, 'body'),
        settingKey(template.key, 'url')
    ]);
    const settings = await getSettings(db, keys);
    return EVENT_TEMPLATES.map(template => hydrateTemplate(template, settings));
};

const getTemplate = async (db, templateKey) => {
    const definition = EVENT_TEMPLATES.find(template => template.key === templateKey);
    if (!definition) throw new Error(`Unknown notification template: ${templateKey}`);
    const templates = await getTemplates(db);
    return templates.find(template => template.key === templateKey);
};

const updateTemplate = async (db, templateKey, patch) => {
    const definition = EVENT_TEMPLATES.find(template => template.key === templateKey);
    if (!definition) throw new Error(`Unknown notification template: ${templateKey}`);

    const normalizers = {
        enabled: value => (value ? 'true' : 'false'),
        time: value => String(value || '').slice(0, 5),
        title: value => String(value || '').trim(),
        body: value => String(value || '').trim(),
        url: value => String(value || definition.defaultUrl).trim()
    };
    await Promise.all(
        Object.entries(patch).map(([field, value]) => (
            setSetting(db, settingKey(templateKey, field), normalizers[field](value))
        ))
    );
    return getTemplate(db, templateKey);
};

const renderTemplate = (text, variables = {}) => (
    String(text || '').replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => (
        Object.prototype.hasOwnProperty.call(variables, key)
            ? String(variables[key] ?? '')
            : match
    ))
);

const buildPayload = async (db, templateKey, variables = {}, overrides = {}) => {
    const template = await getTemplate(db, templateKey);
    if (!template.enabled && !overrides.force) return { enabled: false, template };

    return {
        enabled: true,
        template,
        payload: {
            title: renderTemplate(overrides.title || template.title, variables),
            body: renderTemplate(overrides.body || template.body, variables),
            url: overrides.url || template.url,
            tag: overrides.tag || templateKey
        }
    };
};

module.exports = {
    getTemplateDefinitions,
    getTemplate,
    getTemplates,
    updateTemplate,
    buildPayload,
    renderTemplate
};
