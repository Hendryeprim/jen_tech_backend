const { query } = require('../config/db');

async function getWindowTypes(req, res, next) {
  try {
    const { include_profiles, all } = req.query;
    const filter = all === 'true' ? '' : 'WHERE is_active = TRUE';
    const typesRes = await query(
      `SELECT * FROM window_types ${filter} ORDER BY sort_order ASC, name ASC`
    );

    if (include_profiles === 'true') {
      const profilesRes = await query(
        'SELECT * FROM profiles WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC'
      );

      const data = typesRes.rows.map((wt) => ({
        ...wt,
        profiles: profilesRes.rows.filter((p) => p.window_type_id === wt.id),
      }));

      return res.json({ success: true, data });
    }

    res.json({
      success: true,
      data: typesRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

async function createWindowType(req, res, next) {
  try {
    const { name, code, category, panel_options, default_panels, illustration_type, description, sort_order } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: 'Name and Code are required' });
    }

    const panelOptionsJson = panel_options ? JSON.stringify(panel_options) : JSON.stringify(["2-Panel", "3-Panel", "4-Panel"]);

    const result = await query(
      `INSERT INTO window_types (name, code, category, panel_options, default_panels, illustration_type, description, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
       RETURNING *`,
      [
        name,
        code.toUpperCase().replace(/\s+/g, '_'),
        category || 'Window',
        panelOptionsJson,
        default_panels || '2-Panel',
        illustration_type || 'sliding_window_2',
        description || '',
        sort_order || 0,
      ]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Window Model created successfully' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'A model with this name or code already exists' });
    }
    next(err);
  }
}

async function updateWindowType(req, res, next) {
  try {
    const { id } = req.params;
    const { name, code, category, panel_options, default_panels, illustration_type, description, sort_order, is_active } = req.body;

    const panelOptionsJson = panel_options ? JSON.stringify(panel_options) : undefined;

    const result = await query(
      `UPDATE window_types
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           category = COALESCE($3, category),
           panel_options = COALESCE($4::jsonb, panel_options),
           default_panels = COALESCE($5, default_panels),
           illustration_type = COALESCE($6, illustration_type),
           description = COALESCE($7, description),
           sort_order = COALESCE($8, sort_order),
           is_active = COALESCE($9, is_active)
       WHERE id = $10
       RETURNING *`,
      [
        name,
        code ? code.toUpperCase().replace(/\s+/g, '_') : null,
        category,
        panelOptionsJson,
        default_panels,
        illustration_type,
        description,
        sort_order,
        is_active,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Window Model not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Window Model updated successfully' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, message: 'A model with this name or code already exists' });
    }
    next(err);
  }
}

async function deleteWindowType(req, res, next) {
  try {
    const { id } = req.params;
    // Check if there are profiles or quotations linked
    const result = await query(
      `UPDATE window_types SET is_active = FALSE WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Window Model not found' });
    }

    res.json({ success: true, message: 'Window Model deactivated successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWindowTypes,
  createWindowType,
  updateWindowType,
  deleteWindowType,
};
