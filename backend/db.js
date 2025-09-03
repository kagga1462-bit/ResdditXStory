const { Pool } = require('pg');

let pool = null;
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
	const requiresSsl = /[?&]sslmode=require/.test(databaseUrl || '') || process.env.PGSSL === 'true';
	pool = new Pool({
		connectionString: databaseUrl,
		ssl: requiresSsl ? { rejectUnauthorized: false } : false,
	});
}

async function runQuery(sql, params = []) {
	if (!pool) {
		return { rows: [], rowCount: 0 };
	}
	const client = await pool.connect();
	try {
		const result = await client.query(sql, params);
		return result;
	} finally {
		client.release();
	}
}

module.exports = {
	runQuery,
};


