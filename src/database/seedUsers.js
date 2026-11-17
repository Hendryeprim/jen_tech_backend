const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const { pool } = require('../config/db');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function seedAdminUsers() {
  console.log('====================================================');
  console.log('🔐 Seeding JEN TECH Admin & Manager Users...');
  console.log('====================================================');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const managerEmail = process.env.MANAGER_EMAIL || 'manager@jentech.com';
    const managerPassword = process.env.MANAGER_PASSWORD || 'JenTech@2026Mgr';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@jentech.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'JenTech@2026Admin';
    const staffEmail = process.env.STAFF_EMAIL || 'staff@jentech.com';
    const staffPassword = process.env.STAFF_PASSWORD || 'JenTech@2026Staff';

    const managerHash = await bcrypt.hash(managerPassword, 10);
    const adminHash = await bcrypt.hash(adminPassword, 10);
    const staffHash = await bcrypt.hash(staffPassword, 10);

    const usersToSeed = [
      { name: 'Operations Manager', email: managerEmail, hash: managerHash, role: 'admin' },
      { name: 'Admin User', email: adminEmail, hash: adminHash, role: 'admin' },
      { name: 'Billing Staff', email: staffEmail, hash: staffHash, role: 'billing_staff' },
    ];

    for (const u of usersToSeed) {
      const res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (email) DO UPDATE SET
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role,
           is_active = true
         RETURNING id, name, email, role, is_active`,
        [u.name, u.email, u.hash, u.role]
      );
      const row = res.rows[0];
      console.log(`✅ [User Seeded] ID: ${row.id} | Email: ${row.email} | Role: ${row.role}`);
    }

    await client.query('COMMIT');
    console.log('====================================================');
    console.log('🎉 Admin Credentials Successfully Seeded!');
    console.log(`👤 Manager / Admin: ${managerEmail}  (Password: ${managerPassword})`);
    console.log(`👤 Backup Admin:    ${adminEmail}    (Password: ${adminPassword})`);
    console.log(`👤 Billing Staff:   ${staffEmail}    (Password: ${staffPassword})`);
    console.log('====================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to seed admin users:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedAdminUsers()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedAdminUsers;
