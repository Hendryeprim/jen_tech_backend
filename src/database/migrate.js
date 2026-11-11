const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function runMigration() {
  console.log('[Migration] Starting PostgreSQL schema migration...');
  const sqlPath = path.join(__dirname, 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[Migration] Successfully executed init.sql! All tables created.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Migration Error]:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('[Migration] Migration process complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration] Migration failed:', err);
      process.exit(1);
    });
}

module.exports = runMigration;
