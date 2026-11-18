module.exports = [
    {
        version: '004_query_indexes',
        async up(db) {
            await db.exec(`
                CREATE INDEX IF NOT EXISTS idx_assignments_user_status
                    ON assignments(user_id, status, assigned_at);
                CREATE INDEX IF NOT EXISTS idx_training_logs_assignment_created
                    ON training_activity_logs(assignment_id, created_at);
                CREATE INDEX IF NOT EXISTS idx_feedback_status_created
                    ON feedback(status, created_at);
                CREATE INDEX IF NOT EXISTS idx_announcements_visible_created
                    ON announcements(visible_until, created_at);
                CREATE INDEX IF NOT EXISTS idx_document_requests_status_created
                    ON document_requests(status, created_at);
                CREATE INDEX IF NOT EXISTS idx_mood_department_date
                    ON mood_checks(department, mood_date);
                CREATE INDEX IF NOT EXISTS idx_polyvalence_period_member_skill
                    ON polyvalence_assessments(period_id, period_member_id, period_skill_id);
            `);
        },
        async down(db) {
            for (const index of [
                'idx_assignments_user_status',
                'idx_training_logs_assignment_created',
                'idx_feedback_status_created',
                'idx_announcements_visible_created',
                'idx_document_requests_status_created',
                'idx_mood_department_date',
                'idx_polyvalence_period_member_skill'
            ]) {
                await db.exec(`DROP INDEX IF EXISTS ${index};`);
            }
        }
    },
    {
        version: '005_architecture_query_indexes',
        async up(db) {
            await db.exec(`
                CREATE INDEX IF NOT EXISTS idx_users_status_department_name
                    ON users(status, department, name);
                CREATE INDEX IF NOT EXISTS idx_poly_period_scope
                    ON polyvalence_periods(status, department_id, start_date, end_date);
                CREATE INDEX IF NOT EXISTS idx_poly_members_period_evaluator
                    ON polyvalence_period_members(period_id, evaluator_user_id, is_excluded);
                CREATE INDEX IF NOT EXISTS idx_poly_tasks_period_evaluator
                    ON polyvalence_review_tasks(period_id, evaluator_user_id, status);
            `);
        },
        async down(db) {
            for (const index of [
                'idx_users_status_department_name',
                'idx_poly_period_scope',
                'idx_poly_members_period_evaluator',
                'idx_poly_tasks_period_evaluator'
            ]) {
                await db.exec(`DROP INDEX IF EXISTS ${index};`);
            }
        }
    },
];
