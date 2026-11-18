const SORT_COLUMNS = {
    name: 'r.name',
    created_at: 'r.created_at',
    updated_at: 'r.updated_at'
};

const insertStops = async (db, routeId, stops) => {
    for (let index = 0; index < stops.length; index += 1) {
        const stop = stops[index];
        await db.run(`
            INSERT INTO service_route_stops (
                route_id, name, arrival_time, latitude, longitude, order_index
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [routeId, stop.name, stop.arrival_time, stop.latitude, stop.longitude, index]);
    }
};

function createServiceRouteRepository(db) {
    return {
        async list({ query, pagination, employeeView }) {
            const clauses = [];
            const params = [];
            if (employeeView || query.status === 'active') {
                clauses.push('COALESCE(r.is_active, 1) = 1');
            } else if (query.status === 'inactive') {
                clauses.push('COALESCE(r.is_active, 1) = 0');
            }
            if (query.search) {
                const pattern = `%${query.search}%`;
                clauses.push(`(
                    r.name LIKE ? OR r.direction LIKE ? OR r.plate LIKE ? OR
                    r.driver_name LIKE ? OR EXISTS (
                        SELECT 1 FROM service_route_stops search_stop
                        WHERE search_stop.route_id = r.id AND search_stop.name LIKE ?
                    )
                )`);
                params.push(pattern, pattern, pattern, pattern, pattern);
            }
            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const sortColumn = SORT_COLUMNS[query.sort] || SORT_COLUMNS.name;
            const sortDirection = query.order === 'desc' ? 'DESC' : 'ASC';
            const total = await db.get(
                `SELECT COUNT(*) AS total FROM service_routes r ${whereSql}`,
                params
            );
            const routes = await db.all(`
                WITH ranked_routes AS (
                    SELECT
                        r.id, r.name, r.direction, r.plate, r.driver_name,
                        r.driver_phone, r.notes, r.color, r.is_active,
                        r.created_at, r.updated_at,
                        ROW_NUMBER() OVER (
                            ORDER BY ${sortColumn} ${sortDirection}, r.id ASC
                        ) AS row_num
                    FROM service_routes r
                    ${whereSql}
                )
                SELECT id, name, direction, plate, driver_name, driver_phone,
                       notes, color, is_active, created_at, updated_at
                FROM ranked_routes
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow]);
            if (!routes.length) return { routes, stops: [], total: total?.total || 0 };
            const routeIds = routes.map(route => Number(route.id));
            const placeholders = routeIds.map(() => '?').join(', ');
            const stops = await db.all(`
                SELECT id, route_id, name, arrival_time, latitude, longitude, order_index
                FROM service_route_stops
                WHERE route_id IN (${placeholders})
                ORDER BY route_id ASC, order_index ASC, id ASC
            `, routeIds);
            return { routes, stops, total: total?.total || 0 };
        },
        create(body, userId) {
            return db.transaction(async (tx) => {
                const result = await tx.run(`
                    INSERT INTO service_routes (
                        name, direction, plate, driver_name, driver_phone,
                        notes, color, is_active, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    body.name, body.direction, body.plate, body.driver_name,
                    body.driver_phone, body.notes, body.color,
                    body.is_active ? 1 : 0, userId
                ]);
                await insertStops(tx, result.lastID, body.stops);
                return result.lastID;
            });
        },
        update(id, body) {
            return db.transaction(async (tx) => {
                const result = await tx.run(`
                    UPDATE service_routes
                    SET name = ?, direction = ?, plate = ?, driver_name = ?,
                        driver_phone = ?, notes = ?, color = ?, is_active = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    body.name, body.direction, body.plate, body.driver_name,
                    body.driver_phone, body.notes, body.color,
                    body.is_active ? 1 : 0, id
                ]);
                if (!result.changes) return false;
                await tx.run('DELETE FROM service_route_stops WHERE route_id = ?', [id]);
                await insertStops(tx, id, body.stops);
                return true;
            });
        },
        remove(id) {
            return db.transaction(async (tx) => {
                const route = await tx.get('SELECT id FROM service_routes WHERE id = ?', [id]);
                if (!route) return false;
                await tx.run('DELETE FROM service_route_stops WHERE route_id = ?', [id]);
                await tx.run('DELETE FROM service_routes WHERE id = ?', [id]);
                return true;
            });
        }
    };
}

module.exports = { createServiceRouteRepository };
