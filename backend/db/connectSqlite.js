const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('node:path');
const { instrumentDatabase } = require('./monitoredDatabase');

async function connectSqlite() {
    const sqliteFilename = process.env.SQLITE_FILENAME
        || path.join(__dirname, '..', 'database.sqlite');
    const db = await open({
        filename: sqliteFilename,
        driver: sqlite3.Database
    });
    await db.exec('PRAGMA foreign_keys = ON');
    await db.exec('PRAGMA journal_mode = WAL');
    await db.exec('PRAGMA busy_timeout = 5000');

    let transactionQueue = Promise.resolve();
    const executeTransaction = async (work) => {
        await db.exec('BEGIN IMMEDIATE');
        try {
            const result = await work(db);
            await db.exec('COMMIT');
            return result;
        } catch (error) {
            await db.exec('ROLLBACK');
            throw error;
        }
    };
    // A single SQLite connection cannot begin two transactions concurrently.
    db.transaction = (work) => {
        const result = transactionQueue.then(() => executeTransaction(work));
        transactionQueue = result.catch(() => undefined);
        return result;
    };

    console.log('Local SQLite database connected.');
    return instrumentDatabase(db);
}

module.exports = { connectSqlite };
