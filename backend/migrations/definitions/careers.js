module.exports = [
    {
        version: '008_career_query_indexes',
        async up(db) {
            await db.exec(`
                CREATE INDEX IF NOT EXISTS idx_job_postings_status_created
                    ON job_postings(status, created_at, id);
                CREATE INDEX IF NOT EXISTS idx_job_applications_job_status_date
                    ON job_applications(job_id, status, applied_at, id);
                CREATE INDEX IF NOT EXISTS idx_job_applications_user_status_date
                    ON job_applications(user_id, status, applied_at, id);
            `);
        },
        async down(db) {
            for (const index of [
                'idx_job_postings_status_created',
                'idx_job_applications_job_status_date',
                'idx_job_applications_user_status_date'
            ]) {
                await db.exec(`DROP INDEX IF EXISTS ${index};`);
            }
        }
    },
];
