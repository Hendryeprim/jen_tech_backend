const { pool, query } = require('../config/db');
const { calculateQuotation } = require('../services/calculationEngine');

// Generate next unique quotation number
async function generateQuotationNumber(client) {
  const settingsRes = await client.query('SELECT quotation_prefix FROM company_settings LIMIT 1');
  const prefix = (settingsRes.rows[0] && settingsRes.rows[0].quotation_prefix) || 'JT-Q-';
  const year = new Date().getFullYear();

  // Find latest quotation number for this year
  const searchPattern = `${prefix}${year}-%`;
  const latestRes = await client.query(
    'SELECT quotation_number FROM quotations WHERE quotation_number LIKE $1 ORDER BY id DESC LIMIT 1',
    [searchPattern]
  );

  let nextSequence = 1;
  if (latestRes.rows.length > 0) {
    const parts = latestRes.rows[0].quotation_number.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  const seqStr = String(nextSequence).padStart(4, '0');
  return `${prefix}${year}-${seqStr}`;
}

async function getQuotations(req, res, next) {
  try {
    const { search, status, customer_id, start_date, end_date, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT q.*, c.customer_name, c.mobile_number, c.city,
        (SELECT COUNT(*) FROM quotation_items qi WHERE qi.quotation_id = q.id) AS total_windows
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
    `;
    const params = [];
    const conditions = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(q.quotation_number ILIKE $${params.length} OR c.customer_name ILIKE $${params.length} OR c.mobile_number ILIKE $${params.length} OR q.project_name ILIKE $${params.length})`);
    }

    if (status) {
      params.push(status);
      conditions.push(`q.status = $${params.length}`);
    }

    if (customer_id) {
      params.push(customer_id);
      conditions.push(`q.customer_id = $${params.length}`);
    }

    if (start_date) {
      params.push(start_date);
      conditions.push(`q.quotation_date >= $${params.length}`);
    }

    if (end_date) {
      params.push(end_date);
      conditions.push(`q.quotation_date <= $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY q.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sql, params);

    // Count
    let countSql = `
      SELECT COUNT(*) 
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
    `;
    if (conditions.length > 0) {
      countSql += ' WHERE ' + conditions.join(' AND ');
    }
    const countResult = await query(countSql, params.slice(0, conditions.length));

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
}

async function getQuotationById(req, res, next) {
  try {
    const { id } = req.params;

    const qRes = await query(`
      SELECT q.*, c.customer_name, c.mobile_number, c.email AS customer_email,
             c.address AS customer_address, c.city AS customer_city, c.state AS customer_state,
             c.gstin AS customer_gstin, u.name AS creator_name
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
      LEFT JOIN users u ON q.created_by = u.id
      WHERE q.id = $1
    `, [id]);

    if (qRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    const quotation = qRes.rows[0];

    // Fetch quotation items
    const itemsRes = await query(`
      SELECT qi.*, wt.name AS window_type_name
      FROM quotation_items qi
      LEFT JOIN window_types wt ON qi.window_type_id = wt.id
      WHERE qi.quotation_id = $1
      ORDER BY qi.item_index ASC
    `, [id]);

    const items = itemsRes.rows;

    // Fetch window components for all items
    for (const item of items) {
      const compRes = await query(`
        SELECT wc.*
        FROM window_components wc
        WHERE wc.quotation_item_id = $1
        ORDER BY wc.id ASC
      `, [item.id]);
      item.components = compRes.rows;

      // Fetch window charges
      const chargesRes = await query(`
        SELECT qc.*
        FROM quotation_charges qc
        WHERE qc.quotation_item_id = $1
        ORDER BY qc.id ASC
      `, [item.id]);
      item.charges = chargesRes.rows;
    }

    // Fetch quotation-level charges
    const quoteChargesRes = await query(`
      SELECT qc.*
      FROM quotation_charges qc
      WHERE qc.quotation_id = $1 AND qc.quotation_item_id IS NULL
      ORDER BY qc.id ASC
    `, [id]);

    quotation.items = items;
    quotation.quotation_charges = quoteChargesRes.rows;

    res.json({
      success: true,
      data: quotation,
    });
  } catch (err) {
    next(err);
  }
}

async function createQuotation(req, res, next) {
  const client = await pool.connect();
  try {
    const {
      customer_id,
      customer_name,
      customer_mobile,
      customer_address,
      customer_city,
      customer_gstin,
      project_name,
      quotation_date = new Date().toISOString().split('T')[0],
      valid_until,
      status = 'Draft',
      items = [],
      quotation_charges = [],
      discount_amount = 0,
      manual_override_amount,
      is_override_applied,
      override_reason,
      is_gst_applied = false,
      gst_rate = 18.0,
      is_interstate = false,
      notes,
    } = req.body;

    await client.query('BEGIN');

    let effectiveCustomerId = customer_id;
    if (!effectiveCustomerId && customer_name && customer_name.trim()) {
      const existing = await client.query(
        'SELECT id FROM customers WHERE (mobile_number = $1 AND mobile_number IS NOT NULL AND mobile_number != \'\') OR (customer_name ILIKE $2) LIMIT 1',
        [customer_mobile || null, customer_name.trim()]
      );
      if (existing.rows.length > 0) {
        effectiveCustomerId = existing.rows[0].id;
        if (customer_address || customer_gstin || project_name) {
          await client.query(
            'UPDATE customers SET address = COALESCE($1, address), gstin = COALESCE($2, gstin), project_name = COALESCE($3, project_name) WHERE id = $4',
            [customer_address || null, customer_gstin || null, project_name || null, effectiveCustomerId]
          );
        }
      } else {
        const newCust = await client.query(
          'INSERT INTO customers (customer_name, mobile_number, address, city, state, gstin, project_name) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [customer_name.trim(), customer_mobile || null, customer_address || null, customer_city || 'Chennai', 'Tamil Nadu', customer_gstin || null, project_name || null]
        );
        effectiveCustomerId = newCust.rows[0].id;
      }
    }

    if (!effectiveCustomerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Customer name is required for quotation.' });
    }

    // Fetch company divisor & multiplication rate
    const settingsRes = await client.query('SELECT fixed_divisor, multiplication_rate FROM company_settings LIMIT 1');
    const divisor = settingsRes.rows[0] ? parseFloat(settingsRes.rows[0].fixed_divisor) : 19.0;
    const rate = settingsRes.rows[0] ? parseFloat(settingsRes.rows[0].multiplication_rate) : 175.0;

    // Run backend calculation engine
    const calculated = calculateQuotation({
      items,
      quotation_charges,
      discount_amount,
      manual_override_amount,
      is_override_applied,
      override_reason,
      divisor,
      rate,
      is_gst_applied,
      gst_rate,
      is_interstate,
    });

    const quotationNumber = await generateQuotationNumber(client);

    const qInsertRes = await client.query(`
      INSERT INTO quotations (
        quotation_number, customer_id, project_name, quotation_date, valid_until,
        status, fixed_divisor, multiplication_rate, calculated_subtotal,
        additional_charges_total, discount_amount, calculated_grand_total,
        manual_override_amount, is_override_applied, override_reason, final_amount,
        is_gst_applied, gst_rate, taxable_amount, tax_amount, cgst_amount, sgst_amount, igst_amount,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      RETURNING *
    `, [
      quotationNumber,
      effectiveCustomerId,
      project_name || null,
      quotation_date,
      valid_until || null,
      status,
      calculated.fixed_divisor,
      calculated.multiplication_rate,
      calculated.calculated_subtotal,
      calculated.additional_charges_total,
      calculated.discount_amount,
      calculated.calculated_grand_total,
      calculated.manual_override_amount,
      calculated.is_override_applied,
      calculated.override_reason,
      calculated.final_amount,
      calculated.is_gst_applied || false,
      calculated.gst_rate || 0,
      calculated.taxable_amount || 0,
      calculated.total_tax_amount || 0,
      calculated.cgst_amount || 0,
      calculated.sgst_amount || 0,
      calculated.igst_amount || 0,
      notes || null,
      req.user ? req.user.id : null,
    ]);

    const newQuotation = qInsertRes.rows[0];

    // Insert items & components
    for (let i = 0; i < calculated.items.length; i++) {
      const item = calculated.items[i];
      const itemRes = await client.query(`
        INSERT INTO quotation_items (
          quotation_id, item_index, window_name, window_type_id, window_type_name,
          width, height, measurement_unit, width_feet, height_feet, quantity,
          frame_running_feet, total_profile_value, window_profile_cost,
          window_charges_total, unit_cost, item_subtotal, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id
      `, [
        newQuotation.id,
        i + 1,
        item.window_name,
        item.window_type_id,
        item.window_type_name || '',
        item.width,
        item.height,
        item.measurement_unit,
        item.width_feet,
        item.height_feet,
        item.quantity,
        item.frame_running_feet,
        item.total_profile_value,
        item.window_profile_cost,
        item.window_charges_total,
        item.unit_cost,
        item.item_subtotal,
        item.remarks || null,
      ]);

      const itemId = itemRes.rows[0].id;

      // Insert component snapshots
      for (const comp of item.components) {
        await client.query(`
          INSERT INTO window_components (
            quotation_item_id, profile_id, profile_name, profile_kg_snapshot,
            divisor_snapshot, profile_factor, running_feet, component_value, formula_note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          itemId,
          comp.profile_id,
          comp.profile_name,
          comp.profile_kg_snapshot,
          comp.divisor_snapshot,
          comp.profile_factor,
          comp.running_feet,
          comp.component_value,
          comp.formula_note,
        ]);
      }

      // Insert window charges
      for (const ch of item.charges) {
        await client.query(`
          INSERT INTO quotation_charges (
            quotation_id, quotation_item_id, charge_type_id, charge_name,
            charge_scope, rate, quantity, unit, amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          newQuotation.id,
          itemId,
          ch.charge_type_id,
          ch.charge_name,
          'window',
          ch.rate,
          ch.quantity,
          ch.unit,
          ch.amount,
        ]);
      }
    }

    // Insert quotation-level charges
    for (const qch of calculated.quotation_charges) {
      await client.query(`
        INSERT INTO quotation_charges (
          quotation_id, quotation_item_id, charge_type_id, charge_name,
          charge_scope, rate, quantity, unit, amount
        ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)
      `, [
        newQuotation.id,
        qch.charge_type_id,
        qch.charge_name,
        'quotation',
        qch.rate,
        qch.quantity,
        qch.unit,
        qch.amount,
      ]);
    }

    // Audit log
    await client.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, 'CREATE_QUOTATION', 'quotation', $2, $3)
    `, [req.user ? req.user.id : null, newQuotation.id, JSON.stringify({ number: quotationNumber, final_amount: calculated.final_amount })]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: {
        id: newQuotation.id,
        quotation_number: quotationNumber,
        final_amount: calculated.final_amount,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function updateQuotation(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      customer_id,
      customer_name,
      customer_mobile,
      customer_address,
      customer_city,
      customer_gstin,
      project_name,
      quotation_date,
      valid_until,
      status,
      items = [],
      quotation_charges = [],
      discount_amount = 0,
      manual_override_amount,
      is_override_applied,
      override_reason,
      is_gst_applied = false,
      gst_rate = 18.0,
      is_interstate = false,
      notes,
    } = req.body;

    const existingRes = await client.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    await client.query('BEGIN');

    // Use current or historical divisor and rate
    const existing = existingRes.rows[0];
    let effectiveCustomerId = customer_id || existing.customer_id;
    if (customer_name && customer_name.trim()) {
      const existingCust = await client.query(
        'SELECT id FROM customers WHERE (mobile_number = $1 AND mobile_number IS NOT NULL AND mobile_number != \'\') OR (customer_name ILIKE $2) LIMIT 1',
        [customer_mobile || null, customer_name.trim()]
      );
      if (existingCust.rows.length > 0) {
        effectiveCustomerId = existingCust.rows[0].id;
        await client.query(
          'UPDATE customers SET customer_name = $1, address = COALESCE($2, address), gstin = COALESCE($3, gstin), project_name = COALESCE($4, project_name) WHERE id = $5',
          [customer_name.trim(), customer_address || null, customer_gstin || null, project_name || null, effectiveCustomerId]
        );
      } else {
        const newCust = await client.query(
          'INSERT INTO customers (customer_name, mobile_number, address, city, state, gstin, project_name) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
          [customer_name.trim(), customer_mobile || null, customer_address || null, customer_city || 'Chennai', 'Tamil Nadu', customer_gstin || null, project_name || null]
        );
        effectiveCustomerId = newCust.rows[0].id;
      }
    }

    const divisor = parseFloat(existing.fixed_divisor) || 19.0;
    const rate = parseFloat(existing.multiplication_rate) || 175.0;

    const calculated = calculateQuotation({
      items,
      quotation_charges,
      discount_amount,
      manual_override_amount,
      is_override_applied,
      override_reason,
      divisor,
      rate,
      is_gst_applied,
      gst_rate,
      is_interstate,
    });

    await client.query(`
      UPDATE quotations SET
        customer_id = COALESCE($1, customer_id),
        project_name = $2,
        quotation_date = COALESCE($3, quotation_date),
        valid_until = $4,
        status = COALESCE($5, status),
        calculated_subtotal = $6,
        additional_charges_total = $7,
        discount_amount = $8,
        calculated_grand_total = $9,
        manual_override_amount = $10,
        is_override_applied = $11,
        override_reason = $12,
        final_amount = $13,
        is_gst_applied = $14,
        gst_rate = $15,
        taxable_amount = $16,
        tax_amount = $17,
        cgst_amount = $18,
        sgst_amount = $19,
        igst_amount = $20,
        notes = $21,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $22
    `, [
      effectiveCustomerId,
      project_name || null,
      quotation_date,
      valid_until || null,
      status || existing.status,
      calculated.calculated_subtotal,
      calculated.additional_charges_total,
      calculated.discount_amount,
      calculated.calculated_grand_total,
      calculated.manual_override_amount,
      calculated.is_override_applied,
      calculated.override_reason,
      calculated.final_amount,
      calculated.is_gst_applied || false,
      calculated.gst_rate || 0,
      calculated.taxable_amount || 0,
      calculated.total_tax_amount || 0,
      calculated.cgst_amount || 0,
      calculated.sgst_amount || 0,
      calculated.igst_amount || 0,
      notes || null,
      id,
    ]);

    // Remove old items and charges
    await client.query('DELETE FROM quotation_items WHERE quotation_id = $1', [id]);
    await client.query('DELETE FROM quotation_charges WHERE quotation_id = $1', [id]);

    // Re-insert items, components & charges
    for (let i = 0; i < calculated.items.length; i++) {
      const item = calculated.items[i];
      const itemRes = await client.query(`
        INSERT INTO quotation_items (
          quotation_id, item_index, window_name, window_type_id, window_type_name,
          width, height, measurement_unit, width_feet, height_feet, quantity,
          frame_running_feet, total_profile_value, window_profile_cost,
          window_charges_total, unit_cost, item_subtotal, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id
      `, [
        id,
        i + 1,
        item.window_name,
        item.window_type_id,
        item.window_type_name || '',
        item.width,
        item.height,
        item.measurement_unit,
        item.width_feet,
        item.height_feet,
        item.quantity,
        item.frame_running_feet,
        item.total_profile_value,
        item.window_profile_cost,
        item.window_charges_total,
        item.unit_cost,
        item.item_subtotal,
        item.remarks || null,
      ]);

      const itemId = itemRes.rows[0].id;

      for (const comp of item.components) {
        await client.query(`
          INSERT INTO window_components (
            quotation_item_id, profile_id, profile_name, profile_kg_snapshot,
            divisor_snapshot, profile_factor, running_feet, component_value, formula_note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          itemId,
          comp.profile_id,
          comp.profile_name,
          comp.profile_kg_snapshot,
          comp.divisor_snapshot,
          comp.profile_factor,
          comp.running_feet,
          comp.component_value,
          comp.formula_note,
        ]);
      }

      for (const ch of item.charges) {
        await client.query(`
          INSERT INTO quotation_charges (
            quotation_id, quotation_item_id, charge_type_id, charge_name,
            charge_scope, rate, quantity, unit, amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          id,
          itemId,
          ch.charge_type_id,
          ch.charge_name,
          'window',
          ch.rate,
          ch.quantity,
          ch.unit,
          ch.amount,
        ]);
      }
    }

    for (const qch of calculated.quotation_charges) {
      await client.query(`
        INSERT INTO quotation_charges (
          quotation_id, quotation_item_id, charge_type_id, charge_name,
          charge_scope, rate, quantity, unit, amount
        ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)
      `, [
        id,
        qch.charge_type_id,
        qch.charge_name,
        'quotation',
        qch.rate,
        qch.quantity,
        qch.unit,
        qch.amount,
      ]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Quotation updated successfully',
      data: { id, final_amount: calculated.final_amount },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function updateQuotationStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['Draft', 'Sent', 'Approved', 'Rejected', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await query(
      'UPDATE quotations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    res.json({
      success: true,
      message: `Quotation status updated to ${status}`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function duplicateQuotation(req, res, next) {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Fetch existing
    const qRes = await client.query('SELECT * FROM quotations WHERE id = $1', [id]);
    if (qRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }
    const orig = qRes.rows[0];

    await client.query('BEGIN');
    const newQuotationNumber = await generateQuotationNumber(client);

    const dupQRes = await client.query(`
      INSERT INTO quotations (
        quotation_number, customer_id, project_name, quotation_date, valid_until,
        status, fixed_divisor, multiplication_rate, calculated_subtotal,
        additional_charges_total, discount_amount, calculated_grand_total,
        manual_override_amount, is_override_applied, override_reason, final_amount,
        is_gst_applied, gst_rate, taxable_amount, tax_amount, cgst_amount, sgst_amount, igst_amount,
        notes, created_by
      ) VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '15 days', 'Draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *
    `, [
      newQuotationNumber,
      orig.customer_id,
      orig.project_name ? `${orig.project_name} (Copy)` : 'Copy',
      orig.fixed_divisor,
      orig.multiplication_rate,
      orig.calculated_subtotal,
      orig.additional_charges_total,
      orig.discount_amount,
      orig.calculated_grand_total,
      orig.manual_override_amount,
      orig.is_override_applied,
      orig.override_reason,
      orig.final_amount,
      orig.is_gst_applied || false,
      orig.gst_rate || 0,
      orig.taxable_amount || 0,
      orig.tax_amount || 0,
      orig.cgst_amount || 0,
      orig.sgst_amount || 0,
      orig.igst_amount || 0,
      `Duplicated from ${orig.quotation_number}`,
      req.user ? req.user.id : null,
    ]);

    const newQId = dupQRes.rows[0].id;

    // Duplicate items
    const itemsRes = await client.query('SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY item_index', [id]);
    for (const item of itemsRes.rows) {
      const newItemRes = await client.query(`
        INSERT INTO quotation_items (
          quotation_id, item_index, window_name, window_type_id, window_type_name,
          width, height, measurement_unit, width_feet, height_feet, quantity,
          frame_running_feet, total_profile_value, window_profile_cost,
          window_charges_total, unit_cost, item_subtotal, remarks
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING id
      `, [
        newQId, item.item_index, item.window_name, item.window_type_id, item.window_type_name,
        item.width, item.height, item.measurement_unit, item.width_feet, item.height_feet, item.quantity,
        item.frame_running_feet, item.total_profile_value, item.window_profile_cost,
        item.window_charges_total, item.unit_cost, item.item_subtotal, item.remarks,
      ]);
      const newItemId = newItemRes.rows[0].id;

      // Duplicate components
      const compRes = await client.query('SELECT * FROM window_components WHERE quotation_item_id = $1', [item.id]);
      for (const comp of compRes.rows) {
        await client.query(`
          INSERT INTO window_components (
            quotation_item_id, profile_id, profile_name, profile_kg_snapshot,
            divisor_snapshot, profile_factor, running_feet, component_value, formula_note
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          newItemId, comp.profile_id, comp.profile_name, comp.profile_kg_snapshot,
          comp.divisor_snapshot, comp.profile_factor, comp.running_feet, comp.component_value, comp.formula_note,
        ]);
      }

      // Duplicate window charges
      const chRes = await client.query('SELECT * FROM quotation_charges WHERE quotation_item_id = $1', [item.id]);
      for (const ch of chRes.rows) {
        await client.query(`
          INSERT INTO quotation_charges (
            quotation_id, quotation_item_id, charge_type_id, charge_name, charge_scope, rate, quantity, unit, amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          newQId, newItemId, ch.charge_type_id, ch.charge_name, 'window', ch.rate, ch.quantity, ch.unit, ch.amount,
        ]);
      }
    }

    // Duplicate quotation-level charges
    const qchRes = await client.query('SELECT * FROM quotation_charges WHERE quotation_id = $1 AND quotation_item_id IS NULL', [id]);
    for (const qch of qchRes.rows) {
      await client.query(`
        INSERT INTO quotation_charges (
          quotation_id, quotation_item_id, charge_type_id, charge_name, charge_scope, rate, quantity, unit, amount
        ) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8)
      `, [
        newQId, qch.charge_type_id, qch.charge_name, 'quotation', qch.rate, qch.quantity, qch.unit, qch.amount,
      ]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Quotation duplicated successfully',
      data: { id: newQId, quotation_number: newQuotationNumber },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function deleteQuotation(req, res, next) {
  try {
    const { id } = req.params;

    // Check if quotation has converted invoices
    const invCheck = await query('SELECT id FROM invoices WHERE quotation_id = $1 LIMIT 1', [id]);
    if (invCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete quotation that has linked invoices. Cancel it instead.',
      });
    }

    const result = await query('DELETE FROM quotations WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    res.json({
      success: true,
      message: 'Quotation deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  updateQuotationStatus,
  duplicateQuotation,
  deleteQuotation,
};
