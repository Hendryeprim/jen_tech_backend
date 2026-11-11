const { query } = require('../config/db');

async function getAdditionalCharges(req, res, next) {
  try {
    const { active_only } = req.query;
    let sql = 'SELECT * FROM additional_charge_types';
    const params = [];

    if (active_only === 'true') {
      sql += ' WHERE is_active = TRUE';
    }

    sql += ' ORDER BY sort_order ASC, name ASC';

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

async function createAdditionalCharge(req, res, next) {
  try {
    const { name, code, charge_scope = 'window', default_rate = 0.0, unit = 'Nos' } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Charge name is required.' });
    }

    const generatedCode = code ? code.trim().toUpperCase() : name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');

    const result = await query(
      `INSERT INTO additional_charge_types (name, code, charge_scope, default_rate, unit)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name.trim(), generatedCode, charge_scope, parseFloat(default_rate) || 0, unit.trim()]
    );

    res.status(201).json({
      success: true,
      message: 'Charge type created successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function updateAdditionalCharge(req, res, next) {
  try {
    const { id } = req.params;
    const { name, charge_scope, default_rate, unit, is_active } = req.body;

    const result = await query(
      `UPDATE additional_charge_types SET
         name = COALESCE($1, name),
         charge_scope = COALESCE($2, charge_scope),
         default_rate = COALESCE($3, default_rate),
         unit = COALESCE($4, unit),
         is_active = COALESCE($5, is_active),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        name ? name.trim() : null,
        charge_scope || null,
        default_rate !== undefined ? parseFloat(default_rate) : null,
        unit ? unit.trim() : null,
        is_active !== undefined ? is_active : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Charge type not found.' });
    }

    res.json({
      success: true,
      message: 'Charge type updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function toggleAdditionalChargeActive(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE additional_charge_types SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Charge type not found.' });
    }

    res.json({
      success: true,
      message: `Charge type ${result.rows[0].is_active ? 'activated' : 'deactivated'} successfully`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAdditionalCharges,
  createAdditionalCharge,
  updateAdditionalCharge,
  toggleAdditionalChargeActive,
};
