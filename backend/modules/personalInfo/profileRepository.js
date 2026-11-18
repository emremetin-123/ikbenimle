const PROFILE_COLUMNS = `
    u.id, u.employee_id, u.name, u.department, u.position, u.role,
    p.phone, p.address, p.emergency_contact_name, p.emergency_contact_phone,
    p.blood_type, p.birth_date, p.email, p.clothing_top, p.clothing_bottom,
    p.shoe_size, p.education, p.hobbies, p.skills, p.photo_path
`;

const createProfileRepository = db => ({
    getProfile: userId => db.get(
        `SELECT ${PROFILE_COLUMNS}
         FROM users u
         LEFT JOIN personal_info p ON u.id = p.user_id
         WHERE u.id = ?`,
        [userId]
    ),
    listEducation: userId => db.all(
        `SELECT id, school, department, start_year, end_year, is_current
         FROM profile_education_entries
         WHERE user_id = ?
         ORDER BY order_index, id`,
        [userId]
    ),
    listInterests: (userId, kind) => db.all(
        `SELECT id, label
         FROM profile_interests
         WHERE user_id = ? AND kind = ?
         ORDER BY order_index, id`,
        [userId, kind]
    ),
    saveProfile: (userId, profile) => db.transaction(async (tx) => {
        const values = [
            profile.phone, profile.address, profile.emergency_contact_name,
            profile.emergency_contact_phone, profile.blood_type, profile.birth_date,
            profile.email, profile.clothing_top, profile.clothing_bottom,
            profile.shoe_size, profile.education, profile.hobbies, profile.skills
        ];
        const result = await tx.run(
            `UPDATE personal_info SET
                phone = ?, address = ?, emergency_contact_name = ?,
                emergency_contact_phone = ?, blood_type = ?, birth_date = ?,
                email = ?, clothing_top = ?, clothing_bottom = ?, shoe_size = ?,
                education = ?, hobbies = ?, skills = ?
             WHERE user_id = ?`,
            [...values, userId]
        );
        if (!result.changes) {
            await tx.run(
                `INSERT INTO personal_info (
                    user_id, phone, address, emergency_contact_name,
                    emergency_contact_phone, blood_type, birth_date, email,
                    clothing_top, clothing_bottom, shoe_size, education, hobbies, skills
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [userId, ...values]
            );
        }

        if (profile.education_entries) {
            await tx.run('DELETE FROM profile_education_entries WHERE user_id = ?', [userId]);
            for (const [index, entry] of profile.education_entries.entries()) {
                await tx.run(
                    `INSERT INTO profile_education_entries
                        (user_id, school, department, start_year, end_year, is_current, order_index)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        userId, entry.school, entry.department,
                        entry.start_year, entry.is_current ? null : entry.end_year,
                        entry.is_current ? 1 : 0, index
                    ]
                );
            }
        }

        for (const [field, kind] of [['skill_tags', 'skill'], ['hobby_tags', 'hobby']]) {
            if (!profile[field]) continue;
            await tx.run('DELETE FROM profile_interests WHERE user_id = ? AND kind = ?', [userId, kind]);
            const uniqueLabels = [...new Set(profile[field].map(label => label.trim()).filter(Boolean))];
            for (const [index, label] of uniqueLabels.entries()) {
                await tx.run(
                    `INSERT INTO profile_interests (user_id, kind, label, order_index)
                     VALUES (?, ?, ?, ?)`,
                    [userId, kind, label, index]
                );
            }
        }
    }),
    getPhoto: userId => db.get(
        'SELECT photo_path, photo_public_id FROM personal_info WHERE user_id = ?',
        [userId]
    ),
    savePhoto: (userId, photoPath, photoPublicId) => db.transaction(async (tx) => {
        const result = await tx.run(
            'UPDATE personal_info SET photo_path = ?, photo_public_id = ? WHERE user_id = ?',
            [photoPath, photoPublicId, userId]
        );
        if (!result.changes) {
            await tx.run(
                'INSERT INTO personal_info(user_id, photo_path, photo_public_id) VALUES(?, ?, ?)',
                [userId, photoPath, photoPublicId]
            );
        }
    })
});

module.exports = { createProfileRepository };
