const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function runSeed() {
  console.log('[Seed] Seeding database with JEN TECH Doors & Windows Master Data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Company Settings
    console.log('[Seed] Seeding Company Settings...');
    const existingSettings = await client.query('SELECT id FROM company_settings LIMIT 1');
    if (existingSettings.rows.length === 0) {
      await client.query(`
        INSERT INTO company_settings (
          company_name, tagline, address_line1, address_line2, city, state, state_code, pincode,
          phone, email, website, gstin, pan, bank_name, bank_account_number, bank_ifsc, bank_branch,
          fixed_divisor, multiplication_rate, quotation_prefix, invoice_prefix, default_gst_rate,
          quotation_terms, invoice_terms
        ) VALUES (
          'JEN TECH UPVC & Glazing Systems',
          'Premium Architectural UPVC Doors, Windows & Glazing Solutions',
          'Plot No. 42, Sidco Industrial Estate Phase-II',
          'Ambattur',
          'Chennai',
          'Tamil Nadu',
          '33',
          '600058',
          '+91 98400 12345',
          'sales@jentech.com',
          'www.jentech.com',
          '33AABCT1332M1Z0',
          'AABCT1332M',
          'HDFC Bank',
          '50200088991234',
          'HDFC0001234',
          'Ambattur Industrial Estate Branch, Chennai',
          19.0000,
          175.00,
          'JT-Q-',
          'JT-INV-',
          18.00,
          '1. 50% advance along with confirmed work order.\n2. 40% on delivery of materials at site before installation.\n3. 10% balance on completion.\n4. Standard fabrication lead time: 15-20 working days.\n5. Quotation valid for 15 days.',
          '1. Goods once sold will not be taken back or exchanged.\n2. Warranty covers manufacturing and fabrication defects for 1 year.\n3. Payments via NEFT/RTGS/Cheque in favor of JEN TECH.\n4. Subject to Chennai jurisdiction only.'
        )
      `);
    }

    // 2. Users
    console.log('[Seed] Seeding Users...');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@jentech.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'JenTech@2026Admin';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
    const staffPasswordHash = await bcrypt.hash(process.env.STAFF_PASSWORD || 'JenTech@2026Staff', 10);
    const managerPasswordHash = await bcrypt.hash(process.env.MANAGER_PASSWORD || 'JenTech@2026Mgr', 10);

    await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES 
        ('Admin User', $4, $1, 'admin'),
        ('Billing Staff', 'staff@jentech.com', $2, 'billing_staff'),
        ('Operations Manager', 'manager@jentech.com', $3, 'manager')
      ON CONFLICT (email) DO UPDATE SET 
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role
    `, [adminPasswordHash, staffPasswordHash, managerPasswordHash, adminEmail]);

    // 3. Product Categories & Door/Window Models (6 Exact Windows from Notebook)
    console.log('[Seed] Seeding Window Models (6 Exact Windows)...');
    const modelsData = [
      {
        name: 'Sliding window - Big',
        code: 'SLIDING_WINDOW_BIG',
        category: 'Sliding Window',
        panel_options: JSON.stringify(['2-Panel Sliding', '3-Panel Sliding', '4-Panel Sliding']),
        default_panels: '2-Panel Sliding',
        illustration_type: 'sliding_window_2',
        description: 'Sliding window - Big Series (6.785 Frame, 5.074 Sash, 1.298 Beading, 1.239 Inter lock, 7.729 Sliding door sash)',
        sort_order: 1,
      },
      {
        name: 'Sliding window - Small',
        code: 'SLIDING_WINDOW_SMALL',
        category: 'Sliding Window',
        panel_options: JSON.stringify(['2-Panel Sliding', '3-Panel Sliding', '4-Panel Sliding']),
        default_panels: '2-Panel Sliding',
        illustration_type: 'sliding_window_2',
        description: 'Sliding window - Small Series (4.956 Frame, 3.658 Sash, 1.121 Beading, 1.003 Inter lock)',
        sort_order: 2,
      },
      {
        name: 'Sliding with mesh - Big',
        code: 'SLIDING_MESH_BIG',
        category: 'Sliding with Mesh',
        panel_options: JSON.stringify(['2.5 Track with Mesh Screen', '2-Panel with Mesh', '3-Panel with Mesh']),
        default_panels: '2.5 Track with Mesh Screen',
        illustration_type: 'sliding_window_2',
        description: 'Sliding with mesh - Big Series (7.729 Frame, 5.074 Sash, 2.832 Mesh screen, 1.298 Beading, 1.239 Inter lock)',
        sort_order: 3,
      },
      {
        name: 'Sliding with mesh - Small',
        code: 'SLIDING_MESH_SMALL',
        category: 'Sliding with Mesh',
        panel_options: JSON.stringify(['2.5 Track with Mesh Screen', '2-Panel with Mesh', '3-Panel with Mesh']),
        default_panels: '2.5 Track with Mesh Screen',
        illustration_type: 'sliding_window_2',
        description: 'Sliding with mesh - Small Series (5.9 Frame, 3.658 Sash, 2.83 Mesh screen, 1.121 Beading, 1.003 Inter lock)',
        sort_order: 4,
      },
      {
        name: '3-track sliding window',
        code: 'TRACK_3_SLIDING',
        category: '3-Track Sliding',
        panel_options: JSON.stringify(['3-Track 3-Panel', '3-Track with Mesh']),
        default_panels: '3-Track 3-Panel',
        illustration_type: 'sliding_window_2',
        description: '3-track sliding window (9.853 Frame, 5.074 Sash, 1.298 Beading, 1.239 Inter lock)',
        sort_order: 5,
      },
      {
        name: 'Open window',
        code: 'OPEN_WINDOW',
        category: 'Open Window',
        panel_options: JSON.stringify(['Single Shutter Openable', 'Double Shutter Openable', 'Top Hung / Fanlight']),
        default_panels: 'Single Shutter Openable',
        illustration_type: 'openable_window_1',
        description: 'Open window Casement Series (6.018 Frame, 6.726 Sash, 6.549 Mesh screen, 1.652 Beading)',
        sort_order: 6,
      },
    ];

    const modelIdMap = {};
    for (const m of modelsData) {
      const res = await client.query(`
        INSERT INTO window_types (name, code, category, panel_options, default_panels, illustration_type, description, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (code) DO UPDATE SET 
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          panel_options = EXCLUDED.panel_options,
          default_panels = EXCLUDED.default_panels,
          illustration_type = EXCLUDED.illustration_type,
          description = EXCLUDED.description,
          sort_order = EXCLUDED.sort_order
        RETURNING id, code
      `, [m.name, m.code, m.category, m.panel_options, m.default_panels, m.illustration_type, m.description, m.sort_order]);
      modelIdMap[res.rows[0].code] = res.rows[0].id;
    }

    // 4. Profiles Master Data with Exact Certified KG Weights
    console.log('[Seed] Seeding UPVC Profiles Master Data...');
    const profilesData = [
      // 1. Sliding window - Big
      { modelCode: 'SLIDING_WINDOW_BIG', name: 'Frame', weight: 6.785, factor: 0.357, desc: 'Outer 4-sided frame', order: 1 },
      { modelCode: 'SLIDING_WINDOW_BIG', name: 'Sash', weight: 5.074, factor: 0.267, desc: 'Sliding shutter profile', order: 2 },
      { modelCode: 'SLIDING_WINDOW_BIG', name: 'Beading', weight: 1.298, factor: 0.068, desc: 'Glass securing beading', order: 3 },
      { modelCode: 'SLIDING_WINDOW_BIG', name: 'Inter lock', weight: 1.239, factor: 0.065, desc: 'Centre shutter interlock', order: 4 },
      { modelCode: 'SLIDING_WINDOW_BIG', name: 'Sliding door sash', weight: 7.729, factor: 0.41, desc: 'Heavy sliding door sash profile', order: 5 },

      // 2. Sliding window - Small
      { modelCode: 'SLIDING_WINDOW_SMALL', name: 'Frame', weight: 4.956, factor: 0.27, desc: 'Small series outer frame', order: 1 },
      { modelCode: 'SLIDING_WINDOW_SMALL', name: 'Sash', weight: 3.658, factor: 0.19, desc: 'Small series shutter sash', order: 2 },
      { modelCode: 'SLIDING_WINDOW_SMALL', name: 'Beading', weight: 1.121, factor: 0.059, desc: 'Small series glass beading', order: 3 },
      { modelCode: 'SLIDING_WINDOW_SMALL', name: 'Inter lock', weight: 1.003, factor: 0.052, desc: 'Small series interlock', order: 4 },

      // 3. Sliding with mesh - Big
      { modelCode: 'SLIDING_MESH_BIG', name: 'Frame', weight: 7.729, factor: 0.406, desc: 'Mesh big outer frame', order: 1 },
      { modelCode: 'SLIDING_MESH_BIG', name: 'Sash', weight: 5.074, factor: 0.267, desc: 'Glass shutter sash', order: 2 },
      { modelCode: 'SLIDING_MESH_BIG', name: 'Mesh screen', weight: 2.832, factor: 0.14, desc: 'Mosquito mesh screen sash', order: 3 },
      { modelCode: 'SLIDING_MESH_BIG', name: 'Beading', weight: 1.298, factor: 0.068, desc: 'Glass securing beading', order: 4 },
      { modelCode: 'SLIDING_MESH_BIG', name: 'Inter lock', weight: 1.239, factor: 0.065, desc: 'Centre interlock profile', order: 5 },

      // 4. Sliding with mesh - Small
      { modelCode: 'SLIDING_MESH_SMALL', name: 'Frame', weight: 5.9, factor: 0.31, desc: 'Mesh small outer frame', order: 1 },
      { modelCode: 'SLIDING_MESH_SMALL', name: 'Sash', weight: 3.658, factor: 0.19, desc: 'Mesh small shutter sash', order: 2 },
      { modelCode: 'SLIDING_MESH_SMALL', name: 'Mesh screen', weight: 2.83, factor: 0.14, desc: 'Small mosquito mesh screen', order: 3 },
      { modelCode: 'SLIDING_MESH_SMALL', name: 'Beading', weight: 1.121, factor: 0.059, desc: 'Small glass beading', order: 4 },
      { modelCode: 'SLIDING_MESH_SMALL', name: 'Inter lock', weight: 1.003, factor: 0.052, desc: 'Small interlock profile', order: 5 },

      // 5. 3-track sliding window
      { modelCode: 'TRACK_3_SLIDING', name: 'Frame', weight: 9.853, factor: 0.519, desc: '3-track bottom and perimeter frame', order: 1 },
      { modelCode: 'TRACK_3_SLIDING', name: 'Sash', weight: 5.074, factor: 0.267, desc: '3-track shutter sash', order: 2 },
      { modelCode: 'TRACK_3_SLIDING', name: 'Beading', weight: 1.298, factor: 0.068, desc: '3-track glass beading', order: 3 },
      { modelCode: 'TRACK_3_SLIDING', name: 'Inter lock', weight: 1.239, factor: 0.065, desc: '3-track centre interlock', order: 4 },

      // 6. Open window
      { modelCode: 'OPEN_WINDOW', name: 'Frame', weight: 6.018, factor: 0.31, desc: 'Openable casement frame', order: 1 },
      { modelCode: 'OPEN_WINDOW', name: 'Sash', weight: 6.726, factor: 0.354, desc: 'Openable casement sash', order: 2 },
      { modelCode: 'OPEN_WINDOW', name: 'Mesh screen', weight: 6.549, factor: 0.344, desc: 'Casement mesh screen / mullion', order: 3 },
      { modelCode: 'OPEN_WINDOW', name: 'Beading', weight: 1.652, factor: 0.087, desc: 'Openable glass beading', order: 4 },
    ];

    for (const p of profilesData) {
      const modelId = modelIdMap[p.modelCode];
      const kgM = parseFloat((p.weight / 5.9).toFixed(2));
      await client.query(`
        INSERT INTO profiles (window_type_id, name, weight_kg, weight_kg_m, factor_kg_f, description, default_formula_type, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (window_type_id, name) DO UPDATE SET 
          weight_kg = EXCLUDED.weight_kg,
          weight_kg_m = EXCLUDED.weight_kg_m,
          factor_kg_f = EXCLUDED.factor_kg_f,
          description = EXCLUDED.description,
          default_formula_type = EXCLUDED.default_formula_type,
          sort_order = EXCLUDED.sort_order
      `, [modelId, p.name, p.weight, kgM, p.factor, p.desc, 'manual', p.order]);
    }

    // 5. Additional Charge Types Master
    console.log('[Seed] Seeding Additional Charge Types...');
    const chargesData = [
      { name: 'Touch Lock', code: 'TOUCH_LOCK', scope: 'window', rate: 100.00, unit: 'Nos', order: 1 },
      { name: 'Screws', code: 'SCREWS', scope: 'window', rate: 50.00, unit: 'Set', order: 2 },
      { name: 'Wheels', code: 'WHEELS', scope: 'window', rate: 50.00, unit: 'Set', order: 3 },
      { name: 'Anabond', code: 'ANABOND', scope: 'window', rate: 200.00, unit: 'Nos', order: 4 },
      { name: 'Wheel Pile / Fastener Cap', code: 'FASTENER_CAP', scope: 'window', rate: 25.00, unit: 'Set', order: 5 },
      { name: 'Glass', code: 'GLASS', scope: 'window', rate: 50.00, unit: 'Sq.Ft', order: 6 },
      { name: 'Steel', code: 'STEEL', scope: 'window', rate: 200.00, unit: 'Set', order: 7 },
      { name: 'Labour', code: 'LABOUR', scope: 'window', rate: 500.00, unit: 'Nos', order: 8 },
      { name: 'Fitting Labour', code: 'FITTING_LABOUR', scope: 'window', rate: 20.00, unit: 'Sq.Ft', order: 9 },
      { name: 'Mesh', code: 'MESH', scope: 'window', rate: 65.00, unit: 'Sq.Ft', order: 10 },
      { name: 'Transportation', code: 'TRANSPORTATION', scope: 'quotation', rate: 1500.00, unit: 'Lump Sum', order: 11 },
      { name: 'Other Charges', code: 'OTHER_CHARGES', scope: 'quotation', rate: 1000.00, unit: 'Lump Sum', order: 12 },
    ];

    for (const c of chargesData) {
      await client.query(`
        INSERT INTO additional_charge_types (name, code, charge_scope, default_rate, unit, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (name) DO UPDATE SET
          code = EXCLUDED.code,
          charge_scope = EXCLUDED.charge_scope,
          default_rate = EXCLUDED.default_rate,
          unit = EXCLUDED.unit,
          sort_order = EXCLUDED.sort_order
      `, [c.name, c.code, c.scope, c.rate, c.unit, c.order]);
    }

    await client.query('COMMIT');
    console.log('[Seed] Database master data seeding completed successfully (clean without mock data)!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Seed Error]:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runSeed()
    .then(() => {
      console.log('[Seed] Finished seed process.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed] Seed script failed:', err);
      process.exit(1);
    });
}

module.exports = runSeed;
