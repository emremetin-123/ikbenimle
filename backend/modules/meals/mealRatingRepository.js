const { formatMealDate } = require('./menuParser');

const getRatingSummary = async (db, startDate, endDate) => {
    const rows = await db.all(
        `
        SELECT
            meal_date,
            COUNT(*) as response_count,
            AVG(CAST(food_score AS FLOAT)) as avg_food_score,
            AVG(CAST(staff_score AS FLOAT)) as avg_staff_score,
            AVG(CAST(cleanliness_score AS FLOAT)) as avg_cleanliness_score
        FROM meal_menu_ratings
        WHERE meal_date >= ? AND meal_date < ?
        GROUP BY meal_date
        ORDER BY meal_date ASC
        `,
        [startDate, endDate]
    );

    return rows.map(row => {
        const responseCount = Number(row.response_count ?? row.RESPONSE_COUNT ?? 0);
        const avgFood = Number(row.avg_food_score ?? row.AVG_FOOD_SCORE ?? 0);
        const avgStaff = Number(row.avg_staff_score ?? row.AVG_STAFF_SCORE ?? 0);
        const avgCleanliness = Number(row.avg_cleanliness_score ?? row.AVG_CLEANLINESS_SCORE ?? 0);
        return {
            meal_date: formatMealDate(row.meal_date ?? row.MEAL_DATE),
            response_count: responseCount,
            avg_food_score: Number(avgFood.toFixed(2)),
            avg_staff_score: Number(avgStaff.toFixed(2)),
            avg_cleanliness_score: Number(avgCleanliness.toFixed(2)),
            avg_total_score: Number(((avgFood + avgStaff + avgCleanliness) / 3).toFixed(2))
        };
    });
};

const getRatingOverall = async (db, startDate, endDate) => {
    const row = await db.get(
        `
        SELECT
            COUNT(*) AS response_count,
            AVG(CAST(food_score AS FLOAT)) AS avg_food_score,
            AVG(CAST(staff_score AS FLOAT)) AS avg_staff_score,
            AVG(CAST(cleanliness_score AS FLOAT)) AS avg_cleanliness_score
        FROM meal_menu_ratings
        WHERE meal_date >= ? AND meal_date < ?
        `,
        [startDate, endDate]
    );
    const responseCount = Number(row?.response_count || 0);
    const food = Number(row?.avg_food_score || 0);
    const staff = Number(row?.avg_staff_score || 0);
    const cleanliness = Number(row?.avg_cleanliness_score || 0);
    return {
        response_count: responseCount,
        avg_food_score: Number(food.toFixed(2)),
        avg_staff_score: Number(staff.toFixed(2)),
        avg_cleanliness_score: Number(cleanliness.toFixed(2)),
        avg_total_score: Number(((food + staff + cleanliness) / 3).toFixed(2))
    };
};

const ratingRowColumns = `
    r.id, r.meal_date, r.food_score, r.staff_score, r.cleanliness_score,
    r.comment, r.department, r.position, r.created_at, r.updated_at,
    u.name, u.employee_id
`;

const normalizeRatingRow = row => ({
    ...row,
    meal_date: formatMealDate(row.meal_date),
    avg_total_score: Number((
        (Number(row.food_score) + Number(row.staff_score) + Number(row.cleanliness_score)) / 3
    ).toFixed(2))
});

const getRatingRows = async (db, startDate, endDate, options = {}) => {
    const clauses = ['r.meal_date >= ?', 'r.meal_date < ?'];
    const params = [startDate, endDate];
    if (options.date) {
        clauses.push('r.meal_date = ?');
        params.push(options.date);
    }
    const whereSql = `WHERE ${clauses.join(' AND ')}`;

    if (options.pagination) {
        const rows = await db.all(
            `
            WITH ranked_ratings AS (
                SELECT ${ratingRowColumns},
                    ROW_NUMBER() OVER (ORDER BY r.created_at DESC, r.id DESC) AS row_num
                FROM meal_menu_ratings r
                LEFT JOIN users u ON u.id = r.user_id
                ${whereSql}
            )
            SELECT
                id, meal_date, food_score, staff_score, cleanliness_score,
                comment, department, position, created_at, updated_at,
                name, employee_id
            FROM ranked_ratings
            WHERE row_num BETWEEN ? AND ?
            ORDER BY row_num
            `,
            [...params, options.pagination.startRow, options.pagination.endRow]
        );
        return rows.map(normalizeRatingRow);
    }

    const rows = await db.all(
        `
        SELECT ${ratingRowColumns}
        FROM meal_menu_ratings r
        LEFT JOIN users u ON u.id = r.user_id
        ${whereSql}
        ORDER BY r.meal_date DESC, r.created_at DESC
        `,
        params
    );
    return rows.map(normalizeRatingRow);
};

module.exports = {
    normalizeRatingRow,
    getRatingSummary,
    getRatingOverall,
    getRatingRows
};
