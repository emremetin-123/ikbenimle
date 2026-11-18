const CACHE_TTL_MS = 30_000;
const caches = new WeakMap();

const cacheFor = (db) => {
    if (!caches.has(db)) caches.set(db, new Map());
    return caches.get(db);
};

const getSettings = async (db, keys) => {
    const uniqueKeys = [...new Set(keys.map(String))];
    if (!uniqueKeys.length) return {};

    const now = Date.now();
    const cache = cacheFor(db);
    const values = {};
    const missing = [];

    for (const key of uniqueKeys) {
        const cached = cache.get(key);
        if (cached && cached.expiresAt > now) values[key] = cached.value;
        else missing.push(key);
    }

    if (missing.length) {
        const placeholders = missing.map(() => '?').join(', ');
        const rows = await db.all(
            `SELECT setting_key, value FROM app_settings WHERE setting_key IN (${placeholders})`,
            missing
        );
        const loaded = new Map(rows.map(row => [String(row.setting_key), row.value || '']));
        for (const key of missing) {
            const value = loaded.get(key) || '';
            values[key] = value;
            cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
        }
    }

    return Object.fromEntries(uniqueKeys.map(key => [key, values[key] || '']));
};

const getSetting = async (db, key) => {
    const values = await getSettings(db, [key]);
    return values[key] || '';
};

const setSetting = async (db, key, value) => {
    const update = await db.run(
        'UPDATE app_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ?',
        [value, key]
    );

    if (!update.changes) {
        await db.run(
            'INSERT INTO app_settings (setting_key, value) VALUES (?, ?)',
            [key, value]
        );
    }
    cacheFor(db).delete(String(key));
};

module.exports = {
    getSetting,
    getSettings,
    setSetting
};
