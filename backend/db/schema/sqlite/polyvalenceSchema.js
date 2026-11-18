// Initial SQLite schema used only by the versioned base migration.
async function createPolyvalenceSchema(db) {
    const migrationTable = await db.get(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'"
    );
    const privacyMigration = migrationTable
        ? await db.get(
            "SELECT 1 AS applied FROM schema_migrations WHERE version = '013_anonymize_mood_responses'"
        )
        : null;
    const legacyMoodSchema = privacyMigration ? '' : `
CREATE TABLE IF NOT EXISTS mood_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    mood_date TEXT NOT NULL,
    mood_id TEXT NOT NULL,
    mood_label TEXT NOT NULL,
    mood_score INTEGER NOT NULL,
    wants_callback INTEGER DEFAULT 0,
    reason_key TEXT,
    reason_label TEXT,
    department TEXT,
    position TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, mood_date)
);`;
    await db.exec(`
CREATE TABLE IF NOT EXISTS polyvalence_departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    source_department_name TEXT,
    is_archived INTEGER DEFAULT 0,
    archived_at DATETIME,
    archived_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (archived_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    is_archived INTEGER DEFAULT 0,
    archived_at DATETIME,
    archived_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, name),
    FOREIGN KEY (department_id) REFERENCES polyvalence_departments(id),
    FOREIGN KEY (archived_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_skill_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    archived_at DATETIME,
    archived_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, name),
    FOREIGN KEY (department_id) REFERENCES polyvalence_departments(id),
    FOREIGN KEY (archived_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL,
    category_id INTEGER,
    code TEXT,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    archived_at DATETIME,
    archived_by INTEGER,
    archive_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, name),
    FOREIGN KEY (department_id) REFERENCES polyvalence_departments(id),
    FOREIGN KEY (category_id) REFERENCES polyvalence_skill_categories(id),
    FOREIGN KEY (archived_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_skill_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    target_level INTEGER CHECK(target_level IS NULL OR target_level BETWEEN 0 AND 3),
    criticality TEXT DEFAULT 'normal',
    min_qualified_count INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skill_id, role_id),
    FOREIGN KEY (skill_id) REFERENCES polyvalence_skills(id),
    FOREIGN KEY (role_id) REFERENCES polyvalence_roles(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    department_id INTEGER NOT NULL,
    role_id INTEGER,
    evaluator_user_id INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (department_id) REFERENCES polyvalence_departments(id),
    FOREIGN KEY (role_id) REFERENCES polyvalence_roles(id),
    FOREIGN KEY (evaluator_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL UNIQUE,
    frequency_months INTEGER DEFAULT 12,
    next_start_date TEXT,
    duration_days INTEGER DEFAULT 30,
    reminder_days TEXT DEFAULT '7,3,1',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES polyvalence_departments(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_periods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    department_id INTEGER NOT NULL,
    previous_period_id INTEGER,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    opened_at DATETIME,
    opened_by INTEGER,
    closed_at DATETIME,
    closed_by INTEGER,
    cancelled_at DATETIME,
    cancelled_by INTEGER,
    cancellation_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES polyvalence_departments(id),
    FOREIGN KEY (previous_period_id) REFERENCES polyvalence_periods(id),
    FOREIGN KEY (opened_by) REFERENCES users(id),
    FOREIGN KEY (closed_by) REFERENCES users(id),
    FOREIGN KEY (cancelled_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_period_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role_id INTEGER,
    evaluator_user_id INTEGER NOT NULL,
    employee_id_snapshot TEXT,
    employee_name_snapshot TEXT NOT NULL,
    department_name_snapshot TEXT NOT NULL,
    position_snapshot TEXT,
    role_name_snapshot TEXT,
    evaluator_name_snapshot TEXT,
    is_excluded INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(period_id, user_id),
    FOREIGN KEY (period_id) REFERENCES polyvalence_periods(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES polyvalence_roles(id),
    FOREIGN KEY (evaluator_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_period_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    skill_code_snapshot TEXT,
    skill_name_snapshot TEXT NOT NULL,
    category_name_snapshot TEXT,
    sort_order_snapshot INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(period_id, skill_id),
    FOREIGN KEY (period_id) REFERENCES polyvalence_periods(id),
    FOREIGN KEY (skill_id) REFERENCES polyvalence_skills(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL,
    period_member_id INTEGER NOT NULL,
    period_skill_id INTEGER NOT NULL,
    target_level_snapshot INTEGER,
    criticality_snapshot TEXT DEFAULT 'normal',
    min_qualified_count_snapshot INTEGER DEFAULT 1,
    level_value INTEGER CHECK(level_value IS NULL OR level_value BETWEEN 0 AND 3),
    can_train INTEGER DEFAULT 0 CHECK(can_train = 0 OR level_value = 3),
    note TEXT,
    updated_by INTEGER,
    version_no INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(period_id, period_member_id, period_skill_id),
    FOREIGN KEY (period_id) REFERENCES polyvalence_periods(id),
    FOREIGN KEY (period_member_id) REFERENCES polyvalence_period_members(id),
    FOREIGN KEY (period_skill_id) REFERENCES polyvalence_period_skills(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_review_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_id INTEGER NOT NULL,
    evaluator_user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    completed_at DATETIME,
    reopened_at DATETIME,
    reopened_by INTEGER,
    reopen_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(period_id, evaluator_user_id),
    FOREIGN KEY (period_id) REFERENCES polyvalence_periods(id),
    FOREIGN KEY (evaluator_user_id) REFERENCES users(id),
    FOREIGN KEY (reopened_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    actor_user_id INTEGER,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_notification_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    notification_key TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id, notification_key),
    FOREIGN KEY (task_id) REFERENCES polyvalence_review_tasks(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_skill_trainings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id INTEGER NOT NULL,
    video_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(skill_id, video_id),
    FOREIGN KEY (skill_id) REFERENCES polyvalence_skills(id),
    FOREIGN KEY (video_id) REFERENCES videos(id)
);

CREATE TABLE IF NOT EXISTS polyvalence_level_definitions (
    level_value INTEGER PRIMARY KEY CHECK(level_value BETWEEN 0 AND 3),
    label TEXT NOT NULL,
    description TEXT,
    color TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_poly_assessment_period ON polyvalence_assessments(period_id, period_member_id);
CREATE INDEX IF NOT EXISTS ix_poly_task_evaluator ON polyvalence_review_tasks(evaluator_user_id, status);
CREATE INDEX IF NOT EXISTS ix_poly_skill_department ON polyvalence_skills(department_id, is_archived);
CREATE INDEX IF NOT EXISTS ix_poly_audit_entity ON polyvalence_audit_logs(entity_type, entity_id, created_at);

CREATE TABLE IF NOT EXISTS anonymous_mood_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mood_date TEXT NOT NULL,
    mood_id TEXT NOT NULL,
    mood_label TEXT NOT NULL,
    mood_score INTEGER NOT NULL,
    reason_key TEXT,
    reason_label TEXT,
    department TEXT
);

CREATE TABLE IF NOT EXISTS mood_callback_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    requested_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    handled_at DATETIME,
    handled_by INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (handled_by) REFERENCES users(id),
    UNIQUE(user_id, requested_date)
);

CREATE INDEX IF NOT EXISTS ix_anonymous_mood_date_department
    ON anonymous_mood_checks(mood_date, department);
CREATE INDEX IF NOT EXISTS ix_mood_callback_date_status
    ON mood_callback_requests(requested_date, status);
${legacyMoodSchema}
    `);
}

module.exports = { createPolyvalenceSchema };
