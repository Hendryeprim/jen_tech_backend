const { query } = require('../config/db');

async function getProfiles(req, res, next) {
  try {
    const { window_type_id, active_only } = req.query;
    let sql = `
      SELECT p.*, wt.name AS window_type_name, wt.code AS window_type_code
      FROM profiles p
      JOIN window_types wt ON p.window_type_id = wt.id
    `;
    const params = [];

    const conditions = [];
    if (window_type_id) {
      params.push(window_type_id);
      conditions.push(`p.window_type_id = $${params.length}`);
    }
    if (active_only === 'true') {
      conditions.push('p.is_active = TRUE');
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY wt.sort_order ASC, p.sort_order ASC, p.name ASC';

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

async function createProfile(req, res, next) {
  try {
    const {
      window_type_id,
      name,
      weight_kg,
      weight_kg_m,
      factor_kg_f,
      description,
      default_formula_type = 'manual',
    } = req.body;

    if (!window_type_id || !name || weight_kg === undefined) {
      return res.status(400).json({ success: false, message: 'Window Type, Profile Name, and Weight (KG) are required.' });
    }

    const parsedWeight = parseFloat(weight_kg);
    const calculatedKgM = weight_kg_m !== undefined && weight_kg_m !== '' && weight_kg_m !== null
      ? parseFloat(weight_kg_m)
      : parseFloat((parsedWeight / 5.9).toFixed(2));
    const calculatedKgF = factor_kg_f !== undefined && factor_kg_f !== '' && factor_kg_f !== null
      ? parseFloat(factor_kg_f)
      : parseFloat((parsedWeight / 19).toFixed(3));

    const result = await query(
      `INSERT INTO profiles (window_type_id, name, weight_kg, weight_kg_m, factor_kg_f, description, default_formula_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [window_type_id, name.trim(), parsedWeight, calculatedKgM, calculatedKgF, description ? description.trim() : null, default_formula_type]
    );

    res.status(201).json({
      success: true,
      message: 'Profile added successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { id } = req.params;
    const { name, weight_kg, weight_kg_m, factor_kg_f, description, default_formula_type, is_active } = req.body;

    const parsedWeight = weight_kg !== undefined && weight_kg !== '' && weight_kg !== null ? parseFloat(weight_kg) : null;
    const parsedKgM = weight_kg_m !== undefined && weight_kg_m !== '' && weight_kg_m !== null
      ? parseFloat(weight_kg_m)
      : (parsedWeight !== null ? parseFloat((parsedWeight / 5.9).toFixed(2)) : null);
    const parsedKgF = factor_kg_f !== undefined && factor_kg_f !== '' && factor_kg_f !== null
      ? parseFloat(factor_kg_f)
      : (parsedWeight !== null ? parseFloat((parsedWeight / 19).toFixed(3)) : null);

    const result = await query(
      `UPDATE profiles SET
         name = COALESCE($1, name),
         weight_kg = COALESCE($2, weight_kg),
         weight_kg_m = COALESCE($3, weight_kg_m),
         factor_kg_f = COALESCE($4, factor_kg_f),
         description = COALESCE($5, description),
         default_formula_type = COALESCE($6, default_formula_type),
         is_active = COALESCE($7, is_active),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [
        name ? name.trim() : null,
        parsedWeight,
        parsedKgM,
        parsedKgF,
        description !== undefined ? description.trim() : null,
        default_formula_type || null,
        is_active !== undefined ? is_active : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function toggleProfileActive(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query(
      'UPDATE profiles SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }

    res.json({
      success: true,
      message: `Profile ${result.rows[0].is_active ? 'activated' : 'deactivated'} successfully`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function deleteProfile(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM profiles WHERE id = $1 RETURNING id, name', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }
    res.json({
      success: true,
      message: `Profile "${result.rows[0].name}" deleted successfully`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function resetNotebookStandards(req, res, next) {
  try {
    const syncNotebookProfiles = require('../database/syncNotebookProfiles');
    await syncNotebookProfiles();
    res.json({
      success: true,
      message: 'All profiles restored to client notebook standards successfully!',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProfiles,
  createProfile,
  updateProfile,
  toggleProfileActive,
  deleteProfile,
  resetNotebookStandards,
};
