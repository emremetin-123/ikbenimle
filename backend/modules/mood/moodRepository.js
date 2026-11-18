const {
    MIN_ANONYMOUS_COHORT,
    getDateRange
} = require('../../services/moodPrivacyService');

const buildFilter = (input, alias = 'm') => {
    const range = getDateRange(input);
    const clauses = [`${alias}.mood_date >= ?`, `${alias}.mood_date <= ?`];
    const params = [range.from, range.to];
    if (range.department) {
        clauses.push(`${alias}.department = ?`);
        params.push(range.department);
    }
    return { ...range, whereSql: `WHERE ${clauses.join(' AND ')}`, params };
};

const eligibleCohortsSql = filter => `
    SELECT m.mood_date, COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş') AS department
    FROM anonymous_mood_checks m
    ${filter.whereSql}
    GROUP BY m.mood_date, COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş')
    HAVING COUNT(*) >= ${MIN_ANONYMOUS_COHORT}
`;

const groupedMoodSelectSql = () => `
    SELECT
        m.mood_date,
        COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş') AS department,
        m.mood_id, m.mood_label, m.mood_score,
        m.reason_key, m.reason_label, COUNT(*) AS response_count
    FROM anonymous_mood_checks m
    INNER JOIN eligible_cohorts cohort
        ON cohort.mood_date = m.mood_date
        AND cohort.department = COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş')
    GROUP BY
        m.mood_date, COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş'),
        m.mood_id, m.mood_label, m.mood_score, m.reason_key, m.reason_label
`;

function createMoodRepository(db) {
    const readRows = async (input, pagination = null) => {
        const filter = buildFilter(input);
        const groupedSelect = groupedMoodSelectSql();
        if (!pagination) {
            return db.all(`
                WITH eligible_cohorts AS (${eligibleCohortsSql(filter)})
                ${groupedSelect}
                ORDER BY m.mood_date DESC, department, m.mood_score DESC
            `, filter.params);
        }
        const sortColumns = {
            mood_date: 'mood_date',
            mood_score: 'mood_score',
            response_count: 'response_count'
        };
        const sortColumn = sortColumns[input.sort] || sortColumns.mood_date;
        const sortDirection = input.order === 'asc' ? 'ASC' : 'DESC';
        return db.all(`
            WITH eligible_cohorts AS (${eligibleCohortsSql(filter)}),
            grouped_moods AS (${groupedSelect}),
            ranked_moods AS (
                SELECT grouped_moods.*,
                    ROW_NUMBER() OVER (
                        ORDER BY ${sortColumn} ${sortDirection}, department, mood_id
                    ) AS row_num
                FROM grouped_moods
            )
            SELECT mood_date, department, mood_id, mood_label, mood_score,
                   reason_key, reason_label, response_count
            FROM ranked_moods
            WHERE row_num BETWEEN ? AND ?
            ORDER BY row_num
        `, [...filter.params, pagination.startRow, pagination.endRow]);
    };

    const countCallbacks = async (input) => {
        const range = getDateRange(input);
        const clauses = ['c.requested_date >= ?', 'c.requested_date <= ?'];
        const params = [range.from, range.to];
        if (range.department) {
            clauses.push('u.department = ?');
            params.push(range.department);
        }
        const row = await db.get(`
            SELECT COUNT(*) AS total
            FROM mood_callback_requests c
            INNER JOIN users u ON u.id = c.user_id
            WHERE ${clauses.join(' AND ')}
        `, params);
        return Number(row?.total || 0);
    };

    return {
        readRows,
        callbackExists(userId, date) {
            return db.get(`
                SELECT 1 AS requested FROM mood_callback_requests
                WHERE user_id = ? AND requested_date = ?
            `, [userId, date]);
        },
        findDepartment(userId) {
            return db.get('SELECT department FROM users WHERE id = ?', [userId]);
        },
        insertMood(data) {
            return db.run(`
                INSERT INTO anonymous_mood_checks (
                    mood_date, mood_id, mood_label, mood_score,
                    reason_key, reason_label, department
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                data.date, data.moodId, data.moodLabel, data.moodScore,
                data.reasonKey, data.reasonLabel, data.department
            ]);
        },
        createCallback(userId, date) {
            return db.run(`
                INSERT INTO mood_callback_requests (user_id, requested_date, status)
                VALUES (?, ?, ?)
            `, [userId, date, 'pending']);
        },
        async countGroups(input) {
            const filter = buildFilter(input);
            const row = await db.get(`
                WITH eligible_cohorts AS (${eligibleCohortsSql(filter)}),
                grouped_moods AS (${groupedMoodSelectSql()})
                SELECT COUNT(*) AS total FROM grouped_moods
            `, filter.params);
            return Number(row?.total || 0);
        },
        async summarize(input) {
            const filter = buildFilter(input);
            const cohorts = eligibleCohortsSql(filter);
            const [overall, moods, reasons, departments, callbacks] = await Promise.all([
                db.get(`
                    WITH eligible_cohorts AS (${cohorts})
                    SELECT COUNT(*) AS total,
                           AVG(CAST(m.mood_score AS FLOAT)) AS average_score
                    FROM anonymous_mood_checks m
                    INNER JOIN eligible_cohorts cohort
                        ON cohort.mood_date = m.mood_date
                        AND cohort.department =
                            COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş')
                `, filter.params),
                db.all(`
                    WITH eligible_cohorts AS (${cohorts})
                    SELECT m.mood_id, COUNT(*) AS count
                    FROM anonymous_mood_checks m
                    INNER JOIN eligible_cohorts cohort
                        ON cohort.mood_date = m.mood_date
                        AND cohort.department =
                            COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş')
                    GROUP BY m.mood_id
                `, filter.params),
                db.all(`
                    WITH eligible_cohorts AS (${cohorts})
                    SELECT m.reason_key, COUNT(*) AS count
                    FROM anonymous_mood_checks m
                    INNER JOIN eligible_cohorts cohort
                        ON cohort.mood_date = m.mood_date
                        AND cohort.department =
                            COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş')
                    WHERE m.reason_key IS NOT NULL
                    GROUP BY m.reason_key
                `, filter.params),
                db.all(`
                    WITH eligible_cohorts AS (${cohorts})
                    SELECT
                        COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş') AS department,
                        COUNT(*) AS total,
                        AVG(CAST(m.mood_score AS FLOAT)) AS average_score,
                        SUM(CASE WHEN m.mood_id IN ('tired', 'sad') THEN 1 ELSE 0 END)
                            AS tired_or_sad
                    FROM anonymous_mood_checks m
                    INNER JOIN eligible_cohorts cohort
                        ON cohort.mood_date = m.mood_date
                        AND cohort.department =
                            COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş')
                    GROUP BY COALESCE(NULLIF(m.department, ''), 'Belirtilmemiş')
                    ORDER BY department
                `, filter.params),
                countCallbacks(input)
            ]);
            return {
                total: Number(overall?.total || 0),
                average_score: Number(Number(overall?.average_score || 0).toFixed(2)),
                callbacks,
                anonymity_threshold: MIN_ANONYMOUS_COHORT,
                suppressed: Number(overall?.total || 0) === 0,
                mood_counts: Object.fromEntries(
                    moods.map(item => [item.mood_id, Number(item.count || 0)])
                ),
                reason_counts: Object.fromEntries(
                    reasons.map(item => [item.reason_key, Number(item.count || 0)])
                ),
                departments: Object.fromEntries(departments.map(row => [
                    row.department,
                    {
                        total: Number(row.total || 0),
                        average_score: Number(Number(row.average_score || 0).toFixed(2)),
                        tired_or_sad: Number(row.tired_or_sad || 0)
                    }
                ]))
            };
        },
        async listDepartments() {
            const rows = await db.all(`
                SELECT DISTINCT department FROM anonymous_mood_checks
                WHERE department IS NOT NULL AND department <> ''
                ORDER BY department
            `);
            return rows.map(row => row.department);
        },
        async readCallbacks(input, pagination) {
            const range = getDateRange(input);
            const clauses = ['c.requested_date >= ?', 'c.requested_date <= ?'];
            const params = [range.from, range.to];
            if (range.department) {
                clauses.push('u.department = ?');
                params.push(range.department);
            }
            const whereSql = `WHERE ${clauses.join(' AND ')}`;
            const sortColumns = {
                requested_date: 'c.requested_date',
                created_at: 'c.created_at',
                name: 'u.name'
            };
            const sortColumn = sortColumns[input.sort] || sortColumns.requested_date;
            const sortDirection = input.order === 'asc' ? 'ASC' : 'DESC';
            const [count, items] = await Promise.all([
                db.get(`
                    SELECT COUNT(*) AS total FROM mood_callback_requests c
                    INNER JOIN users u ON u.id = c.user_id ${whereSql}
                `, params),
                db.all(`
                    WITH ranked_callbacks AS (
                        SELECT c.id, c.requested_date, c.status, c.created_at,
                               u.employee_id, u.name, u.department, u.position,
                               ROW_NUMBER() OVER (
                                   ORDER BY ${sortColumn} ${sortDirection}, c.id DESC
                               ) AS row_num
                        FROM mood_callback_requests c
                        INNER JOIN users u ON u.id = c.user_id ${whereSql}
                    )
                    SELECT id, requested_date, status, created_at,
                           employee_id, name, department, position
                    FROM ranked_callbacks
                    WHERE row_num BETWEEN ? AND ? ORDER BY row_num
                `, [...params, pagination.startRow, pagination.endRow])
            ]);
            return { items, total: Number(count?.total || 0) };
        }
    };
}

module.exports = { createMoodRepository };
