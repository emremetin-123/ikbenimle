module.exports = [
    {
        version: '012_meal_rating_query_indexes',
        async up(db) {
            await db.exec(`
                CREATE INDEX IF NOT EXISTS idx_meal_ratings_date_created
                    ON meal_menu_ratings(meal_date, created_at DESC, id DESC);
            `);
        },
        async down(db) {
            await db.exec('DROP INDEX IF EXISTS idx_meal_ratings_date_created;');
        }
    }
];
