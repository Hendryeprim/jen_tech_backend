const { query } = require('../config/db');

// Generate next Way Bill number
async function generateWayBillNumber() {
  const year = new Date().getFullYear();
  const prefix = `JT-WB-${year}-`;
  const result = await query(
    `SELECT way_bill_number FROM way_bills WHERE way_bill_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (result.rows.length > 0) {
    const lastNumStr = result.rows[0].way_bill_number.replace(prefix, '');
    const parsed = parseInt(lastNumStr, 10);
    if (!isNaN(parsed)) {
      nextNum = parsed + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// Get all Way Bills
async function getWayBills(req, res, next) {
  try {
    const { search, status, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT * FROM way_bills WHERE 1=1`;
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (way_bill_number ILIKE $${params.length} OR consignee_name ILIKE $${params.length} OR vehicle_number ILIKE $${params.length} OR delivery_address ILIKE $${params.length})`;
    }

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ` ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sql, params);

    // Summary count
    const countRes = await query('SELECT COUNT(*) FROM way_bills');

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countRes.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
}

// Get single Way Bill with company settings
async function getWayBillById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM way_bills WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Way Bill not found.' });
    }

    const companyRes = await query('SELECT * FROM company_settings LIMIT 1');

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        company: companyRes.rows[0] || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// Create Way Bill
async function createWayBill(req, res, next) {
  try {
    const {
      way_bill_number,
      way_bill_date,
      dispatch_date,
      quotation_id,
      invoice_id,
      customer_id,
      consignee_name,
      consignee_phone,
      consignee_address,
      consignee_gstin,
      delivery_address,
      place_of_supply = 'Tamil Nadu',
      vehicle_number,
      transporter_name,
      driver_name,
      driver_phone,
      status = 'Dispatched',
      items = [],
      notes,
      terms,
    } = req.body;

    if (!consignee_name || !consignee_name.trim()) {
      return res.status(400).json({ success: false, message: 'Consignee / Customer name is required.' });
    }

    const finalBillNumber =
      way_bill_number && way_bill_number.trim()
        ? way_bill_number.trim()
        : await generateWayBillNumber();

    // Calculate totals
    let totalQty = 0;
    let totalSqf = 0;
    if (Array.isArray(items)) {
      items.forEach((item) => {
        const q = parseFloat(item.quantity) || 0;
        const s = parseFloat(item.sqf) || 0;
        totalQty += q;
        totalSqf += s;
      });
    }

    const defaultTerms =
      terms ||
      '1. Goods dispatched in safe condition as per order specifications.\n2. Receiver must verify quantities and inspect glass/UPVC finish upon arrival.\n3. Discrepancy if any must be noted on this way bill copy.\n4. Subject to Chennai jurisdiction.';

    const insertSql = `
      INSERT INTO way_bills (
        way_bill_number, way_bill_date, dispatch_date, quotation_id, invoice_id, customer_id,
        consignee_name, consignee_phone, consignee_address, consignee_gstin,
        delivery_address, place_of_supply, vehicle_number, transporter_name, driver_name, driver_phone,
        status, items, total_quantity, total_sqf, notes, terms, created_by
      ) VALUES (
        $1, COALESCE($2::date, CURRENT_DATE), COALESCE($3::date, CURRENT_DATE), $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, $18::jsonb, $19, $20, $21, $22, $23
      ) RETURNING *
    `;

    const result = await query(insertSql, [
      finalBillNumber,
      way_bill_date || null,
      dispatch_date || null,
      quotation_id || null,
      invoice_id || null,
      customer_id || null,
      consignee_name.trim(),
      consignee_phone || null,
      consignee_address || null,
      consignee_gstin || null,
      delivery_address || null,
      place_of_supply || 'Tamil Nadu',
      vehicle_number || null,
      transporter_name || null,
      driver_name || null,
      driver_phone || null,
      status || 'Dispatched',
      JSON.stringify(items || []),
      totalQty,
      parseFloat(totalSqf.toFixed(2)),
      notes || null,
      defaultTerms,
      req.user?.id || null,
    ]);

    res.status(201).json({
      success: true,
      message: 'Way Bill created successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

// Update Way Bill
async function updateWayBill(req, res, next) {
  try {
    const { id } = req.params;
    const {
      way_bill_date,
      dispatch_date,
      consignee_name,
      consignee_phone,
      consignee_address,
      consignee_gstin,
      delivery_address,
      place_of_supply,
      vehicle_number,
      transporter_name,
      driver_name,
      driver_phone,
      status,
      items,
      notes,
      terms,
    } = req.body;

    const existing = await query('SELECT * FROM way_bills WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Way Bill not found.' });
    }

    const row = existing.rows[0];
    const finalItems = items !== undefined ? items : row.items;

    let totalQty = 0;
    let totalSqf = 0;
    if (Array.isArray(finalItems)) {
      finalItems.forEach((item) => {
        totalQty += parseFloat(item.quantity) || 0;
        totalSqf += parseFloat(item.sqf) || 0;
      });
    }

    const updateSql = `
      UPDATE way_bills SET
        way_bill_date = COALESCE($1::date, way_bill_date),
        dispatch_date = COALESCE($2::date, dispatch_date),
        consignee_name = COALESCE($3, consignee_name),
        consignee_phone = COALESCE($4, consignee_phone),
        consignee_address = COALESCE($5, consignee_address),
        consignee_gstin = COALESCE($6, consignee_gstin),
        delivery_address = COALESCE($7, delivery_address),
        place_of_supply = COALESCE($8, place_of_supply),
        vehicle_number = COALESCE($9, vehicle_number),
        transporter_name = COALESCE($10, transporter_name),
        driver_name = COALESCE($11, driver_name),
        driver_phone = COALESCE($12, driver_phone),
        status = COALESCE($13, status),
        items = $14::jsonb,
        total_quantity = $15,
        total_sqf = $16,
        notes = COALESCE($17, notes),
        terms = COALESCE($18, terms),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $19
      RETURNING *
    `;

    const result = await query(updateSql, [
      way_bill_date || null,
      dispatch_date || null,
      consignee_name,
      consignee_phone,
      consignee_address,
      consignee_gstin,
      delivery_address,
      place_of_supply,
      vehicle_number,
      transporter_name,
      driver_name,
      driver_phone,
      status,
      JSON.stringify(finalItems),
      totalQty,
      parseFloat(totalSqf.toFixed(2)),
      notes,
      terms,
      id,
    ]);

    res.json({
      success: true,
      message: 'Way Bill updated successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

// Delete Way Bill
async function deleteWayBill(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM way_bills WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Way Bill not found.' });
    }
    res.json({ success: true, message: 'Way Bill deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

// Prefill items from a quotation
async function getPrefillFromQuotation(req, res, next) {
  try {
    const { id } = req.params;
    const quoteRes = await query(`
      SELECT q.*, c.customer_name, c.mobile_number, c.address, c.city, c.state, c.gstin
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE q.id = $1
    `, [id]);

    if (quoteRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Quotation not found.' });
    }

    const quote = quoteRes.rows[0];
    const itemsRes = await query(`
      SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY item_index ASC
    `, [id]);

    const items = itemsRes.rows.map((item, idx) => ({
      s_no: idx + 1,
      description: `${item.window_name} (${item.window_type_name} - ${item.panel_configuration || 'Standard'})`,
      dimensions: `${item.width}' x ${item.height}'`,
      quantity: item.quantity,
      sqf: parseFloat((item.width_feet * item.height_feet * item.quantity).toFixed(2)),
      remarks: item.remarks || 'UPVC Fabricated Unit',
    }));

    res.json({
      success: true,
      data: {
        quotation_id: quote.id,
        customer_id: quote.customer_id,
        consignee_name: quote.customer_name,
        consignee_phone: quote.mobile_number,
        consignee_address: [quote.address, quote.city, quote.state].filter(Boolean).join(', '),
        consignee_gstin: quote.gstin,
        delivery_address: quote.project_name || [quote.address, quote.city].filter(Boolean).join(', '),
        items,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getWayBills,
  getWayBillById,
  createWayBill,
  updateWayBill,
  deleteWayBill,
  getPrefillFromQuotation,
};

