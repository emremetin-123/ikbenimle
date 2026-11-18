// Compatibility upgrades for databases created before versioned migrations.
async function applyLegacyUpgrades(db) {
// Original SQLite migrations
const userTableInfo = await db.all("PRAGMA table_info(users)");
const uCols = userTableInfo.map(c => c.name);
if (!uCols.includes('position')) await db.run('ALTER TABLE users ADD COLUMN position TEXT');
if (!uCols.includes('permissions')) await db.run('ALTER TABLE users ADD COLUMN permissions TEXT');
if (!uCols.includes('manager_id')) await db.run('ALTER TABLE users ADD COLUMN manager_id INTEGER');
if (!uCols.includes('status')) await db.run("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
if (!uCols.includes('session_version')) await db.run('ALTER TABLE users ADD COLUMN session_version INTEGER DEFAULT 0');

const polyPeriodMemberInfo = await db.all("PRAGMA table_info(polyvalence_period_members)");
if (!polyPeriodMemberInfo.some(column => column.name === 'role_name_snapshot')) {
    await db.run('ALTER TABLE polyvalence_period_members ADD COLUMN role_name_snapshot TEXT');
}
const polyAssessmentInfo = await db.all("PRAGMA table_info(polyvalence_assessments)");
if (!polyAssessmentInfo.some(column => column.name === 'criticality_snapshot')) {
    await db.run("ALTER TABLE polyvalence_assessments ADD COLUMN criticality_snapshot TEXT DEFAULT 'normal'");
}
if (!polyAssessmentInfo.some(column => column.name === 'min_qualified_count_snapshot')) {
    await db.run('ALTER TABLE polyvalence_assessments ADD COLUMN min_qualified_count_snapshot INTEGER DEFAULT 1');
}

const moodTableInfo = await db.all("PRAGMA table_info(mood_checks)");
const moodCols = moodTableInfo.map(c => c.name);
if (moodCols.length && !moodCols.includes('reason_key')) {
    await db.run('ALTER TABLE mood_checks ADD COLUMN reason_key TEXT');
}
if (moodCols.length && !moodCols.includes('reason_label')) {
    await db.run('ALTER TABLE mood_checks ADD COLUMN reason_label TEXT');
}

const announcementTableInfo = await db.all("PRAGMA table_info(announcements)");
const annCols = announcementTableInfo.map(c => c.name);
if (!annCols.includes('attachment_path')) await db.run('ALTER TABLE announcements ADD COLUMN attachment_path TEXT');
if (!annCols.includes('attachment_name')) await db.run('ALTER TABLE announcements ADD COLUMN attachment_name TEXT');
if (!annCols.includes('attachment_type')) await db.run('ALTER TABLE announcements ADD COLUMN attachment_type TEXT');
if (!annCols.includes('attachment_public_id')) await db.run('ALTER TABLE announcements ADD COLUMN attachment_public_id TEXT');
if (!annCols.includes('target_department')) await db.run('ALTER TABLE announcements ADD COLUMN target_department TEXT');
if (!annCols.includes('visible_until')) await db.run('ALTER TABLE announcements ADD COLUMN visible_until DATE');

await db.run(`CREATE TABLE IF NOT EXISTS service_routes (
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
)`);
await db.run(`CREATE TABLE IF NOT EXISTS service_route_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    arrival_time TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    order_index INTEGER DEFAULT 0,
    FOREIGN KEY (route_id) REFERENCES service_routes(id)
)`);

const assignmentInfo = await db.all("PRAGMA table_info(assignments)");
const aCols = assignmentInfo.map(c => c.name);
if (!aCols.includes('due_date')) await db.run('ALTER TABLE assignments ADD COLUMN due_date DATETIME');
if (!aCols.includes('assigned_at')) await db.run('ALTER TABLE assignments ADD COLUMN assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP');
if (!aCols.includes('first_accessed_at')) await db.run('ALTER TABLE assignments ADD COLUMN first_accessed_at DATETIME');
if (!aCols.includes('completed_at')) await db.run('ALTER TABLE assignments ADD COLUMN completed_at DATETIME');
if (!aCols.includes('reference_id')) {
    await db.run('ALTER TABLE assignments ADD COLUMN reference_id TEXT');
    await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_reference_id ON assignments(reference_id)');
}
if (!aCols.includes('confirmed_at')) await db.run('ALTER TABLE assignments ADD COLUMN confirmed_at DATETIME');
if (!aCols.includes('assigned_version_no')) await db.run('ALTER TABLE assignments ADD COLUMN assigned_version_no INTEGER');
if (!aCols.includes('snapshot_json')) await db.run('ALTER TABLE assignments ADD COLUMN snapshot_json TEXT');
if (!aCols.includes('expires_at')) await db.run('ALTER TABLE assignments ADD COLUMN expires_at DATETIME');
if (!aCols.includes('voided_at')) await db.run('ALTER TABLE assignments ADD COLUMN voided_at DATETIME');
if (!aCols.includes('void_reason')) await db.run('ALTER TABLE assignments ADD COLUMN void_reason TEXT');
if (!aCols.includes('voided_by')) await db.run('ALTER TABLE assignments ADD COLUMN voided_by INTEGER');

const leaveTableInfo = await db.all("PRAGMA table_info(leave_requests)");
const lCols = leaveTableInfo.map(c => c.name);
if (!lCols.includes('leave_type')) await db.run('ALTER TABLE leave_requests ADD COLUMN leave_type TEXT');
if (!lCols.includes('requester_name')) await db.run('ALTER TABLE leave_requests ADD COLUMN requester_name TEXT');
if (!lCols.includes('start_datetime')) await db.run('ALTER TABLE leave_requests ADD COLUMN start_datetime DATETIME');
if (!lCols.includes('end_datetime')) await db.run('ALTER TABLE leave_requests ADD COLUMN end_datetime DATETIME');
if (!lCols.includes('return_datetime')) await db.run('ALTER TABLE leave_requests ADD COLUMN return_datetime DATETIME');
if (!lCols.includes('duration_type')) await db.run('ALTER TABLE leave_requests ADD COLUMN duration_type TEXT');
if (!lCols.includes('duration_value')) await db.run('ALTER TABLE leave_requests ADD COLUMN duration_value REAL');
if (!lCols.includes('description')) await db.run('ALTER TABLE leave_requests ADD COLUMN description TEXT');

const videoTableInfo = await db.all("PRAGMA table_info(videos)");
const vCols = videoTableInfo.map(c => c.name);
if (!vCols.includes('category')) await db.run('ALTER TABLE videos ADD COLUMN category TEXT');
if (!vCols.includes('pass_score')) await db.run('ALTER TABLE videos ADD COLUMN pass_score INTEGER DEFAULT 0');
if (!vCols.includes('trainer_name')) await db.run('ALTER TABLE videos ADD COLUMN trainer_name TEXT');
if (!vCols.includes('trainer_title')) await db.run('ALTER TABLE videos ADD COLUMN trainer_title TEXT');
if (!vCols.includes('duration')) await db.run('ALTER TABLE videos ADD COLUMN duration TEXT');
if (!vCols.includes('validity_period')) await db.run('ALTER TABLE videos ADD COLUMN validity_period TEXT');
if (!vCols.includes('awards_badge')) await db.run('ALTER TABLE videos ADD COLUMN awards_badge INTEGER DEFAULT 1');
if (!vCols.includes('certificate_enabled')) await db.run('ALTER TABLE videos ADD COLUMN certificate_enabled INTEGER DEFAULT 1');
if (!vCols.includes('auto_reassign_enabled')) await db.run('ALTER TABLE videos ADD COLUMN auto_reassign_enabled INTEGER DEFAULT 0');
if (!vCols.includes('validity_amount')) await db.run('ALTER TABLE videos ADD COLUMN validity_amount INTEGER');
if (!vCols.includes('validity_unit')) await db.run('ALTER TABLE videos ADD COLUMN validity_unit TEXT');
if (!vCols.includes('pause_on_blur')) await db.run('ALTER TABLE videos ADD COLUMN pause_on_blur INTEGER DEFAULT 0');
if (!vCols.includes('disable_forward_seek')) await db.run('ALTER TABLE videos ADD COLUMN disable_forward_seek INTEGER DEFAULT 0');
if (!vCols.includes('track_watch_seconds')) await db.run('ALTER TABLE videos ADD COLUMN track_watch_seconds INTEGER DEFAULT 0');
if (!vCols.includes('quiz_attempt_limit')) await db.run('ALTER TABLE videos ADD COLUMN quiz_attempt_limit INTEGER DEFAULT 0');
if (!vCols.includes('training_profile')) await db.run("ALTER TABLE videos ADD COLUMN training_profile TEXT DEFAULT 'standard'");
if (!vCols.includes('delivery_method')) await db.run("ALTER TABLE videos ADD COLUMN delivery_method TEXT DEFAULT 'online'");
if (!vCols.includes('is_mandatory')) await db.run('ALTER TABLE videos ADD COLUMN is_mandatory INTEGER DEFAULT 1');
if (!vCols.includes('compliance_lock')) await db.run('ALTER TABLE videos ADD COLUMN compliance_lock INTEGER DEFAULT 0');
if (!vCols.includes('version_no')) await db.run('ALTER TABLE videos ADD COLUMN version_no INTEGER DEFAULT 1');
if (!vCols.includes('parent_video_id')) await db.run('ALTER TABLE videos ADD COLUMN parent_video_id INTEGER');
if (!vCols.includes('is_latest')) await db.run('ALTER TABLE videos ADD COLUMN is_latest INTEGER DEFAULT 1');
if (!vCols.includes('is_active')) await db.run('ALTER TABLE videos ADD COLUMN is_active INTEGER DEFAULT 1');
if (!vCols.includes('minimum_watch_percent')) await db.run('ALTER TABLE videos ADD COLUMN minimum_watch_percent INTEGER DEFAULT 100');
if (!vCols.includes('requires_full_watch')) await db.run('ALTER TABLE videos ADD COLUMN requires_full_watch INTEGER DEFAULT 1');
if (!vCols.includes('requires_quiz')) await db.run('ALTER TABLE videos ADD COLUMN requires_quiz INTEGER DEFAULT 1');
if (!vCols.includes('official_documents_enabled')) await db.run('ALTER TABLE videos ADD COLUMN official_documents_enabled INTEGER DEFAULT 0');
if (!vCols.includes('detailed_audit_enabled')) await db.run('ALTER TABLE videos ADD COLUMN detailed_audit_enabled INTEGER DEFAULT 0');
if (!vCols.includes('cover_image_url')) await db.run('ALTER TABLE videos ADD COLUMN cover_image_url TEXT');

const lessonTableInfo = await db.all("PRAGMA table_info(lessons)");
const lessonCols = lessonTableInfo.map(c => c.name);
if (!lessonCols.includes('content_type')) await db.run("ALTER TABLE lessons ADD COLUMN content_type TEXT DEFAULT 'video'");
if (!lessonCols.includes('content_metadata')) await db.run('ALTER TABLE lessons ADD COLUMN content_metadata TEXT');
if (!lessonCols.includes('required_seconds')) await db.run('ALTER TABLE lessons ADD COLUMN required_seconds INTEGER DEFAULT 0');
if (!lessonCols.includes('required_percent')) await db.run('ALTER TABLE lessons ADD COLUMN required_percent INTEGER DEFAULT 100');

const lessonProgressInfo = await db.all("PRAGMA table_info(lesson_progress)");
const lpCols = lessonProgressInfo.map(c => c.name);
if (!lpCols.includes('watched_seconds')) await db.run('ALTER TABLE lesson_progress ADD COLUMN watched_seconds INTEGER DEFAULT 0');
if (!lpCols.includes('max_position')) await db.run('ALTER TABLE lesson_progress ADD COLUMN max_position REAL DEFAULT 0');
if (!lpCols.includes('last_position')) await db.run('ALTER TABLE lesson_progress ADD COLUMN last_position REAL DEFAULT 0');
if (!lpCols.includes('quiz_attempts')) await db.run('ALTER TABLE lesson_progress ADD COLUMN quiz_attempts INTEGER DEFAULT 0');
if (!lpCols.includes('requires_rewatch')) await db.run('ALTER TABLE lesson_progress ADD COLUMN requires_rewatch INTEGER DEFAULT 0');
if (!lpCols.includes('active_seconds')) await db.run('ALTER TABLE lesson_progress ADD COLUMN active_seconds INTEGER DEFAULT 0');
if (!lpCols.includes('content_progress_percent')) await db.run('ALTER TABLE lesson_progress ADD COLUMN content_progress_percent INTEGER DEFAULT 0');
if (!lpCols.includes('page_number')) await db.run('ALTER TABLE lesson_progress ADD COLUMN page_number INTEGER DEFAULT 0');
if (!lpCols.includes('page_count')) await db.run('ALTER TABLE lesson_progress ADD COLUMN page_count INTEGER DEFAULT 0');

const trainingLogInfo = await db.all("PRAGMA table_info(training_activity_logs)");
const logCols = trainingLogInfo.map(c => c.name);
if (!logCols.includes('session_id')) await db.run('ALTER TABLE training_activity_logs ADD COLUMN session_id TEXT');
if (!logCols.includes('ip_address')) await db.run('ALTER TABLE training_activity_logs ADD COLUMN ip_address TEXT');
if (!logCols.includes('user_agent')) await db.run('ALTER TABLE training_activity_logs ADD COLUMN user_agent TEXT');

const quizTableInfo = await db.all("PRAGMA table_info(quizzes)");
if (!quizTableInfo.find(c => c.name === 'lesson_id')) await db.run('ALTER TABLE quizzes ADD COLUMN lesson_id INTEGER');

const fbTableInfo = await db.all("PRAGMA table_info(feedback)");
const fbCols = fbTableInfo.map(c => c.name);
if (!fbCols.includes('details')) await db.run('ALTER TABLE feedback ADD COLUMN details TEXT');
if (!fbCols.includes('file_path')) await db.run('ALTER TABLE feedback ADD COLUMN file_path TEXT');
if (!fbCols.includes('assigned_to_user_id')) await db.run('ALTER TABLE feedback ADD COLUMN assigned_to_user_id INTEGER');
if (!fbCols.includes('assigned_department')) await db.run('ALTER TABLE feedback ADD COLUMN assigned_department TEXT');
if (!fbCols.includes('due_date')) await db.run('ALTER TABLE feedback ADD COLUMN due_date DATE');
if (!fbCols.includes('decision')) await db.run('ALTER TABLE feedback ADD COLUMN decision TEXT');
if (!fbCols.includes('decision_note')) await db.run('ALTER TABLE feedback ADD COLUMN decision_note TEXT');
if (!fbCols.includes('public_response')) await db.run('ALTER TABLE feedback ADD COLUMN public_response TEXT');
if (!fbCols.includes('updated_at')) await db.run('ALTER TABLE feedback ADD COLUMN updated_at DATETIME');

const piTableInfo = await db.all("PRAGMA table_info(personal_info)");
const piCols = piTableInfo.map(c => c.name);
if (!piCols.includes('photo_path')) await db.run('ALTER TABLE personal_info ADD COLUMN photo_path TEXT');
if (!piCols.includes('photo_public_id')) await db.run('ALTER TABLE personal_info ADD COLUMN photo_public_id TEXT');
if (!piCols.includes('email')) await db.run('ALTER TABLE personal_info ADD COLUMN email TEXT');
if (!piCols.includes('clothing_top')) await db.run('ALTER TABLE personal_info ADD COLUMN clothing_top TEXT');
if (!piCols.includes('clothing_bottom')) await db.run('ALTER TABLE personal_info ADD COLUMN clothing_bottom TEXT');
if (!piCols.includes('shoe_size')) await db.run('ALTER TABLE personal_info ADD COLUMN shoe_size TEXT');
}

module.exports = { applyLegacyUpgrades };
