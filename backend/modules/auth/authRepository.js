function createAuthRepository(db) {
    return {
        findByEmployeeId(employeeId) {
            return db.get(`
                SELECT u.*, p.photo_path
                FROM users u
                LEFT JOIN personal_info p ON u.id = p.user_id
                WHERE u.employee_id = ?
            `, [employeeId]);
        }
    };
}

module.exports = { createAuthRepository };
