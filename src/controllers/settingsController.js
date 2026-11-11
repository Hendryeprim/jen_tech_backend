const { query } = require('../config/db');

async function getSettings(req, res, next) {
  try {
    const result = await query('SELECT * FROM company_settings ORDER BY id ASC LIMIT 1');
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Settings not initialized.' });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const {
      company_name,
      tagline,
      logo_url,
      address_line1,
      address_line2,
      city,
      state,
      state_code,
      pincode,
      phone,
      email,
      website,
      gstin,
      pan,
      bank_name,
      bank_account_number,
      bank_ifsc,
      bank_branch,
      fixed_divisor,
      multiplication_rate,
      quotation_prefix,
      invoice_prefix,
      default_gst_rate,
      quotation_terms,
      invoice_terms,
    } = req.body;

    // Check if settings row exists
    let settingsRow = await query('SELECT id FROM company_settings LIMIT 1');
    if (settingsRow.rows.length === 0) {
      await query('INSERT INTO company_settings DEFAULT VALUES');
    }

    const result = await query(
      `UPDATE company_settings SET
         company_name = COALESCE($1, company_name),
         tagline = COALESCE($2, tagline),
         logo_url = COALESCE($3, logo_url),
         address_line1 = COALESCE($4, address_line1),
         address_line2 = COALESCE($5, address_line2),
         city = COALESCE($6, city),
         state = COALESCE($7, state),
         state_code = COALESCE($8, state_code),
         pincode = COALESCE($9, pincode),
         phone = COALESCE($10, phone),
         email = COALESCE($11, email),
         website = COALESCE($12, website),
         gstin = COALESCE($13, gstin),
         pan = COALESCE($14, pan),
         bank_name = COALESCE($15, bank_name),
         bank_account_number = COALESCE($16, bank_account_number),
         bank_ifsc = COALESCE($17, bank_ifsc),
         bank_branch = COALESCE($18, bank_branch),
         fixed_divisor = COALESCE($19, fixed_divisor),
         multiplication_rate = COALESCE($20, multiplication_rate),
         quotation_prefix = COALESCE($21, quotation_prefix),
         invoice_prefix = COALESCE($22, invoice_prefix),
         default_gst_rate = COALESCE($23, default_gst_rate),
         quotation_terms = COALESCE($24, quotation_terms),
         invoice_terms = COALESCE($25, invoice_terms),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [
        company_name || null,
        tagline !== undefined ? tagline : null,
        logo_url !== undefined ? logo_url : null,
        address_line1 !== undefined ? address_line1 : null,
        address_line2 !== undefined ? address_line2 : null,
        city !== undefined ? city : null,
        state !== undefined ? state : null,
        state_code !== undefined ? state_code : null,
        pincode !== undefined ? pincode : null,
        phone !== undefined ? phone : null,
        email !== undefined ? email : null,
        website !== undefined ? website : null,
        gstin !== undefined ? gstin : null,
        pan !== undefined ? pan : null,
        bank_name !== undefined ? bank_name : null,
        bank_account_number !== undefined ? bank_account_number : null,
        bank_ifsc !== undefined ? bank_ifsc : null,
        bank_branch !== undefined ? bank_branch : null,
        fixed_divisor !== undefined ? parseFloat(fixed_divisor) : null,
        multiplication_rate !== undefined ? parseFloat(multiplication_rate) : null,
        quotation_prefix || null,
        invoice_prefix || null,
        default_gst_rate !== undefined ? parseFloat(default_gst_rate) : null,
        quotation_terms !== undefined ? quotation_terms : null,
        invoice_terms !== undefined ? invoice_terms : null,
      ]
    );

    res.json({
      success: true,
      message: 'Company settings updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSettings,
  updateSettings,
};
