const { query } = require('../config/db');

async function getCustomers(req, res, next) {
  try {
    const { search, limit = 50, offset = 0 } = req.query;
    let sql = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM quotations q WHERE q.customer_id = c.id) AS total_quotations,
        (SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id) AS total_invoices
      FROM customers c
    `;
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` WHERE (c.customer_name ILIKE $1 OR c.mobile_number ILIKE $1 OR c.email ILIKE $1 OR c.city ILIKE $1 OR c.project_name ILIKE $1)`;
    }

    sql += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sql, params);

    // Count total
    let countSql = 'SELECT COUNT(*) FROM customers';
    const countParams = [];
    if (search && search.trim()) {
      countParams.push(`%${search.trim()}%`);
      countSql += ' WHERE (customer_name ILIKE $1 OR mobile_number ILIKE $1 OR email ILIKE $1 OR city ILIKE $1 OR project_name ILIKE $1)';
    }
    const countResult = await query(countSql, countParams);

    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    });
  } catch (err) {
    next(err);
  }
}

async function getCustomerById(req, res, next) {
  try {
    const { id } = req.params;
    const customerRes = await query('SELECT * FROM customers WHERE id = $1', [id]);
    if (customerRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    // Fetch customer's quotation history
    const quotesRes = await query(
      'SELECT id, quotation_number, project_name, quotation_date, status, final_amount FROM quotations WHERE customer_id = $1 ORDER BY quotation_date DESC',
      [id]
    );

    // Fetch customer's invoice history
    const invoicesRes = await query(
      'SELECT id, invoice_number, invoice_type, invoice_date, payment_status, final_amount FROM invoices WHERE customer_id = $1 ORDER BY invoice_date DESC',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...customerRes.rows[0],
        quotations: quotesRes.rows,
        invoices: invoicesRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const {
      customer_name,
      mobile_number,
      email,
      address,
      city,
      state = 'Tamil Nadu',
      state_code = '33',
      gstin,
      project_name,
      notes,
    } = req.body;

    if (!customer_name || !mobile_number) {
      return res.status(400).json({ success: false, message: 'Customer Name and Mobile Number are required.' });
    }

    const result = await query(
      `INSERT INTO customers (customer_name, mobile_number, email, address, city, state, state_code, gstin, project_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        customer_name.trim(),
        mobile_number.trim(),
        email ? email.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        state,
        state_code,
        gstin ? gstin.trim().toUpperCase() : null,
        project_name ? project_name.trim() : null,
        notes ? notes.trim() : null,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const {
      customer_name,
      mobile_number,
      email,
      address,
      city,
      state,
      state_code,
      gstin,
      project_name,
      notes,
    } = req.body;

    if (!customer_name || !mobile_number) {
      return res.status(400).json({ success: false, message: 'Customer Name and Mobile Number are required.' });
    }

    const result = await query(
      `UPDATE customers SET 
         customer_name = $1,
         mobile_number = $2,
         email = $3,
         address = $4,
         city = $5,
         state = $6,
         state_code = $7,
         gstin = $8,
         project_name = $9,
         notes = $10,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $11
       RETURNING *`,
      [
        customer_name.trim(),
        mobile_number.trim(),
        email ? email.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        state || 'Tamil Nadu',
        state_code || '33',
        gstin ? gstin.trim().toUpperCase() : null,
        project_name ? project_name.trim() : null,
        notes ? notes.trim() : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    const { id } = req.params;

    // Check if customer is referenced in quotations or invoices
    const quoteCheck = await query('SELECT id FROM quotations WHERE customer_id = $1 LIMIT 1', [id]);
    if (quoteCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer with existing quotations. Archive customer instead.',
      });
    }

    const invCheck = await query('SELECT id FROM invoices WHERE customer_id = $1 LIMIT 1', [id]);
    if (invCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer with existing invoices.',
      });
    }

    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    res.json({
      success: true,
      message: 'Customer deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
