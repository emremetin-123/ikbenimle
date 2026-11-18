module.exports = [
    {
        version: '009_leave_directory_query_indexes',
        async up(db) {
            await db.exec(`
                CREATE INDEX IF NOT EXISTS idx_leave_user_created
                    ON leave_requests(user_id, created_at, id);
                CREATE INDEX IF NOT EXISTS idx_leave_status_created
                    ON leave_requests(status, created_at, id);
                CREATE INDEX IF NOT EXISTS idx_users_directory_name
                    ON users(status, name, id);
            `);
        },
        async down(db) {
            for (const [index] of [
                ['idx_leave_user_created', 'leave_requests'],
                ['idx_leave_status_created', 'leave_requests'],
                ['idx_users_directory_name', 'users']
            ]) {
                await db.exec(`DROP INDEX IF EXISTS ${index};`);
            }
        }
    },
    {
        version: '010_knowledge_service_route_indexes',
        async up(db) {
            await db.exec(`
                CREATE INDEX IF NOT EXISTS idx_knowledge_categories_order
                    ON knowledge_categories(order_index, name, id);
                CREATE INDEX IF NOT EXISTS idx_knowledge_items_category_order
                    ON knowledge_items(category_id, order_index, id);
                CREATE INDEX IF NOT EXISTS idx_service_routes_active_name
                    ON service_routes(is_active, name, id);
                CREATE INDEX IF NOT EXISTS idx_service_stops_route_order
                    ON service_route_stops(route_id, order_index, id);
            `);
        },
        async down(db) {
            for (const [index] of [
                ['idx_knowledge_categories_order', 'knowledge_categories'],
                ['idx_knowledge_items_category_order', 'knowledge_items'],
                ['idx_service_routes_active_name', 'service_routes'],
                ['idx_service_stops_route_order', 'service_route_stops']
            ]) {
                await db.exec(`DROP INDEX IF EXISTS ${index};`);
            }
        }
    },
];
