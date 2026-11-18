// Initial PostgreSQL schema used only by the versioned base migration.
async function createOperationsSchema(db) {
    await db.exec(`
CREATE TABLE IF NOT EXISTS leave_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    leave_type TEXT,
    requester_name TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    start_datetime TIMESTAMPTZ,
    end_datetime TIMESTAMPTZ,
    return_datetime TIMESTAMPTZ,
    duration_type TEXT,
    duration_value REAL,
    reason TEXT,
    description TEXT,
    status TEXT DEFAULT 'İletildi',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    actioned_by INTEGER,
    actioned_at TIMESTAMPTZ,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (actioned_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS job_postings (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    image_url TEXT,
    publish_date DATE,
    deadline_date DATE,
    position_type TEXT,
    location TEXT,
    manager_name TEXT,
    work_model TEXT,
    job_description TEXT,
    qualifications TEXT,
    prerequisites TEXT,
    additional_notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS job_applications (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES job_postings(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(job_id, user_id)
);

CREATE TABLE IF NOT EXISTS knowledge_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS knowledge_items (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL,
    sub_category TEXT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    is_featured INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES knowledge_categories(id)
);

CREATE TABLE IF NOT EXISTS surveys (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS survey_questions (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL,
    options TEXT,
    is_required INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (survey_id) REFERENCES surveys(id)
);

CREATE TABLE IF NOT EXISTS survey_responses (
    id SERIAL PRIMARY KEY,
    survey_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (survey_id) REFERENCES surveys(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(survey_id, user_id)
);

CREATE TABLE IF NOT EXISTS survey_answers (
    id SERIAL PRIMARY KEY,
    response_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer_value TEXT,
    FOREIGN KEY (response_id) REFERENCES survey_responses(id),
    FOREIGN KEY (question_id) REFERENCES survey_questions(id)
);

CREATE TABLE IF NOT EXISTS meal_menus (
    id SERIAL PRIMARY KEY,
    meal_date TEXT UNIQUE NOT NULL,
    items TEXT NOT NULL,
    source_file TEXT,
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS meal_menu_ratings (
    id SERIAL PRIMARY KEY,
    meal_date TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    food_score INTEGER NOT NULL,
    staff_score INTEGER NOT NULL,
    cleanliness_score INTEGER NOT NULL,
    comment TEXT,
    department TEXT,
    position TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(meal_date, user_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
    id SERIAL PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_routines (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT,
    target TEXT DEFAULT 'all',
    department TEXT,
    schedule_type TEXT DEFAULT 'daily',
    scheduled_date TEXT,
    scheduled_time TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_sent_key TEXT,
    created_by INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
    `);
}

module.exports = { createOperationsSchema };

