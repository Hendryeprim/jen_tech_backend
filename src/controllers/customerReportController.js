const { query } = require('../config/db');

// List all customer report entries with search, sorting, and aggregate summary
async function getCustomerReports(req, res, next) {
  try {
    const { search, limit = 100, offset = 0 } = req.query;
    let sql = `SELECT * FROM customer_reports`;
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` WHERE (customer_name ILIKE $1 OR notes ILIKE $1)`;
    }

    sql += ` ORDER BY id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await query(sql, params);

    // Get overall KPI aggregates
    let aggSql = `
      SELECT 
        COUNT(*) AS total_count,
        COALESCE(SUM(sqf), 0) AS total_sqf,
        COALESCE(SUM(total_amount), 0) AS grand_total_amount,
        COALESCE(SUM(advance_amount), 0) AS grand_advance_amount,
        COALESCE(SUM(paid_amount), 0) AS grand_paid_amount,
        COALESCE(SUM(balance_amount), 0) AS grand_balance_amount
      FROM customer_reports
    `;
    const aggParams = [];
    if (search && search.trim()) {
      aggParams.push(`%${search.trim()}%`);
      aggSql += ` WHERE (customer_name ILIKE $1 OR notes ILIKE $1)`;
    }
    const aggResult = await query(aggSql, aggParams);

    res.json({
      success: true,
      data: result.rows,
      summary: aggResult.rows[0],
      total: parseInt(aggResult.rows[0].total_count, 10),
    });
  } catch (err) {
    next(err);
  }
}

// Get single report entry
async function getCustomerReportById(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM customer_reports WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report entry not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// Create new customer report entry
async function createCustomerReport(req, res, next) {
  try {
    const {
      customer_name,
      sqf = 0,
      total_amount = 0,
      advance_amount = 0,
      paid_amount = 0,
      balance_amount,
      entry_date,
      payment_status,
      notes,
      quotation_id,
      invoice_id,
      customer_id,
    } = req.body;

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer Name is required.' });
    }

    const parsedSqf = parseFloat(sqf) || 0;
    const parsedTotal = parseFloat(total_amount) || 0;
    const parsedAdvance = parseFloat(advance_amount) || 0;
    const parsedPaid = parseFloat(paid_amount) || 0;
    
    // Auto calculate balance if not explicitly provided
    const calculatedBalance =
      balance_amount !== undefined && balance_amount !== null && balance_amount !== ''
        ? parseFloat(balance_amount)
        : Math.max(0, parsedTotal - parsedAdvance - parsedPaid);

    // Auto determine payment status
    let status = payment_status;
    if (!status) {
      if (calculatedBalance <= 0 && parsedTotal > 0) {
        status = 'Paid';
      } else if (parsedAdvance > 0 || parsedPaid > 0) {
        status = 'Partially Paid';
      } else {
        status = 'Pending';
      }
    }

    const insertSql = `
      INSERT INTO customer_reports (
        customer_name, sqf, total_amount, advance_amount, paid_amount, balance_amount,
        entry_date, payment_status, notes, quotation_id, invoice_id, customer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const result = await query(insertSql, [
      customer_name.trim(),
      parsedSqf,
      parsedTotal,
      parsedAdvance,
      parsedPaid,
      calculatedBalance,
      entry_date || null,
      status,
      notes || null,
      quotation_id || null,
      invoice_id || null,
      customer_id || null,
    ]);

    res.status(201).json({
      success: true,
      message: 'Customer report entry created successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

// Update existing report entry
async function updateCustomerReport(req, res, next) {
  try {
    const { id } = req.params;
    const {
      customer_name,
      sqf,
      total_amount,
      advance_amount,
      paid_amount,
      balance_amount,
      entry_date,
      payment_status,
      notes,
    } = req.body;

    const existing = await query('SELECT * FROM customer_reports WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report entry not found.' });
    }

    const row = existing.rows[0];
    const newName = customer_name !== undefined ? customer_name.trim() : row.customer_name;
    const newSqf = sqf !== undefined ? parseFloat(sqf) || 0 : row.sqf;
    const newTotal = total_amount !== undefined ? parseFloat(total_amount) || 0 : row.total_amount;
    const newAdvance = advance_amount !== undefined ? parseFloat(advance_amount) || 0 : row.advance_amount;
    const newPaid = paid_amount !== undefined ? parseFloat(paid_amount) || 0 : row.paid_amount;
    
    let newBalance;
    if (balance_amount !== undefined && balance_amount !== null && balance_amount !== '') {
      newBalance = parseFloat(balance_amount);
    } else {
      newBalance = Math.max(0, newTotal - newAdvance - newPaid);
    }

    let newStatus = payment_status || row.payment_status;
    if (!payment_status) {
      if (newBalance <= 0 && newTotal > 0) {
        newStatus = 'Paid';
      } else if (newAdvance > 0 || newPaid > 0) {
        newStatus = 'Partially Paid';
      } else {
        newStatus = 'Pending';
      }
    }

    const updateSql = `
      UPDATE customer_reports SET
        customer_name = $1,
        sqf = $2,
        total_amount = $3,
        advance_amount = $4,
        paid_amount = $5,
        balance_amount = $6,
        entry_date = COALESCE($7::date, entry_date),
        payment_status = $8,
        notes = $9,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;

    const result = await query(updateSql, [
      newName,
      newSqf,
      newTotal,
      newAdvance,
      newPaid,
      newBalance,
      entry_date || null,
      newStatus,
      notes !== undefined ? notes : row.notes,
      id,
    ]);

    res.json({
      success: true,
      message: 'Report entry updated successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

// Delete entry
async function deleteCustomerReport(req, res, next) {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM customer_reports WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report entry not found.' });
    }
    res.json({ success: true, message: 'Report entry deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

// Auto import / sync from existing Quotations and Invoices
async function syncFromQuotations(req, res, next) {
  try {
    // Fetch quotations with total running sqft and final amount
    const quotes = await query(`
      SELECT 
        q.id AS quotation_id,
        q.customer_id,
        c.customer_name,
        q.quotation_number,
        q.final_amount,
        COALESCE(SUM(qi.width_feet * qi.height_feet * qi.quantity), 0) AS total_sqft
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      LEFT JOIN quotation_items qi ON qi.quotation_id = q.id
      GROUP BY q.id, c.customer_name
      ORDER BY q.id ASC
    `);

    let importedCount = 0;
    for (const q of quotes.rows) {
      // Check if already in customer_reports
      const check = await query('SELECT id FROM customer_reports WHERE quotation_id = $1', [q.quotation_id]);
      if (check.rows.length === 0 && q.customer_name) {
        await query(`
          INSERT INTO customer_reports (
            customer_name, sqf, total_amount, advance_amount, paid_amount, balance_amount,
            notes, quotation_id, customer_id
          ) VALUES ($1, $2, $3, 0, 0, $3, $4, $5, $6)
        `, [
          q.customer_name,
          parseFloat(q.total_sqft).toFixed(2),
          q.final_amount,
          `Imported from Quotation #${q.quotation_number}`,
          q.quotation_id,
          q.customer_id,
        ]);
        importedCount++;
      }
    }

    res.json({
      success: true,
      message: `Imported ${importedCount} records from existing quotations.`,
      importedCount,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCustomerReports,
  getCustomerReportById,
  createCustomerReport,
  updateCustomerReport,
  deleteCustomerReport,
  syncFromQuotations,
};

