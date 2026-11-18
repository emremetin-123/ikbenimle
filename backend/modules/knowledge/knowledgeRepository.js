function createKnowledgeRepository(db) {
    return {
        findCategory(id, executor = db) {
            return executor.get(
                'SELECT id, name, order_index FROM knowledge_categories WHERE id = ?',
                [id]
            );
        },

        async listCategories({ query, pagination }) {
            const clauses = [];
            const whereParams = [];
            let matchCountSelect = '0 AS matched_item_count';
            const matchCountParams = [];
            if (query.search) {
                const pattern = `%${query.search}%`;
                clauses.push(`(
                    c.name LIKE ? OR EXISTS (
                        SELECT 1 FROM knowledge_items search_item
                        WHERE search_item.category_id = c.id
                          AND (
                            search_item.sub_category LIKE ? OR
                            search_item.question LIKE ? OR
                            search_item.answer LIKE ?
                          )
                    )
                )`);
                whereParams.push(pattern, pattern, pattern, pattern);
                matchCountSelect = `(
                    SELECT COUNT(*) FROM knowledge_items matched_item
                    WHERE matched_item.category_id = c.id
                      AND (
                        matched_item.sub_category LIKE ? OR
                        matched_item.question LIKE ? OR
                        matched_item.answer LIKE ?
                      )
                ) AS matched_item_count`;
                matchCountParams.push(pattern, pattern, pattern);
            }
            const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
            const sortColumn = query.sort === 'name' ? 'c.name' : 'c.order_index';
            const sortDirection = query.order === 'desc' ? 'DESC' : 'ASC';
            const total = await db.get(
                `SELECT COUNT(*) AS total FROM knowledge_categories c ${whereSql}`,
                whereParams
            );
            const items = await db.all(`
                WITH ranked_categories AS (
                    SELECT
                        c.id, c.name, c.order_index,
                        (
                            SELECT COUNT(*) FROM knowledge_items item_count
                            WHERE item_count.category_id = c.id
                        ) AS item_count,
                        ${matchCountSelect},
                        ROW_NUMBER() OVER (
                            ORDER BY ${sortColumn} ${sortDirection}, c.id ASC
                        ) AS row_num
                    FROM knowledge_categories c
                    ${whereSql}
                )
                SELECT id, name, order_index, item_count, matched_item_count
                FROM ranked_categories
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [
                ...matchCountParams,
                ...whereParams,
                pagination.startRow,
                pagination.endRow
            ]);
            return { items, total: total?.total || 0 };
        },

        listSubCategories(categoryId) {
            return db.all(`
                SELECT DISTINCT sub_category
                FROM knowledge_items
                WHERE category_id = ?
                  AND sub_category IS NOT NULL
                  AND sub_category <> ''
                ORDER BY sub_category ASC
            `, [categoryId]);
        },

        async listItems({ categoryId, query, pagination }) {
            const clauses = ['i.category_id = ?'];
            const params = [categoryId];
            if (query.search) {
                const pattern = `%${query.search}%`;
                clauses.push(`(
                    i.sub_category LIKE ? OR i.question LIKE ? OR i.answer LIKE ? OR
                    EXISTS (
                        SELECT 1 FROM knowledge_categories search_category
                        WHERE search_category.id = i.category_id
                          AND search_category.name LIKE ?
                    )
                )`);
                params.push(pattern, pattern, pattern, pattern);
            }
            if (query.subCategory) {
                clauses.push('i.sub_category = ?');
                params.push(query.subCategory);
            }
            if (query.featured === 'featured') clauses.push('COALESCE(i.is_featured, 0) = 1');
            const whereSql = `WHERE ${clauses.join(' AND ')}`;
            const sortColumn = query.sort === 'question' ? 'i.question' : 'i.order_index';
            const sortDirection = query.order === 'desc' ? 'DESC' : 'ASC';
            const total = await db.get(
                `SELECT COUNT(*) AS total FROM knowledge_items i ${whereSql}`,
                params
            );
            const items = await db.all(`
                WITH ranked_items AS (
                    SELECT
                        i.id, i.category_id, i.sub_category, i.question, i.answer,
                        i.is_featured, i.order_index,
                        ROW_NUMBER() OVER (
                            ORDER BY ${sortColumn} ${sortDirection}, i.id ASC
                        ) AS row_num
                    FROM knowledge_items i
                    ${whereSql}
                )
                SELECT
                    id, category_id, sub_category, question, answer,
                    is_featured, order_index
                FROM ranked_items
                WHERE row_num BETWEEN ? AND ?
                ORDER BY row_num
            `, [...params, pagination.startRow, pagination.endRow]);
            return { items, total: total?.total || 0 };
        },

        createCategory(body) {
            return db.run(
                'INSERT INTO knowledge_categories (name, order_index) VALUES (?, ?)',
                [body.name, body.order_index]
            );
        },
        updateCategory(id, body) {
            return db.run(
                'UPDATE knowledge_categories SET name = ?, order_index = ? WHERE id = ?',
                [body.name, body.order_index, id]
            );
        },
        deleteCategory(id) {
            return db.transaction(async (tx) => {
                await tx.run('DELETE FROM knowledge_items WHERE category_id = ?', [id]);
                return tx.run('DELETE FROM knowledge_categories WHERE id = ?', [id]);
            });
        },
        createItem(body) {
            return db.run(`
                INSERT INTO knowledge_items (
                    category_id, sub_category, question, answer,
                    is_featured, order_index
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                body.category_id,
                body.sub_category,
                body.question,
                body.answer,
                body.is_featured ? 1 : 0,
                body.order_index
            ]);
        },
        updateItem(id, body) {
            return db.run(`
                UPDATE knowledge_items
                SET category_id = ?, sub_category = ?, question = ?,
                    answer = ?, is_featured = ?, order_index = ?
                WHERE id = ?
            `, [
                body.category_id,
                body.sub_category,
                body.question,
                body.answer,
                body.is_featured ? 1 : 0,
                body.order_index,
                id
            ]);
        },
        deleteItem(id) {
            return db.run('DELETE FROM knowledge_items WHERE id = ?', [id]);
        }
    };
}

module.exports = { createKnowledgeRepository };
