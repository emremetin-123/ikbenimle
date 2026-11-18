module.exports = [
    {
        version: '016_polyvalence_membership_overrides',
        async up(db) {
            await db.exec(`
                ALTER TABLE polyvalence_memberships
                    ADD COLUMN is_manual_override INTEGER NOT NULL DEFAULT 0;
            `);
            await db.run(`
                UPDATE polyvalence_memberships
                SET is_manual_override = 1
                WHERE
                    COALESCE(evaluator_user_id, 0) <> COALESCE((
                        SELECT manager_id FROM users
                        WHERE users.id = polyvalence_memberships.user_id
                    ), 0)
                    OR LOWER(COALESCE((
                        SELECT COALESCE(source_department_name, name)
                        FROM polyvalence_departments
                        WHERE polyvalence_departments.id = polyvalence_memberships.department_id
                    ), '')) <> LOWER(COALESCE((
                        SELECT department FROM users
                        WHERE users.id = polyvalence_memberships.user_id
                    ), ''))
                    OR LOWER(COALESCE((
                        SELECT name FROM polyvalence_roles
                        WHERE polyvalence_roles.id = polyvalence_memberships.role_id
                    ), '')) <> LOWER(COALESCE((
                        SELECT position FROM users
                        WHERE users.id = polyvalence_memberships.user_id
                    ), ''))
            `);
        },
        async down(db) {
            await db.exec(`
                ALTER TABLE polyvalence_memberships
                    DROP COLUMN is_manual_override;
            `);
        }
    }
];
