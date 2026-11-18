const convertPlaceholders = (sql) => {
    let index = 0;
    let quote = null;
    let converted = '';

    for (let cursor = 0; cursor < sql.length; cursor += 1) {
        const character = sql[cursor];
        const next = sql[cursor + 1];

        if (quote) {
            converted += character;
            if (character === quote) {
                if (next === quote) {
                    converted += next;
                    cursor += 1;
                } else {
                    quote = null;
                }
            }
            continue;
        }

        if (character === "'" || character === '"') {
            quote = character;
            converted += character;
            continue;
        }

        if (character === '?') {
            index += 1;
            converted += `$${index}`;
            continue;
        }

        converted += character;
    }

    return converted;
};

const normalizeSchemaSql = (sql) => sql
    .replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
    .replace(/\bDATETIME\b/gi, 'TIMESTAMPTZ');

class PostgresAdapter {
    constructor(pool, client = null) {
        this.pool = pool;
        this.client = client;
    }

    executor() {
        return this.client || this.pool;
    }

    async exec(sql) {
        return this.executor().query(normalizeSchemaSql(sql));
    }

    async transaction(work) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await work(new PostgresAdapter(this.pool, client));
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async close() {
        if (!this.client) await this.pool.end();
    }

    async get(sql, params = []) {
        const result = await this.query(sql, params);
        return result.rows[0];
    }

    async all(sql, params = []) {
        const result = await this.query(sql, params);
        return result.rows;
    }

    async run(sql, params = []) {
        const isInsert = /^\s*INSERT\b/i.test(sql);
        const hasReturning = /\bRETURNING\b/i.test(sql);
        const statement = isInsert && !hasReturning
            ? `${sql.trim().replace(/;$/, '')} RETURNING *`
            : sql;
        const result = await this.query(statement, params);
        return {
            lastID: result.rows?.[0]?.id ?? null,
            changes: result.rowCount ?? 0
        };
    }

    query(sql, params = []) {
        return this.executor().query(convertPlaceholders(sql), params);
    }
}

module.exports = {
    PostgresAdapter,
    convertPlaceholders,
    normalizeSchemaSql
};
