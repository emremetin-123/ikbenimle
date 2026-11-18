const USER_COLUMNS = `
    u.id, u.employee_id, u.name, u.department, u.position, u.manager_id,
    u.status, u.role, u.permissions, m.name AS manager_name,
    p.phone, p.address, p.emergency_contact_name, p.emergency_contact_phone,
    p.blood_type, p.birth_date, p.email, p.clothing_top, p.clothing_bottom,
    p.shoe_size, p.photo_path
`;

const buildFilter = ({ search, department, status }) => {
    const clauses = [];
    const params = [];

    if (search) {
        const pattern = `%${search}%`;
        clauses.push('(u.name LIKE ? OR u.employee_id LIKE ? OR u.position LIKE ?)');
        params.push(pattern, pattern, pattern);
    }
    if (department) {
        clauses.push('u.department = ?');
        params.push(department);
    }
    if (status) {
        clauses.push("COALESCE(u.status, 'active') = ?");
        params.push(status);
    }

    return {
        sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
        params
    };
};

const SORT_COLUMNS = {
    name: 'u.name',
    employee_id: 'u.employee_id',
    department: 'u.department',
    position: 'u.position'
};

const createUserRepository = (db) => ({
    async list(filters = {}, pagination) {
        const where = buildFilter(filters);
        const sortColumn = SORT_COLUMNS[filters.sort] || SORT_COLUMNS.name;
        const sortDirection = filters.order === 'desc' ? 'DESC' : 'ASC';
        const fromSql = `
            FROM users u
            LEFT JOIN users m ON u.manager_id = m.id
            LEFT JOIN personal_info p ON u.id = p.user_id
            ${where.sql}
        `;

        const totalRow = await db.get(
            `SELECT COUNT(*) AS total ${fromSql}`,
            where.params
        );
        const items = await db.all(
            `WITH ranked_users AS (
                SELECT ${USER_COLUMNS},
                       ROW_NUMBER() OVER (ORDER BY ${sortColumn} ${sortDirection}, u.id ASC) AS row_num
                ${fromSql}
             )
             SELECT id, employee_id, name, department, position, manager_id,
                    status, role, permissions, manager_name, phone, address,
                    emergency_contact_name, emergency_contact_phone, blood_type,
                    birth_date, email, clothing_top, clothing_bottom, shoe_size,
                    photo_path
             FROM ranked_users
             WHERE row_num BETWEEN ? AND ?
             ORDER BY row_num`,
            [...where.params, pagination.startRow, pagination.endRow]
        );
        return {
            items,
            total: Number(totalRow?.total || 0)
        };
    },

    async listOptions(pagination, search) {
        const params = [];
        const clauses = ["COALESCE(status, 'active') = 'active'"];
        if (search) {
            const pattern = `%${search}%`;
            clauses.push('(name LIKE ? OR employee_id LIKE ? OR department LIKE ? OR position LIKE ?)');
            params.push(pattern, pattern, pattern, pattern);
        }
        const where = `WHERE ${clauses.join(' AND ')}`;
        const total = await db.get(`SELECT COUNT(*) AS total FROM users ${where}`, params);
        const items = await db.all(
            `WITH ranked_options AS (
                SELECT id, employee_id, name, department, position, manager_id, status,
                       ROW_NUMBER() OVER (ORDER BY name, employee_id, id) AS row_num
                 FROM users
                 ${where}
             )
             SELECT id, employee_id, name, department, position, manager_id, status
             FROM ranked_options
             WHERE row_num BETWEEN ? AND ?
             ORDER BY row_num`,
            [...params, pagination.startRow, pagination.endRow]
        );
        return { items, total: Number(total?.total || 0) };
    },

    async listFormOptions() {
        const [departments, positions] = await Promise.all([
            db.all(`SELECT DISTINCT department AS value FROM users
                    WHERE department IS NOT NULL AND department <> '' ORDER BY department`),
            db.all(`SELECT DISTINCT position AS value FROM users
                    WHERE position IS NOT NULL AND position <> '' ORDER BY position`)
        ]);
        return {
            departments: departments.map(item => item.value),
            positions: positions.map(item => item.value)
        };
    }
});

module.exports = {
    createUserRepository
};
