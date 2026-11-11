const pool = require('../config/db');

async function syncHardwares() {
  const items = [
    ['Handle', 'HW_HANDLE', 'window', 0, 'Nos'],
    ['Espag', 'HW_ESPAG', 'window', 0, 'Set'],
    ['D Max', 'HW_D_MAX', 'window', 0, 'Set'],
    ['Matt', 'HW_MATT', 'window', 0, 'Set'],
    ['Silicon', 'HW_SILICON', 'window', 0, 'Tube'],
    ['Net', 'HW_NET', 'window', 0, 'Sq.Ft'],
    ['Mullion', 'HW_MULLION', 'window', 0, 'Nos'],
    ['Panel', 'HW_PANEL', 'window', 0, 'Nos'],
    ['Lock', 'HW_LOCK', 'window', 0, 'Nos'],
    ['T-Lock', 'HW_T_LOCK', 'window', 0, 'Nos'],
    ['Hinges', 'HW_HINGES', 'window', 0, 'Set'],
    ['Fabrication', 'HW_FABRICATION', 'window', 0, 'Job'],
  ];

  try {
    for (const [name, code, scope, rate, unit] of items) {
      const ex = await pool.query(
        'SELECT id FROM additional_charge_types WHERE LOWER(name) = LOWER($1) OR code = $2',
        [name, code]
      );
      if (ex.rows.length === 0) {
        await pool.query(
          'INSERT INTO additional_charge_types (name, code, charge_scope, default_rate, unit, is_active) VALUES ($1, $2, $3, $4, $5, true)',
          [name, code, scope, rate, unit]
        );
        console.log('Inserted hardware:', name, `(${code})`);
      } else {
        console.log('Already exists:', name);
      }
    }
    console.log('Hardware sync complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error syncing hardwares:', err);
    process.exit(1);
  }
}

syncHardwares();
