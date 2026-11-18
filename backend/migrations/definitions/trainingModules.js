module.exports = [{
    version: '020_training_modules',
    async up(db, dialect) {
        await db.exec(`
            CREATE TABLE training_modules (
                id ${dialect === 'postgres' ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${dialect === 'postgres' ? '' : 'AUTOINCREMENT'},
                video_id INTEGER NOT NULL REFERENCES videos(id),
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                order_index INTEGER NOT NULL DEFAULT 0
            );
            ALTER TABLE lessons ADD COLUMN module_id INTEGER REFERENCES training_modules(id);
            CREATE INDEX idx_training_modules_video ON training_modules(video_id, order_index);
            CREATE INDEX idx_lessons_module ON lessons(module_id, order_index);
        `);
        const lessons = await db.all('SELECT id, video_id, title, description, order_index FROM lessons ORDER BY video_id, order_index, id');
        for (const lesson of lessons) {
            const result = await db.run(
                'INSERT INTO training_modules (video_id, title, description, order_index) VALUES (?, ?, ?, ?)',
                [lesson.video_id, lesson.title || 'Modül', lesson.description || '', lesson.order_index || 0]
            );
            await db.run('UPDATE lessons SET module_id = ? WHERE id = ?', [result.lastID, lesson.id]);
        }
    },
    async down(db) {
        const multi = await db.get('SELECT module_id FROM lessons WHERE module_id IS NOT NULL GROUP BY module_id HAVING COUNT(*) > 1 LIMIT 1');
        if (multi) throw new Error('MULTI_CONTENT_MODULE_ROLLBACK_UNSAFE');
        await db.exec(`
            DROP INDEX IF EXISTS idx_lessons_module;
            DROP INDEX IF EXISTS idx_training_modules_video;
            ALTER TABLE lessons DROP COLUMN module_id;
            DROP TABLE training_modules;
        `);
    }
}];
