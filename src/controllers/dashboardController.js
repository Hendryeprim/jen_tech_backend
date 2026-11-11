const { query } = require('../config/db');

async function getDashboardStats(req, res, next) {
  try {
    // 1. Total Customers
    const customerCountRes = await query('SELECT COUNT(*) FROM customers');
    const totalCustomers = parseInt(customerCountRes.rows[0].count, 10);

    // 2. Quotation Stats
    const quotationStatsRes = await query(`
      SELECT 
        COUNT(*) AS total_quotations,
        COUNT(*) FILTER (WHERE status IN ('Draft', 'Sent')) AS pending_quotations,
        COUNT(*) FILTER (WHERE status = 'Approved') AS approved_quotations,
        COALESCE(SUM(final_amount), 0) AS total_quotation_value
      FROM quotations
    `);
    const qStats = quotationStatsRes.rows[0];

    // 3. Invoice Stats
    const invoiceStatsRes = await query(`
      SELECT
        COUNT(*) AS total_invoices,
        COUNT(*) FILTER (WHERE invoice_type = 'GST') AS gst_invoices,
        COUNT(*) FILTER (WHERE invoice_type = 'WITHOUT_GST') AS without_gst_invoices,
        COUNT(*) FILTER (WHERE payment_status = 'Paid') AS paid_invoices,
        COUNT(*) FILTER (WHERE payment_status = 'Unpaid') AS unpaid_invoices,
        COALESCE(SUM(final_amount), 0) AS total_invoice_value,
        COALESCE(SUM(final_amount) FILTER (WHERE payment_status = 'Paid'), 0) AS collected_revenue
      FROM invoices
    `);
    const iStats = invoiceStatsRes.rows[0];

    // 4. Recent Quotations (last 5)
    const recentQuotationsRes = await query(`
      SELECT q.id, q.quotation_number, q.project_name, q.quotation_date, q.status, q.final_amount,
             c.customer_name, c.mobile_number, c.city
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
      ORDER BY q.created_at DESC
      LIMIT 5
    `);

    // 5. Recent Invoices (last 5)
    const recentInvoicesRes = await query(`
      SELECT i.id, i.invoice_number, i.invoice_type, i.invoice_date, i.payment_status, i.final_amount,
             c.customer_name, c.mobile_number, c.city
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      ORDER BY i.created_at DESC
      LIMIT 5
    `);

    // 6. Window Types breakdown
    const windowTypesRes = await query(`
      SELECT wt.name, COUNT(qi.id) AS count
      FROM window_types wt
      LEFT JOIN quotation_items qi ON qi.window_type_id = wt.id
      GROUP BY wt.id, wt.name
      ORDER BY wt.sort_order ASC
    `);

    res.json({
      success: true,
      data: {
        totalCustomers,
        totalQuotations: parseInt(qStats.total_quotations, 10),
        pendingQuotations: parseInt(qStats.pending_quotations, 10),
        approvedQuotations: parseInt(qStats.approved_quotations, 10),
        totalQuotationValue: parseFloat(qStats.total_quotation_value),
        totalInvoices: parseInt(iStats.total_invoices, 10),
        gstInvoices: parseInt(iStats.gst_invoices, 10),
        withoutGstInvoices: parseInt(iStats.without_gst_invoices, 10),
        paidInvoices: parseInt(iStats.paid_invoices, 10),
        unpaidInvoices: parseInt(iStats.unpaid_invoices, 10),
        totalInvoiceValue: parseFloat(iStats.total_invoice_value),
        collectedRevenue: parseFloat(iStats.collected_revenue),
        recentQuotations: recentQuotationsRes.rows,
        recentInvoices: recentInvoicesRes.rows,
        windowTypeDistribution: windowTypesRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboardStats,
};
