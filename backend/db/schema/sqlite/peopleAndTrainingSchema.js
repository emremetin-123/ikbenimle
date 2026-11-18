// Initial SQLite schema used only by the versioned base migration.
async function createPeopleAndTrainingSchema(db) {
    await db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT UNIQUE,
    name TEXT,
    department TEXT,
    position TEXT,
    manager_id INTEGER,
    status TEXT DEFAULT 'active',
    password_hash TEXT,
    role TEXT DEFAULT 'employee',
    permissions TEXT,
    session_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    url TEXT,
    description TEXT,
    category TEXT,
    pass_score INTEGER DEFAULT 0,
    trainer_name TEXT,
    trainer_title TEXT,
    duration TEXT,
    validity_period TEXT,
    awards_badge INTEGER DEFAULT 1,
    certificate_enabled INTEGER DEFAULT 1,
    auto_reassign_enabled INTEGER DEFAULT 0,
    validity_amount INTEGER,
    validity_unit TEXT,
    pause_on_blur INTEGER DEFAULT 0,
    disable_forward_seek INTEGER DEFAULT 0,
    track_watch_seconds INTEGER DEFAULT 0,
    quiz_attempt_limit INTEGER DEFAULT 0,
    training_profile TEXT DEFAULT 'standard',
    delivery_method TEXT DEFAULT 'online',
    is_mandatory INTEGER DEFAULT 1,
    compliance_lock INTEGER DEFAULT 0,
    version_no INTEGER DEFAULT 1,
    parent_video_id INTEGER,
    is_latest INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    minimum_watch_percent INTEGER DEFAULT 100,
    requires_full_watch INTEGER DEFAULT 1,
    requires_quiz INTEGER DEFAULT 1,
    official_documents_enabled INTEGER DEFAULT 0,
    detailed_audit_enabled INTEGER DEFAULT 0,
    cover_image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    title TEXT,
    url TEXT,
    description TEXT,
    content_type TEXT DEFAULT 'video',
    content_metadata TEXT,
    required_seconds INTEGER DEFAULT 0,
    required_percent INTEGER DEFAULT 100,
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (video_id) REFERENCES videos(id)
);

CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    video_id INTEGER NOT NULL,
    status TEXT DEFAULT 'assigned',
    quiz_score INTEGER,
    due_date DATETIME,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    first_accessed_at DATETIME,
    completed_at DATETIME,
    reference_id TEXT UNIQUE,
    confirmed_at DATETIME,
    assigned_version_no INTEGER,
    snapshot_json TEXT,
    expires_at DATETIME,
    voided_at DATETIME,
    void_reason TEXT,
    voided_by INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (video_id) REFERENCES videos(id)
);

CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER,
    lesson_id INTEGER,
    data TEXT,
    FOREIGN KEY (video_id) REFERENCES videos(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    status TEXT DEFAULT 'assigned',
    score INTEGER,
    watched_seconds INTEGER DEFAULT 0,
    max_position REAL DEFAULT 0,
    last_position REAL DEFAULT 0,
    quiz_attempts INTEGER DEFAULT 0,
    requires_rewatch INTEGER DEFAULT 0,
    active_seconds INTEGER DEFAULT 0,
    content_progress_percent INTEGER DEFAULT 0,
    page_number INTEGER DEFAULT 0,
    page_count INTEGER DEFAULT 0,
    completed_at DATETIME,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id),
    UNIQUE(assignment_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS training_activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER,
    user_id INTEGER,
    video_id INTEGER,
    lesson_id INTEGER,
    event_type TEXT,
    event_data TEXT,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS training_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    score INTEGER,
    passed INTEGER DEFAULT 0,
    answers_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS training_evidence_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    evidence_type TEXT,
    file_path TEXT,
    file_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS personal_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE NOT NULL,
    phone TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    blood_type TEXT,
    birth_date DATE,
    photo_path TEXT,
    photo_public_id TEXT,
    email TEXT,
    clothing_top TEXT,
    clothing_bottom TEXT,
    shoe_size TEXT,
    education TEXT,
    hobbies TEXT,
    skills TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_by_admin_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (uploaded_by_admin_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS document_request_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_request_fields (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    field_key TEXT NOT NULL,
    field_type TEXT DEFAULT 'text',
    is_required INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    placeholder TEXT,
    FOREIGN KEY (type_id) REFERENCES document_request_types(id)
);

CREATE TABLE IF NOT EXISTS document_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type_id INTEGER NOT NULL,
    status TEXT DEFAULT 'Beklemede',
    answers_json TEXT,
    hr_note TEXT,
    response_file_path TEXT,
    response_file_name TEXT,
    response_uploaded_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    handled_by_admin_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (type_id) REFERENCES document_request_types(id),
    FOREIGN KEY (handled_by_admin_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    attachment_path TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    attachment_public_id TEXT,
    target_department TEXT,
    visible_until DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    subscription_json TEXT NOT NULL,
    device_label TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS company_news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    image_public_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS service_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    direction TEXT,
    plate TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    notes TEXT,
    color TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS service_route_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    arrival_time TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (route_id) REFERENCES service_routes(id)
);

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    assigned_to_user_id INTEGER,
    assigned_department TEXT,
    due_date DATE,
    decision TEXT,
    decision_note TEXT,
    public_response TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feedback_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    added_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feedback_id) REFERENCES feedback(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (added_by) REFERENCES users(id),
    UNIQUE(feedback_id, user_id)
);

CREATE TABLE IF NOT EXISTS feedback_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_id INTEGER NOT NULL,
    user_id INTEGER,
    comment TEXT NOT NULL,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feedback_id) REFERENCES feedback(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS feedback_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feedback_id INTEGER NOT NULL,
    user_id INTEGER,
    old_status TEXT,
    new_status TEXT NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (feedback_id) REFERENCES feedback(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
    `);
}

module.exports = { createPeopleAndTrainingSchema };
