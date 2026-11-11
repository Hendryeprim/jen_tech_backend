const { query } = require('../config/db');

async function syncNotebookProfiles() {
  console.log('[Sync] Updating Window Models and Profiles to match Client Notebook exactly (6 Windows only)...');

  // Exact 6 window types from client notebook paper
  const models = [
    {
      code: 'SLIDING_WINDOW_BIG',
      name: 'Sliding window - Big',
      category: 'Sliding Window',
      panel_options: JSON.stringify(['2-Panel Sliding', '3-Panel Sliding', '4-Panel Sliding']),
      default_panels: '2-Panel Sliding',
      illustration_type: 'sliding_window_2',
      description: 'Sliding window - Big Series (6.785 Frame, 5.074 Sash, 1.298 Beading, 1.239 Inter lock, 7.729 Sliding door sash)',
      sort_order: 1,
    },
    {
      code: 'SLIDING_WINDOW_SMALL',
      name: 'Sliding window - Small',
      category: 'Sliding Window',
      panel_options: JSON.stringify(['2-Panel Sliding', '3-Panel Sliding', '4-Panel Sliding']),
      default_panels: '2-Panel Sliding',
      illustration_type: 'sliding_window_2',
      description: 'Sliding window - Small Series (4.956 Frame, 3.658 Sash, 1.121 Beading, 1.003 Inter lock)',
      sort_order: 2,
    },
    {
      code: 'SLIDING_MESH_BIG',
      name: 'Sliding with mesh - Big',
      category: 'Sliding with Mesh',
      panel_options: JSON.stringify(['2.5 Track with Mesh Screen', '2-Panel with Mesh', '3-Panel with Mesh']),
      default_panels: '2.5 Track with Mesh Screen',
      illustration_type: 'sliding_window_2',
      description: 'Sliding with mesh - Big Series (7.729 Frame, 5.074 Sash, 2.832 Mesh screen, 1.298 Beading, 1.239 Inter lock)',
      sort_order: 3,
    },
    {
      code: 'SLIDING_MESH_SMALL',
      name: 'Sliding with mesh - Small',
      category: 'Sliding with Mesh',
      panel_options: JSON.stringify(['2.5 Track with Mesh Screen', '2-Panel with Mesh', '3-Panel with Mesh']),
      default_panels: '2.5 Track with Mesh Screen',
      illustration_type: 'sliding_window_2',
      description: 'Sliding with mesh - Small Series (5.9 Frame, 3.658 Sash, 2.83 Mesh screen, 1.121 Beading, 1.003 Inter lock)',
      sort_order: 4,
    },
    {
      code: 'TRACK_3_SLIDING',
      name: '3-track sliding window',
      category: '3-Track Sliding',
      panel_options: JSON.stringify(['3-Track 3-Panel', '3-Track with Mesh']),
      default_panels: '3-Track 3-Panel',
      illustration_type: 'sliding_window_2',
      description: '3-track sliding window (9.853 Frame, 5.074 Sash, 1.298 Beading, 1.239 Inter lock)',
      sort_order: 5,
    },
    {
      code: 'OPEN_WINDOW',
      name: 'Open window',
      category: 'Open Window',
      panel_options: JSON.stringify(['Single Shutter Openable', 'Double Shutter Openable', 'Top Hung / Fanlight']),
      default_panels: 'Single Shutter Openable',
      illustration_type: 'openable_window_1',
      description: 'Open window Casement Series (6.018 Frame, 6.726 Sash, 6.549 Mesh screen, 1.652 Beading)',
      sort_order: 6,
    },
    {
      code: 'DOOR_BIG',
      name: 'Door Big',
      category: 'Door',
      panel_options: JSON.stringify(['Single Door Openable', 'Double Door Openable']),
      default_panels: 'Single Door Openable',
      illustration_type: 'casement_door',
      description: 'Door Big Series (6.018 Frame, 8.614 Sash, 1.298 Beading)',
      sort_order: 7,
    },
    {
      code: 'DOOR_SMALL',
      name: 'Door Small',
      category: 'Door',
      panel_options: JSON.stringify(['Single Door Openable', 'Double Door Openable']),
      default_panels: 'Single Door Openable',
      illustration_type: 'casement_door',
      description: 'Door Small Series (6.018 Frame, 6.726 Sash, 1.298 Beading)',
      sort_order: 8,
    },
    {
      code: 'FIXED_WINDOW',
      name: 'Fixed',
      category: 'Fixed Window',
      panel_options: JSON.stringify(['Fixed Single Glazed', 'Fixed Double Glazed']),
      default_panels: 'Fixed Single Glazed',
      illustration_type: 'fixed_window',
      description: 'Fixed Window Series (6.018 Frame, 1.652 Beading)',
      sort_order: 9,
    },
    {
      code: 'FRENCH_DOOR',
      name: 'French Door',
      category: 'French Door',
      panel_options: JSON.stringify(['2-Panel Sliding French Door', '4-Panel Sliding French Door']),
      default_panels: '2-Panel Sliding French Door',
      illustration_type: 'sliding_window_2',
      description: 'French Door Series (6.785 Frame, 7.729 Sash, 1.298 Bead, 1.239 Interlock)',
      sort_order: 10,
    },
    {
      code: 'FIXED_LOUVER',
      name: 'Fixed Louver',
      category: 'Fixed Louver',
      panel_options: JSON.stringify(['Standard Louver', 'Ventilator with Louvers']),
      default_panels: 'Standard Louver',
      illustration_type: 'ventilator_louver',
      description: 'Fixed Louver Series (6.018 Frame)',
      sort_order: 11,
    },
  ];

  const allowedCodes = models.map((m) => m.code);

  // 1. Clean up obsolete window models not on the client notebook paper
  await query(
    `DELETE FROM window_types WHERE code NOT IN (${allowedCodes.map((_, i) => `$${i + 1}`).join(', ')})`,
    allowedCodes
  );

  const modelMap = {};
  for (const m of models) {
    const res = await query(
      `INSERT INTO window_types (name, code, category, panel_options, default_panels, illustration_type, description, sort_order, is_active)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, TRUE)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         panel_options = EXCLUDED.panel_options,
         default_panels = EXCLUDED.default_panels,
         illustration_type = EXCLUDED.illustration_type,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order,
         is_active = TRUE
       RETURNING id, code`,
      [m.name, m.code, m.category, m.panel_options, m.default_panels, m.illustration_type, m.description, m.sort_order]
    );
    modelMap[m.code] = res.rows[0].id;
  }

  // 2. Clear old profiles and populate EXACT notebook master data (27 profiles)
  await query('DELETE FROM profiles');

  // Exact data from client notebook photo (Items 1 to 6)
  const notebookProfiles = [
    // 1. Sliding window - Big
    { modelCode: 'SLIDING_WINDOW_BIG', name: 'Frame', weight_kg: 6.785, factor_kg_f: 0.357, desc: 'Outer 4-sided frame', order: 1 },
    { modelCode: 'SLIDING_WINDOW_BIG', name: 'Sash', weight_kg: 5.074, factor_kg_f: 0.267, desc: 'Sliding shutter profile', order: 2 },
    { modelCode: 'SLIDING_WINDOW_BIG', name: 'Beading', weight_kg: 1.298, factor_kg_f: 0.068, desc: 'Glass securing beading', order: 3 },
    { modelCode: 'SLIDING_WINDOW_BIG', name: 'Inter lock', weight_kg: 1.239, factor_kg_f: 0.065, desc: 'Centre shutter interlock', order: 4 },
    { modelCode: 'SLIDING_WINDOW_BIG', name: 'Sliding door sash', weight_kg: 7.729, factor_kg_f: 0.41, desc: 'Heavy sliding door sash profile', order: 5 },

    // 2. Sliding window - Small
    { modelCode: 'SLIDING_WINDOW_SMALL', name: 'Frame', weight_kg: 4.956, factor_kg_f: 0.27, desc: 'Small series outer frame', order: 1 },
    { modelCode: 'SLIDING_WINDOW_SMALL', name: 'Sash', weight_kg: 3.658, factor_kg_f: 0.19, desc: 'Small series shutter sash', order: 2 },
    { modelCode: 'SLIDING_WINDOW_SMALL', name: 'Beading', weight_kg: 1.121, factor_kg_f: 0.059, desc: 'Small series glass beading', order: 3 },
    { modelCode: 'SLIDING_WINDOW_SMALL', name: 'Inter lock', weight_kg: 1.003, factor_kg_f: 0.052, desc: 'Small series interlock', order: 4 },

    // 3. Sliding with mesh - Big
    { modelCode: 'SLIDING_MESH_BIG', name: 'Frame', weight_kg: 7.729, factor_kg_f: 0.406, desc: 'Mesh big outer frame', order: 1 },
    { modelCode: 'SLIDING_MESH_BIG', name: 'Sash', weight_kg: 5.074, factor_kg_f: 0.267, desc: 'Glass shutter sash', order: 2 },
    { modelCode: 'SLIDING_MESH_BIG', name: 'Mesh screen', weight_kg: 2.832, factor_kg_f: 0.14, desc: 'Mosquito mesh screen sash', order: 3 },
    { modelCode: 'SLIDING_MESH_BIG', name: 'Beading', weight_kg: 1.298, factor_kg_f: 0.068, desc: 'Glass securing beading', order: 4 },
    { modelCode: 'SLIDING_MESH_BIG', name: 'Inter lock', weight_kg: 1.239, factor_kg_f: 0.065, desc: 'Centre interlock profile', order: 5 },

    // 4. Sliding with mesh - Small
    { modelCode: 'SLIDING_MESH_SMALL', name: 'Frame', weight_kg: 5.9, factor_kg_f: 0.31, desc: 'Mesh small outer frame', order: 1 },
    { modelCode: 'SLIDING_MESH_SMALL', name: 'Sash', weight_kg: 3.658, factor_kg_f: 0.19, desc: 'Mesh small shutter sash', order: 2 },
    { modelCode: 'SLIDING_MESH_SMALL', name: 'Mesh screen', weight_kg: 2.83, factor_kg_f: 0.14, desc: 'Small mosquito mesh screen', order: 3 },
    { modelCode: 'SLIDING_MESH_SMALL', name: 'Beading', weight_kg: 1.121, factor_kg_f: 0.059, desc: 'Small glass beading', order: 4 },
    { modelCode: 'SLIDING_MESH_SMALL', name: 'Inter lock', weight_kg: 1.003, factor_kg_f: 0.052, desc: 'Small interlock profile', order: 5 },

    // 5. 3-track sliding window
    { modelCode: 'TRACK_3_SLIDING', name: 'Frame', weight_kg: 9.853, factor_kg_f: 0.519, desc: '3-track bottom and perimeter frame', order: 1 },
    { modelCode: 'TRACK_3_SLIDING', name: 'Sash', weight_kg: 5.074, factor_kg_f: 0.267, desc: '3-track shutter sash', order: 2 },
    { modelCode: 'TRACK_3_SLIDING', name: 'Beading', weight_kg: 1.298, factor_kg_f: 0.068, desc: '3-track glass beading', order: 3 },
    { modelCode: 'TRACK_3_SLIDING', name: 'Inter lock', weight_kg: 1.239, factor_kg_f: 0.065, desc: '3-track centre interlock', order: 4 },

    // 6. Open window
    { modelCode: 'OPEN_WINDOW', name: 'Frame', weight_kg: 6.018, factor_kg_f: 0.31, desc: 'Openable casement frame', order: 1 },
    { modelCode: 'OPEN_WINDOW', name: 'Sash', weight_kg: 6.726, factor_kg_f: 0.354, desc: 'Openable casement sash', order: 2 },
    { modelCode: 'OPEN_WINDOW', name: 'Mesh screen', weight_kg: 6.549, factor_kg_f: 0.344, desc: 'Casement mesh screen / mullion', order: 3 },
    { modelCode: 'OPEN_WINDOW', name: 'Beading', weight_kg: 1.652, factor_kg_f: 0.087, desc: 'Openable glass beading', order: 4 },

    // 7. Door Big
    { modelCode: 'DOOR_BIG', name: 'Frame', weight_kg: 6.018, factor_kg_f: 0.31, desc: 'Door Big outer frame', order: 1 },
    { modelCode: 'DOOR_BIG', name: 'Sash', weight_kg: 8.614, factor_kg_f: 0.453, desc: 'Door Big heavy sash', order: 2 },
    { modelCode: 'DOOR_BIG', name: 'Beading', weight_kg: 1.298, factor_kg_f: 0.068, desc: 'Door Big glass beading', order: 3 },

    // 8. Door Small
    { modelCode: 'DOOR_SMALL', name: 'Frame', weight_kg: 6.018, factor_kg_f: 0.31, desc: 'Door Small outer frame', order: 1 },
    { modelCode: 'DOOR_SMALL', name: 'Sash', weight_kg: 6.726, factor_kg_f: 0.354, desc: 'Door Small sash', order: 2 },
    { modelCode: 'DOOR_SMALL', name: 'Beading', weight_kg: 1.298, factor_kg_f: 0.068, desc: 'Door Small glass beading', order: 3 },

    // 9. Fixed
    { modelCode: 'FIXED_WINDOW', name: 'Frame', weight_kg: 6.018, factor_kg_f: 0.31, desc: 'Fixed outer frame', order: 1 },
    { modelCode: 'FIXED_WINDOW', name: 'Beading', weight_kg: 1.652, factor_kg_f: 0.087, desc: 'Fixed glass beading', order: 2 },

    // 10. French Door
    { modelCode: 'FRENCH_DOOR', name: 'Frame', weight_kg: 6.785, factor_kg_f: 0.357, desc: 'French Door outer frame', order: 1 },
    { modelCode: 'FRENCH_DOOR', name: 'Sash', weight_kg: 7.729, factor_kg_f: 0.407, desc: 'French Door heavy sash', order: 2 },
    { modelCode: 'FRENCH_DOOR', name: 'Bead', weight_kg: 1.298, factor_kg_f: 0.068, desc: 'French Door glass bead', order: 3 },
    { modelCode: 'FRENCH_DOOR', name: 'Interlock', weight_kg: 1.239, factor_kg_f: 0.065, desc: 'French Door meeting interlock', order: 4 },

    // 11. Fixed Louver
    { modelCode: 'FIXED_LOUVER', name: 'Frame', weight_kg: 6.018, factor_kg_f: 0.31, desc: 'Fixed Louver perimeter frame', order: 1 },
  ];

  for (const p of notebookProfiles) {
    const wTypeId = modelMap[p.modelCode];
    if (!wTypeId) {
      console.warn(`Model code not found: ${p.modelCode}`);
      continue;
    }

    const kgM = parseFloat((p.weight_kg / 5.9).toFixed(2));

    await query(
      `INSERT INTO profiles (window_type_id, name, weight_kg, weight_kg_m, factor_kg_f, description, default_formula_type, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (window_type_id, name) DO UPDATE SET
         weight_kg = EXCLUDED.weight_kg,
         weight_kg_m = EXCLUDED.weight_kg_m,
         factor_kg_f = EXCLUDED.factor_kg_f,
         description = EXCLUDED.description,
         default_formula_type = EXCLUDED.default_formula_type,
         sort_order = EXCLUDED.sort_order`,
      [wTypeId, p.name, p.weight_kg, kgM, p.factor_kg_f, p.desc, 'manual', p.order]
    );
  }

  console.log(`[Sync] Successfully synced ${notebookProfiles.length} profiles for 6 exact windows matching Client Notebook!`);
}

if (require.main === module) {
  syncNotebookProfiles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Sync Error]:', err);
      process.exit(1);
    });
}

module.exports = syncNotebookProfiles;
