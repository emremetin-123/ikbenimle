const createSurveyRepository = db => ({
    countEmployeeSurveys: (search) => {
        const params = [];
        const clauses = ["s.status = 'active'"];
        if (search) {
            const pattern = `%${search}%`;
            clauses.push('(s.title LIKE ? OR s.description LIKE ?)');
            params.push(pattern, pattern);
        }
        return db.get(
            `SELECT COUNT(*) AS total FROM surveys s WHERE ${clauses.join(' AND ')}`,
            params
        );
    },
    listEmployeeSurveys: (userId, query, pagination, sortColumn, sortDirection) => {
        const params = [];
        const clauses = ["s.status = 'active'"];
        if (query.search) {
            const pattern = `%${query.search}%`;
            clauses.push('(s.title LIKE ? OR s.description LIKE ?)');
            params.push(pattern, pattern);
        }
        const where = `WHERE ${clauses.join(' AND ')}`;
        return db.all(
            `WITH question_counts AS (
                SELECT survey_id, COUNT(*) AS question_count FROM survey_questions GROUP BY survey_id
             ), response_counts AS (
                SELECT survey_id, COUNT(*) AS response_count FROM survey_responses GROUP BY survey_id
             ), user_responses AS (
                SELECT survey_id, 1 AS has_responded FROM survey_responses
                WHERE user_id = ? GROUP BY survey_id
             ), ranked_surveys AS (
                SELECT s.id, s.title, s.description, s.status, s.created_at, s.updated_at,
                       COALESCE(qc.question_count, 0) AS question_count,
                       COALESCE(rc.response_count, 0) AS response_count,
                       COALESCE(ur.has_responded, 0) AS has_responded,
                       ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}, s.id DESC) AS row_num
                FROM surveys s
                LEFT JOIN question_counts qc ON qc.survey_id = s.id
                LEFT JOIN response_counts rc ON rc.survey_id = s.id
                LEFT JOIN user_responses ur ON ur.survey_id = s.id ${where}
             )
             SELECT id, title, description, status, created_at, updated_at,
                    question_count, response_count, has_responded
             FROM ranked_surveys WHERE row_num BETWEEN ? AND ? ORDER BY row_num`,
            [userId, ...params, pagination.startRow, pagination.endRow]
        );
    },
    getActiveSurveyForUser: (surveyId, userId) => db.get(
        `SELECT s.*,
                CASE WHEN EXISTS (
                    SELECT 1 FROM survey_responses r WHERE r.survey_id = s.id AND r.user_id = ?
                ) THEN 1 ELSE 0 END AS has_responded
         FROM surveys s WHERE s.id = ? AND s.status = 'active'`,
        [userId, surveyId]
    ),
    getActiveSurvey: surveyId => db.get(
        'SELECT * FROM surveys WHERE id = ? AND status = ?',
        [surveyId, 'active']
    ),
    getSurvey: surveyId => db.get('SELECT * FROM surveys WHERE id = ?', [surveyId]),
    getQuestions: (surveyId, ordered = true) => db.all(
        `SELECT * FROM survey_questions WHERE survey_id = ?
         ${ordered ? 'ORDER BY order_index ASC, id ASC' : ''}`,
        [surveyId]
    ),
    getExistingResponse: (surveyId, userId) => db.get(
        'SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ?',
        [surveyId, userId]
    ),
    createResponse: (surveyId, userId, answers) => db.transaction(async (tx) => {
        const response = await tx.run(
            'INSERT INTO survey_responses (survey_id, user_id) VALUES (?, ?)',
            [surveyId, userId]
        );
        for (const answer of answers) {
            await tx.run(
                `INSERT INTO survey_answers (response_id, question_id, answer_value)
                 VALUES (?, ?, ?)`,
                [response.lastID, answer.questionId, answer.value]
            );
        }
        return response.lastID;
    }),
    countAdminSurveys: (query) => {
        const { where, params } = buildAdminSurveyFilter(query);
        return db.get(`SELECT COUNT(*) AS total FROM surveys s ${where}`, params);
    },
    listAdminSurveys: (query, pagination, sortColumn, sortDirection) => {
        const { where, params } = buildAdminSurveyFilter(query);
        return db.all(
            `WITH question_counts AS (
                SELECT survey_id, COUNT(*) AS question_count FROM survey_questions GROUP BY survey_id
             ), response_counts AS (
                SELECT survey_id, COUNT(*) AS response_count FROM survey_responses GROUP BY survey_id
             ), ranked_surveys AS (
                SELECT s.id, s.title, s.description, s.status, s.created_at, s.updated_at, s.created_by,
                       COALESCE(qc.question_count, 0) AS question_count,
                       COALESCE(rc.response_count, 0) AS response_count,
                       ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}, s.id DESC) AS row_num
                FROM surveys s
                LEFT JOIN question_counts qc ON qc.survey_id = s.id
                LEFT JOIN response_counts rc ON rc.survey_id = s.id ${where}
             )
             SELECT id, title, description, status, created_at, updated_at,
                    created_by, question_count, response_count
             FROM ranked_surveys WHERE row_num BETWEEN ? AND ? ORDER BY row_num`,
            [...params, pagination.startRow, pagination.endRow]
        );
    },
    createSurvey: data => db.transaction(async (tx) => {
        const result = await tx.run(
            'INSERT INTO surveys (title, description, status, created_by) VALUES (?, ?, ?, ?)',
            [data.title, data.description, data.status, data.createdBy]
        );
        for (const question of data.questions) {
            await tx.run(
                `INSERT INTO survey_questions
                 (survey_id, question_text, question_type, options, is_required, order_index)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [result.lastID, question.text, question.type, question.options, question.isRequired ? 1 : 0, question.orderIndex]
            );
        }
        return result.lastID;
    }),
    updateStatus: (surveyId, status) => db.run(
        'UPDATE surveys SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, surveyId]
    ),
    deleteSurvey: surveyId => db.transaction(async (tx) => {
        await tx.run(
            `DELETE FROM survey_answers WHERE response_id IN (
                SELECT id FROM survey_responses WHERE survey_id = ?
             )`,
            [surveyId]
        );
        await tx.run('DELETE FROM survey_responses WHERE survey_id = ?', [surveyId]);
        await tx.run('DELETE FROM survey_questions WHERE survey_id = ?', [surveyId]);
        await tx.run('DELETE FROM surveys WHERE id = ?', [surveyId]);
    }),
    listExportRows: surveyId => db.all(
        `SELECT s.title AS survey_title, r.id AS response_id, r.submitted_at,
                u.name, u.department, u.position, q.question_text, q.question_type, a.answer_value
         FROM survey_answers a
         JOIN survey_responses r ON r.id = a.response_id
         JOIN surveys s ON s.id = r.survey_id
         JOIN survey_questions q ON q.id = a.question_id
         JOIN users u ON u.id = r.user_id
         WHERE r.survey_id = ?
         ORDER BY r.submitted_at DESC, q.order_index ASC, q.id ASC`,
        [surveyId]
    ),
    listResultRespondents: async (surveyId, query, pagination, sortColumn, sortDirection) => {
        const { where, params } = buildResultFilter(surveyId, query.search);
        const total = await db.get(
            `SELECT COUNT(*) AS count FROM survey_responses r
             JOIN users u ON u.id = r.user_id ${where}`,
            params
        );
        const rows = await db.all(
            `WITH ranked_responses AS (
                SELECT r.id AS response_id, r.submitted_at, u.name, u.department, u.position,
                       ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}, r.id DESC) AS row_num
                FROM survey_responses r JOIN users u ON u.id = r.user_id ${where}
             )
             SELECT response_id, submitted_at, name, department, position
             FROM ranked_responses WHERE row_num BETWEEN ? AND ? ORDER BY row_num`,
            [...params, pagination.startRow, pagination.endRow]
        );
        return { count: total?.count || 0, rows };
    },
    listAnswersForResponses: responseIds => responseIds.length ? db.all(
        `SELECT a.response_id, a.question_id, a.answer_value,
                r.submitted_at, u.name, u.department, u.position
         FROM survey_answers a
         JOIN survey_responses r ON r.id = a.response_id
         JOIN users u ON u.id = r.user_id
         WHERE a.response_id IN (${responseIds.map(() => '?').join(', ')})
         ORDER BY r.submitted_at DESC, a.question_id ASC`,
        responseIds
    ) : [],
    listAggregateAnswers: (surveyId, search) => {
        const { where, params } = buildResultFilter(surveyId, search);
        return db.all(
            `SELECT a.question_id, a.answer_value
             FROM survey_answers a
             JOIN survey_responses r ON r.id = a.response_id
             JOIN survey_questions q ON q.id = a.question_id
             JOIN users u ON u.id = r.user_id
             ${where} AND q.question_type <> 'text'`,
            params
        );
    }
});

const buildAdminSurveyFilter = query => {
    const clauses = [];
    const params = [];
    if (query.status) { clauses.push('s.status = ?'); params.push(query.status); }
    if (query.search) {
        const pattern = `%${query.search}%`;
        clauses.push('(s.title LIKE ? OR s.description LIKE ?)');
        params.push(pattern, pattern);
    }
    return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
};

const buildResultFilter = (surveyId, search) => {
    const clauses = ['r.survey_id = ?'];
    const params = [surveyId];
    if (search) {
        const pattern = `%${search}%`;
        clauses.push('(u.name LIKE ? OR u.department LIKE ? OR u.position LIKE ?)');
        params.push(pattern, pattern, pattern);
    }
    return { where: `WHERE ${clauses.join(' AND ')}`, params };
};

module.exports = { createSurveyRepository };
