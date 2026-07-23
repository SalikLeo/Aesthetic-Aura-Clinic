const originalDb = window.electron.db;

const db = {
    ...originalDb,
    run: async (sql, params) => {
        const result = await originalDb.run(sql, params);
        // Dispatch event for any write operation
        window.dispatchEvent(new CustomEvent('db-update'));
        return result;
    },
    exec: async (sql, params) => {
        const result = await originalDb.exec(sql, params);
        if (sql && !sql.trim().toUpperCase().startsWith('SELECT')) {
            window.dispatchEvent(new CustomEvent('db-update'));
        }
        return result;
    }
};

export default db;

