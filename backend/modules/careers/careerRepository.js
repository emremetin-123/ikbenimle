const JOB_COLUMNS = `
    j.id, j.title, j.image_url, j.publish_date, j.deadline_date,
    j.position_type, j.location, j.manager_name, j.work_model,
    j.job_description, j.qualifications, j.prerequisites,
    j.additional_notes, j.status, j.created_at, j.created_by
`;
const JOB_OUTPUT_COLUMNS = `
    id, title, image_url, publish_date, deadline_date,
    position_type, location, manager_name, work_model,
    job_description, qualifications, prerequisites,
    additional_notes, status, created_at, created_by
`;

function createCareerRepository(db) {
    return {
        async listJobs({ query, pagination, activeOnly, includeCounts }) {
            const clauses = [];
            const params = [];
            if (activeOnly) clauses.push("j.status = 'active'");
            else if (query.status) {
                clauses.push('j.status = ?');
                params.push(query.status);
            }
            if (query.search) {
                const pattern = `%${query.search}%`;
                clauses.push(`(
                    j.title LIKE ? OR j.position_type LIKE ? OR
                    j.location LIKE ? OR j.job_description LIKE ?
                )`);
                params.push(pattern, pattern, pattern, pattern);
            }
            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const sortColumns = {
                created_at: 'j.created_at',
                title: 'j.title',
                deadline_date: 'j.deadline_date'
            };
            const sortColumn = sortColumns[query.sort] || sortColumns.created_at;
            const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
            const total = await db.get(
                `SELECT COUNT(*) AS total FROM job_postings j ${whereSql}`,
                params
            );
            const countJoin = includeCounts
                ? `LEFT JOIN (
                    SELECT job_id, COUNT(*) AS application_count
                    FROM job_applications GROUP BY job_id
                ) ac ON ac.job_id = j.id`
                : '';
            const countSelect = includeCounts
                ? ', COALESCE(ac.application_count, 0) AS application_count'
                : '';
            const items = await db.all(`
                WITH ranked_jobs AS (
                    SELECT ${JOB_COLUMNS} ${countSelect},
                        ROW_NUMBER() OVER (
                            ORDER BY ${sortColumn} ${sortDirection}, j.id DESC
                        ) AS row_num
                    FROM job_postings j ${countJoin} ${whereSql}
                )
                SELECT ${JOB_OUTPUT_COLUMNS}
                    ${includeCounts ? ', application_count' : ''}
                FROM ranked_jobs
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow]);
            return { items, total: total?.total || 0 };
        },
        findActiveJob(id) {
            return db.get(
                `SELECT ${JOB_COLUMNS} FROM job_postings j WHERE j.id = ? AND j.status = ?`,
                [id, 'active']
            );
        },
        findApplication(jobId, userId) {
            return db.get(
                'SELECT id FROM job_applications WHERE job_id = ? AND user_id = ?',
                [jobId, userId]
            );
        },
        createApplication(jobId, userId) {
            return db.run(
                'INSERT INTO job_applications (job_id, user_id, status) VALUES (?, ?, ?)',
                [jobId, userId, 'pending']
            );
        },
        async listMyApplications({ userId, query, pagination }) {
            const clauses = ['a.user_id = ?'];
            const params = [userId];
            if (query.status) {
                clauses.push('a.status = ?');
                params.push(query.status);
            }
            if (query.search) {
                const pattern = `%${query.search}%`;
                clauses.push('(j.title LIKE ? OR j.location LIKE ? OR j.position_type LIKE ?)');
                params.push(pattern, pattern, pattern);
            }
            const whereSql = `WHERE ${clauses.join(' AND ')}`;
            const sortColumn = query.sort === 'title' ? 'j.title' : 'a.applied_at';
            const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
            const total = await db.get(`
                SELECT COUNT(*) AS total FROM job_applications a
                JOIN job_postings j ON j.id = a.job_id ${whereSql}
            `, params);
            const items = await db.all(`
                WITH ranked_applications AS (
                    SELECT a.id, a.job_id, a.user_id, a.status, a.applied_at,
                           j.title, j.location, j.position_type,
                           ROW_NUMBER() OVER (
                               ORDER BY ${sortColumn} ${sortDirection}, a.id DESC
                           ) AS row_num
                    FROM job_applications a
                    JOIN job_postings j ON j.id = a.job_id ${whereSql}
                )
                SELECT id, job_id, user_id, status, applied_at,
                       title, location, position_type
                FROM ranked_applications
                WHERE row_num BETWEEN ? AND ? ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow]);
            return { items, total: total?.total || 0 };
        },
        createJob(body, userId) {
            return db.run(`
                INSERT INTO job_postings (
                    title, image_url, publish_date, deadline_date, position_type,
                    location, manager_name, work_model, job_description,
                    qualifications, prerequisites, additional_notes, status, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                body.title, body.image_url, body.publish_date, body.deadline_date,
                body.position_type, body.location, body.manager_name, body.work_model,
                body.job_description, body.qualifications, body.prerequisites,
                body.additional_notes, body.status, userId
            ]);
        },
        updateJob(id, body) {
            return db.run(`
                UPDATE job_postings SET
                    title = ?, image_url = ?, publish_date = ?, deadline_date = ?,
                    position_type = ?, location = ?, manager_name = ?, work_model = ?,
                    job_description = ?, qualifications = ?, prerequisites = ?,
                    additional_notes = ?, status = ?
                WHERE id = ?
            `, [
                body.title, body.image_url, body.publish_date, body.deadline_date,
                body.position_type, body.location, body.manager_name, body.work_model,
                body.job_description, body.qualifications, body.prerequisites,
                body.additional_notes, body.status, id
            ]);
        },
        deleteJob(id) {
            return db.transaction(async (tx) => {
                const job = await tx.get('SELECT id FROM job_postings WHERE id = ?', [id]);
                if (!job) return false;
                await tx.run('DELETE FROM job_applications WHERE job_id = ?', [id]);
                await tx.run('DELETE FROM job_postings WHERE id = ?', [id]);
                return true;
            });
        },
        async listApplications({ jobId, query, pagination }) {
            const clauses = ['a.job_id = ?'];
            const params = [jobId];
            if (query.status) {
                clauses.push('a.status = ?');
                params.push(query.status);
            }
            if (query.search) {
                const pattern = `%${query.search}%`;
                clauses.push(`(
                    u.name LIKE ? OR u.employee_id LIKE ? OR
                    u.department LIKE ? OR u.position LIKE ?
                )`);
                params.push(pattern, pattern, pattern, pattern);
            }
            const whereSql = `WHERE ${clauses.join(' AND ')}`;
            const sortColumn = query.sort === 'name' ? 'u.name' : 'a.applied_at';
            const sortDirection = query.order === 'asc' ? 'ASC' : 'DESC';
            const total = await db.get(`
                SELECT COUNT(*) AS total FROM job_applications a
                JOIN users u ON u.id = a.user_id ${whereSql}
            `, params);
            const items = await db.all(`
                WITH ranked_applications AS (
                    SELECT a.id, a.job_id, a.user_id, a.status, a.applied_at,
                           u.name, u.employee_id, u.department, u.position,
                           p.phone, p.email,
                           ROW_NUMBER() OVER (
                               ORDER BY ${sortColumn} ${sortDirection}, a.id DESC
                           ) AS row_num
                    FROM job_applications a
                    JOIN users u ON u.id = a.user_id
                    LEFT JOIN personal_info p ON p.user_id = u.id
                    ${whereSql}
                )
                SELECT id, job_id, user_id, status, applied_at, name,
                       employee_id, department, position, phone, email
                FROM ranked_applications
                WHERE row_num BETWEEN ? AND ? ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow]);
            return { items, total: total?.total || 0 };
        },
        updateApplicationStatus(id, status) {
            return db.run(
                'UPDATE job_applications SET status = ? WHERE id = ?',
                [status, id]
            );
        }
    };
}

module.exports = { createCareerRepository };
