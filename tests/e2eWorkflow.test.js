const test = require('node:test');
const assert = require('node:assert/strict');
const calculationEngine = require('../src/services/calculationEngine');
const { query, pool } = require('../src/config/db');

test('JEN TECH End-To-End System & Calculation Integrity Tests', async (t) => {
  await t.test('1. Verify Company Settings Divisor (19) and Rate (175)', async () => {
    const res = await query('SELECT * FROM company_settings LIMIT 1');
    assert.equal(res.rows.length, 1);
    const s = res.rows[0];
    assert.equal(parseFloat(s.profile_divisor), 19);
    assert.equal(parseFloat(s.profile_rate), 175);
    assert.ok(s.company_name.startsWith('JEN TECH'));
  });

  await t.test('2. Verify All 6 Required Client Notebook Window Models Exist in PostgreSQL', async () => {
    const res = await query('SELECT code, name, category, panel_options FROM window_types ORDER BY sort_order');
    const codes = res.rows.map((r) => r.code);
    assert.ok(codes.includes('SLIDING_WINDOW_BIG'), 'Must include Sliding window - Big');
    assert.ok(codes.includes('SLIDING_WINDOW_SMALL'), 'Must include Sliding window - Small');
    assert.ok(codes.includes('SLIDING_MESH_BIG'), 'Must include Sliding with mesh - Big');
    assert.ok(codes.includes('SLIDING_MESH_SMALL'), 'Must include Sliding with mesh - Small');
    assert.ok(codes.includes('TRACK_3_SLIDING'), 'Must include 3-track sliding window');
    assert.ok(codes.includes('OPEN_WINDOW'), 'Must include Open window');

    // Verify panel configurations exist
    for (const r of res.rows) {
      assert.ok(r.panel_options !== null && r.panel_options !== undefined);
    }
  });

  await t.test('3. Verify Exact Calculation From Section 4 of Requirements Document', async () => {
    // Window Model: UPVC Sliding Window
    // Size: 3 x 4 Feet
    // Component: Frame
    // Profile KG Value: 6.785
    // Running Feet: 14
    // Profile Factor: 6.785 / 19 = 0.3571052632
    // Component Calculation Value: 14 * 0.3571052632 = 4.9994736848
    // Profile Rate: 175
    // Component Cost: 4.9994736848 * 175 = 874.90789484 -> 874.91
    const component = {
      profile_name: 'Frame',
      profile_kg: 6.785,
      running_feet: 14,
    };

    const calculated = calculationEngine.calculateComponent(component, 19, 175);
    assert.equal(calculated.profile_factor.toFixed(6), '0.357105');
    assert.equal(calculated.component_value.toFixed(6), '4.999474');
    assert.equal(calculated.component_cost.toFixed(2), '874.91');
  });

  await t.test('4. Verify Rectangular Outer Frame: 2W + 2H = 14 Feet for 3x4 ft Window', async () => {
    const frame = calculationEngine.calculateFrameRunningFeet(3, 4, 'Feet');
    assert.equal(frame.top, 3);
    assert.equal(frame.bottom, 3);
    assert.equal(frame.left, 4);
    assert.equal(frame.right, 4);
    assert.equal(frame.total_running_feet, 14);
  });

  await t.test('5. Verify Inches conversion: 36 in x 48 in = 3 ft x 4 ft => 14 ft', async () => {
    const frame = calculationEngine.calculateFrameRunningFeet(36, 48, 'Inches');
    assert.equal(frame.width_feet, 3);
    assert.equal(frame.height_feet, 4);
    assert.equal(frame.total_running_feet, 14);
  });

  await t.test('6. Verify Multi-Window Quotation Calculation with Quantities & Additional Charges', async () => {
    const quotationPayload = {
      items: [
        {
          item_index: 1,
          window_name: 'Living Room 2-Panel Sliding Window',
          panel_configuration: '2-Panel',
          width: 3,
          height: 4,
          measurement_unit: 'Feet',
          quantity: 2,
          components: [
            { profile_name: 'Frame', profile_kg: 6.785, running_feet: 14 },
            { profile_name: '56 Sash', profile_kg: 5.074, running_feet: 14 },
          ],
          charges: [
            { charge_name: 'Touch Lock', rate: 250, quantity: 2, unit: 'Nos' },
            { charge_name: 'Glass', rate: 95, quantity: 12, unit: 'Sq.Ft' },
          ],
        },
        {
          item_index: 2,
          window_name: 'Bedroom Openable Window',
          panel_configuration: 'Single Shutter Openable',
          width: 2.5,
          height: 4,
          measurement_unit: 'Feet',
          quantity: 1,
          components: [
            { profile_name: 'Frame', profile_kg: 6.018, running_feet: 13 },
          ],
          charges: [
            { charge_name: 'Labour', rate: 450, quantity: 1, unit: 'Nos' },
          ],
        },
      ],
      quotation_charges: [
        { charge_name: 'Transportation', rate: 1500, quantity: 1, unit: 'Lump Sum' },
      ],
      discount_amount: 500,
    };

    const preview = calculationEngine.calculateQuotation(quotationPayload, 19, 175);
    assert.equal(preview.items.length, 2);
    assert.ok(preview.calculated_grand_total > 0);
    assert.equal(preview.additional_charges_total, 1500);
    assert.equal(preview.discount_amount, 500);
    assert.equal(
      preview.final_amount,
      Number((preview.calculated_subtotal + 1500 - 500).toFixed(2))
    );
  });

  await t.test('7. Verify Intra-State GST Tax: 9% CGST + 9% SGST and 0% IGST', async () => {
    const gstResult = calculationEngine.calculateGstInvoice({
      items: [
        { description: 'Window System 1', quantity: 2, unit_price: 5000 },
        { description: 'Glazing Charges', quantity: 1, unit_price: 2000 },
      ],
      is_interstate: false,
      cgst_rate: 9,
      sgst_rate: 9,
      igst_rate: 18,
      discount_amount: 0,
    });

    assert.equal(gstResult.taxable_amount, 12000);
    assert.equal(gstResult.cgst_amount, 1080);
    assert.equal(gstResult.sgst_amount, 1080);
    assert.equal(gstResult.igst_amount, 0);
    assert.equal(gstResult.total_tax_amount, 2160);
    assert.equal(gstResult.final_amount, 14160);
  });

  await t.test('8. Verify Inter-State GST Tax: 18% IGST and 0% CGST/SGST', async () => {
    const gstResult = calculationEngine.calculateGstInvoice({
      items: [
        { description: 'Export Window Fabrication', quantity: 1, unit_price: 10000 },
      ],
      is_interstate: true,
      cgst_rate: 9,
      sgst_rate: 9,
      igst_rate: 18,
      discount_amount: 0,
    });

    assert.equal(gstResult.taxable_amount, 10000);
    assert.equal(gstResult.cgst_amount, 0);
    assert.equal(gstResult.sgst_amount, 0);
    assert.equal(gstResult.igst_amount, 1800);
    assert.equal(gstResult.total_tax_amount, 1800);
    assert.equal(gstResult.final_amount, 11800);
  });

  await t.test('9. Verify Non-GST Invoice Strictly Excludes Any Separately Charged Tax', async () => {
    const nonGstResult = calculationEngine.calculateNonGstInvoice({
      material_cost: 15000,
      additional_charges_total: 3500,
      discount_amount: 500,
    });

    assert.equal(nonGstResult.material_cost, 15000);
    assert.equal(nonGstResult.additional_charges_total, 3500);
    assert.equal(nonGstResult.subtotal, 18500);
    assert.equal(nonGstResult.discount_amount, 500);
    assert.equal(nonGstResult.final_amount, 18000);
    // Explicitly check that tax is 0.00
    assert.equal(nonGstResult.cgst_amount, 0);
    assert.equal(nonGstResult.sgst_amount, 0);
    assert.equal(nonGstResult.igst_amount, 0);
    assert.equal(nonGstResult.total_tax_amount, 0);
  });

  await t.test('10. Verify Historical Records Immutability in PostgreSQL', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Create temporary customer
      const custRes = await client.query(
        "INSERT INTO customers (customer_name, mobile_number) VALUES ('Test Immutability Client', '9999999999') RETURNING id"
      );
      const custId = custRes.rows[0].id;

      // Insert quotation with specific divisor & rate snapshots
      const qRes = await client.query(
        `INSERT INTO quotations (
          quotation_number, customer_id, project_name, quotation_date,
          fixed_divisor, multiplication_rate, calculated_subtotal,
          additional_charges_total, discount_amount, calculated_grand_total, final_amount, status
        ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10, 'Draft') RETURNING *`,
        ['JT-Q-TEST-0001', custId, 'Test Project', 19.0, 175.0, 6000.0, 492.66, 0, 6492.66, 6492.66]
      );
      const originalQuotation = qRes.rows[0];

      // Fetch snapshot divisor and rate stored with the quotation
      assert.equal(parseFloat(originalQuotation.fixed_divisor), 19);
      assert.equal(parseFloat(originalQuotation.multiplication_rate), 175);
      assert.equal(parseFloat(originalQuotation.final_amount), 6492.66);

      // Insert an item & window component snapshot
      const wtRes = await client.query('SELECT id, name FROM window_types ORDER BY sort_order LIMIT 1');
      const sampleWt = wtRes.rows[0];

      const itemRes = await client.query(
        `INSERT INTO quotation_items (
          quotation_id, item_index, window_name, window_type_id, window_type_name, width, height, measurement_unit, width_feet, height_feet, quantity, frame_running_feet, item_subtotal
        ) VALUES ($1, 1, 'Test Window', $2, $3, 3, 4, 'Feet', 3, 4, 1, 14, 1500) RETURNING id`,
        [originalQuotation.id, sampleWt.id, sampleWt.name]
      );
      const itemId = itemRes.rows[0].id;

      await client.query(
        `INSERT INTO window_components (
          quotation_item_id, profile_id, profile_name, profile_kg_snapshot, divisor_snapshot, profile_factor, running_feet, component_value
        ) VALUES ($1, NULL, 'Frame', 6.785, 19.0, 0.357105, 14, 4.999474)`,
        [itemId]
      );

      // Verify window_components snapshot stored
      const compRes = await client.query(
        `SELECT wc.* FROM window_components wc
         JOIN quotation_items qi ON wc.quotation_item_id = qi.id
         WHERE qi.quotation_id = $1`,
        [originalQuotation.id]
      );
      assert.equal(compRes.rows.length, 1);
      const comp = compRes.rows[0];
      assert.equal(parseFloat(comp.profile_kg_snapshot), 6.785);
      assert.equal(parseFloat(comp.divisor_snapshot), 19);
      assert.ok(comp.component_value > 0);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  t.after(async () => {
    await pool.end();
  });
});
