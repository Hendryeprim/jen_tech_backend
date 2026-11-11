const { pool, query } = require('../config/db');
const { calculateGstInvoice, calculateWithoutGstInvoice } = require('../services/calculationEngine');

// Generate unique invoice number
async function generateInvoiceNumber(client) {
  const settingsRes = await client.query('SELECT invoice_prefix FROM company_settings LIMIT 1');
  const prefix = (settingsRes.rows[0] && settingsRes.rows[0].invoice_prefix) || 'JT-INV-';
  const year = new Date().getFullYear();

  const searchPattern = `${prefix}${year}-%`;
  const latestRes = await client.query(
    'SELECT invoice_number FROM invoices WHERE invoice_number LIKE $1 ORDER BY id DESC LIMIT 1',
    [searchPattern]
  );

  let nextSequence = 1;
  if (latestRes.rows.length > 0) {
    const parts = latestRes.rows[0].invoice_number.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSequence = lastSeq + 1;
    }
  }

  const seqStr = String(nextSequence).padStart(4, '0');
  return `${prefix}${year}-${seqStr}`;
}

async function getInvoices(req, res, next) {
  try {
    const { search, invoice_type, payment_status, customer_id, start_date, end_date, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT i.*, c.customer_name, c.mobile_number, c.city, q.quotation_number
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN quotations q ON i.quotation_id = q.id
    `;
    const params = [];
    const conditions = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(i.invoice_number ILIKE $${params.length} OR c.customer_name ILIKE $${params.length} OR c.mobile_number ILIKE $${params.length} OR i.project_name ILIKE $${params.length})`);
    }

    if (invoice_type) {
      params.push(invoice_type);
      conditions.push(`i.invoice_type = $${params.length}`);
    }

    if (payment_status) {
      params.push(payment_status);
      conditions.push(`i.payment_status = $${params.length}`);
    }

    if (customer_id) {
      params.push(customer_id);
      conditions.push(`i.customer_id = $${params.length}`);
    }

    if (start_date) {
      params.push(start_date);
      conditions.push(`i.invoice_date >= $${params.length}`);
    }

    if (end_date) {
      params.push(end_date);
      conditions.push(`i.invoice_date <= $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ` ORDER BY i.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sql, params);

    // Count
    let countSql = `
      SELECT COUNT(*)
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
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

async function getInvoiceById(req, res, next) {
  try {
    const { id } = req.params;

    const invRes = await query(`
      SELECT i.*, c.customer_name, c.mobile_number, c.email AS customer_email,
             c.address AS customer_address, c.city AS customer_city, c.state AS customer_state,
             c.state_code AS customer_state_code, c.gstin AS customer_gstin_actual,
             q.quotation_number, u.name AS creator_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      LEFT JOIN quotations q ON i.quotation_id = q.id
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1
    `, [id]);

    if (invRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    const invoice = invRes.rows[0];

    // Fetch items
    const itemsRes = await query(`
      SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY item_index ASC
    `, [id]);
    invoice.items = itemsRes.rows;

    // Fetch tax details
    const taxRes = await query(`
      SELECT * FROM invoice_tax_details WHERE invoice_id = $1 ORDER BY id ASC
    `, [id]);
    invoice.tax_details = taxRes.rows;

    // Fetch company settings for invoice header / bank details
    const settingsRes = await query('SELECT * FROM company_settings LIMIT 1');
    invoice.company = settingsRes.rows[0] || {};

    res.json({
      success: true,
      data: invoice,
    });
  } catch (err) {
    next(err);
  }
}

async function createInvoice(req, res, next) {
  const client = await pool.connect();
  try {
    const {
      invoice_type = 'GST',
      quotation_id,
      customer_id,
      customer_name,
      customer_mobile,
      customer_address,
      customer_city,
      project_name,
      delivery_to,
      invoice_date = new Date().toISOString().split('T')[0],
      due_date,
      place_of_supply,
      customer_gstin,
      is_interstate = false,
      gst_rate = 18.0,
      discount_amount = 0,
      material_cost = 0,
      additional_charges_total = 0,
      taxable_amount = 0,
      items = [],
      payment_status = 'Unpaid',
      payment_mode,
      notes,
      terms_and_conditions,
    } = req.body;

    await client.query('BEGIN');

    let effectiveCustomerId = customer_id ? parseInt(customer_id, 10) : null;
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
      return res.status(400).json({ success: false, message: 'Customer name is required for invoice.' });
    }

    // Fetch company details for GSTIN and state
    const settingsRes = await client.query('SELECT * FROM company_settings LIMIT 1');
    const company = settingsRes.rows[0] || {};
    const companyGstin = company.gstin || '';

    // Calculate invoice totals based on invoice_type
    let calcResults;
    if (invoice_type === 'GST') {
      calcResults = calculateGstInvoice({
        taxable_amount: parseFloat(taxable_amount) || (parseFloat(material_cost) + parseFloat(additional_charges_total)),
        material_cost,
        additional_charges_total,
        items,
        is_interstate: Boolean(is_interstate),
        gst_rate: parseFloat(gst_rate) || 18.0,
        discount_amount,
      });
    } else {
      calcResults = calculateWithoutGstInvoice({
        taxable_amount,
        material_cost,
        additional_charges_total,
        items,
        discount_amount,
      });
    }

    const invoiceNumber = await generateInvoiceNumber(client);

    const invInsertRes = await client.query(`
      INSERT INTO invoices (
        invoice_number, invoice_type, quotation_id, customer_id, project_name, delivery_to,
        invoice_date, due_date, company_gstin, customer_gstin, place_of_supply,
        state_code, is_interstate, taxable_amount, material_cost, additional_charges_total,
        subtotal, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
        total_tax_amount, discount_amount, round_off, final_amount, payment_status,
        payment_mode, notes, terms_and_conditions, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
      RETURNING *
    `, [
      invoiceNumber,
      invoice_type,
      quotation_id || null,
      effectiveCustomerId,
      project_name || null,
      delivery_to || null,
      invoice_date,
      due_date || null,
      invoice_type === 'GST' ? companyGstin : null,
      invoice_type === 'GST' ? (customer_gstin || null) : null,
      place_of_supply || 'Hanumantharayankottai, Dindigul',
      company.state_code || '33',
      calcResults.is_interstate || false,
      calcResults.taxable_amount || calcResults.subtotal || 0,
      parseFloat(material_cost) || 0,
      parseFloat(additional_charges_total) || 0,
      calcResults.subtotal,
      calcResults.cgst_rate,
      calcResults.cgst_amount,
      calcResults.sgst_rate,
      calcResults.sgst_amount,
      calcResults.igst_rate,
      calcResults.igst_amount,
      calcResults.total_tax_amount,
      calcResults.discount_amount,
      calcResults.round_off,
      calcResults.final_amount,
      payment_status,
      payment_mode || null,
      notes || null,
      terms_and_conditions || company.invoice_terms || null,
      req.user ? req.user.id : null,
    ]);

    const newInvoice = invInsertRes.rows[0];

    // Insert invoice items
    if (Array.isArray(items) && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const unitPrice = parseFloat(it.unit_price) || 0;
        const qty = parseFloat(it.quantity) || 1;
        const total = parseFloat(it.item_total) || (unitPrice * qty);
        const taxable = parseFloat(it.taxable_value) || total;
        const width = it.width !== undefined && it.width !== '' && it.width !== null ? parseFloat(it.width) : null;
        const height = it.height !== undefined && it.height !== '' && it.height !== null ? parseFloat(it.height) : null;
        const totalSft = it.total_sft !== undefined && it.total_sft !== '' && it.total_sft !== null
          ? parseFloat(it.total_sft)
          : (width && height && qty ? parseFloat((width * height * qty).toFixed(2)) : null);
        const pricePerSft = it.price_per_sft !== undefined && it.price_per_sft !== '' && it.price_per_sft !== null
          ? parseFloat(it.price_per_sft)
          : (totalSft && totalSft > 0 ? parseFloat((total / totalSft).toFixed(2)) : null);

        await client.query(`
          INSERT INTO invoice_items (
            invoice_id, item_index, description, width, height, total_sft, price_per_sft,
            hsn_code, quantity, unit, unit_price, item_total, taxable_value
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          newInvoice.id,
          i + 1,
          it.description || `Item ${i + 1}`,
          width,
          height,
          totalSft,
          pricePerSft,
          it.hsn_code || '39252000',
          qty,
          it.unit || 'Nos',
          unitPrice,
          total,
          taxable,
        ]);
      }
    } else {
      // Default single summary item
      await client.query(`
        INSERT INTO invoice_items (
          invoice_id, item_index, description, hsn_code, quantity, unit, unit_price, item_total, taxable_value
        ) VALUES ($1, 1, $2, '39252000', 1, 'Lot', $3, $3, $3)
      `, [
        newInvoice.id,
        `UPVC Architectural Window & Glazing Systems (${project_name || 'Project'})`,
        calcResults.taxable_amount,
      ]);
    }

    // Insert tax details if GST invoice
    if (invoice_type === 'GST' && calcResults.total_tax_amount > 0) {
      await client.query(`
        INSERT INTO invoice_tax_details (
          invoice_id, hsn_sac, taxable_value, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount, total_tax
        ) VALUES ($1, '7610', $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        newInvoice.id,
        calcResults.taxable_amount,
        calcResults.cgst_rate,
        calcResults.cgst_amount,
        calcResults.sgst_rate,
        calcResults.sgst_amount,
        calcResults.igst_rate,
        calcResults.igst_amount,
        calcResults.total_tax_amount,
      ]);
    }

    // If converted from a quotation, update quotation status to Approved or Completed
    if (quotation_id) {
      await client.query(
        "UPDATE quotations SET status = 'Approved', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'Draft'",
        [quotation_id]
      );
    }

    // Audit log
    await client.query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
      VALUES ($1, 'CREATE_INVOICE', 'invoice', $2, $3)
    `, [req.user ? req.user.id : null, newInvoice.id, JSON.stringify({ number: invoiceNumber, type: invoice_type, final_amount: calcResults.final_amount })]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `${invoice_type === 'GST' ? 'GST Tax Invoice' : 'Without-GST Invoice'} generated successfully`,
      data: {
        id: newInvoice.id,
        invoice_number: invoiceNumber,
        final_amount: calcResults.final_amount,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
}

async function updateInvoiceStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { payment_status, payment_mode } = req.body;

    const validStatuses = ['Unpaid', 'Partially Paid', 'Paid', 'Cancelled'];
    if (!validStatuses.includes(payment_status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await query(
      `UPDATE invoices SET
         payment_status = $1,
         payment_mode = COALESCE($2, payment_mode),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [payment_status, payment_mode || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    res.json({
      success: true,
      message: `Invoice payment status updated to ${payment_status}`,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function deleteInvoice(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM invoices WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Invoice not found.' });
    }

    res.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoiceStatus,
  deleteInvoice,
};
