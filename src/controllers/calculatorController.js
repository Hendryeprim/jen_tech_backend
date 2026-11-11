const { query } = require('../config/db');
const { calculateWindowItem, calculateQuotation } = require('../services/calculationEngine');

async function calculateWindow(req, res, next) {
  try {
    const { window_item } = req.body;

    if (!window_item) {
      return res.status(400).json({ success: false, message: 'window_item payload is required.' });
    }

    // Get current divisor & rate from settings
    const settingsRes = await query('SELECT fixed_divisor, multiplication_rate FROM company_settings LIMIT 1');
    const divisor = settingsRes.rows[0] ? parseFloat(settingsRes.rows[0].fixed_divisor) : 19.0;
    const rate = settingsRes.rows[0] ? parseFloat(settingsRes.rows[0].multiplication_rate) : 175.0;

    const result = calculateWindowItem(window_item, divisor, rate);

    res.json({
      success: true,
      data: result,
      meta: {
        fixed_divisor: divisor,
        multiplication_rate: rate,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function previewQuotation(req, res, next) {
  try {
    const { items = [], quotation_charges = [], discount_amount = 0, manual_override_amount, is_override_applied, override_reason } = req.body;

    const settingsRes = await query('SELECT fixed_divisor, multiplication_rate FROM company_settings LIMIT 1');
    const divisor = settingsRes.rows[0] ? parseFloat(settingsRes.rows[0].fixed_divisor) : 19.0;
    const rate = settingsRes.rows[0] ? parseFloat(settingsRes.rows[0].multiplication_rate) : 175.0;

    const result = calculateQuotation({
      items,
      quotation_charges,
      discount_amount,
      manual_override_amount,
      is_override_applied,
      override_reason,
      divisor,
      rate,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  calculateWindow,
  previewQuotation,
};
