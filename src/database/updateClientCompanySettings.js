const { query } = require('../config/db');

async function updateClientCompanySettings() {
  await query(`
    UPDATE company_settings SET
      company_name = 'JEN TECH',
      address_line1 = 'Palani Main Road, Kannivadi',
      address_line2 = 'Hanumantharayan kottai',
      city = 'Dindigul',
      pincode = '624705',
      state = 'Tamil Nadu',
      state_code = '33',
      phone = '90471 85768 - 72001 55362',
      email = 'thejentech@gmail.com',
      gstin = '33AAXPE9519R2ZP',
      pan = 'AAYFK8367L',
      bank_name = 'CANARA BANK',
      bank_account_number = '120029943933',
      bank_ifsc = 'CNRB0016202',
      bank_branch = 'Nagal Nagar, Dindigul',
      quotation_terms = '1. Quote incl. of Window Glass & Installation charges.\n2. Cooling Glass uses for windows.\n3. Scaffolding & electricity supply has to be provided by the customer.\n4. Payment 50% Advance , 25% before fitting ,25% after fitting.',
      invoice_terms = 'We declare that the above particulars are true and correct in our belief and knowledge.'
  `);
  console.log('[Success] Company settings updated with exact client details from photos!');
  process.exit(0);
}

updateClientCompanySettings().catch((err) => {
  console.error('[Error]', err);
  process.exit(1);
});
