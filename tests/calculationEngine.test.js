const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateFrameRunningFeet,
  calculateProfileFactor,
  calculateComponentValue,
  calculateWindowItem,
  calculateQuotation,
  calculateGstInvoice,
  calculateWithoutGstInvoice,
  convertToFeet,
} = require('../src/services/calculationEngine');

test('JEN TECH Calculation Engine Test Suite', async (t) => {
  await t.test('1. Test Example from prompt: Frame KG = 6.018, Divisor = 19, Running Feet = 16', () => {
    const frameKg = 6.018;
    const divisor = 19;
    const runningFeet = 16;

    const factor = calculateProfileFactor(frameKg, divisor);
    // Profile Factor = 6.018 / 19 = 0.3167368421...
    assert.ok(Math.abs(factor - 0.3167368421) < 1e-6, `Factor was ${factor}`);

    const componentValue = calculateComponentValue(runningFeet, factor);
    // Component Value = 16 * 0.3167368421 = 5.0677894736...
    assert.ok(Math.abs(componentValue - 5.0677894736) < 1e-4, `Component Value was ${componentValue}`);

    const cost = componentValue * 175;
    assert.equal(cost.toFixed(2), '886.86');
  });

  await t.test('2. Four-sided Frame calculation: Width = 3, Height = 4 => Total Frame = 14 feet', () => {
    const width = 3;
    const height = 4;
    const totalFrame = calculateFrameRunningFeet(width, height);
    // 2 * 3 + 2 * 4 = 14
    assert.equal(totalFrame, 14);
  });

  await t.test('3. Measurement unit conversion: 36 inches x 48 inches should convert to 3 ft x 4 ft', () => {
    assert.equal(convertToFeet(36, 'Inches'), 3);
    assert.equal(convertToFeet(48, 'Inches'), 4);
    assert.equal(calculateFrameRunningFeet(convertToFeet(36, 'Inches'), convertToFeet(48, 'Inches')), 14);
  });

  await t.test('4. Manual running-feet override takes precedence over auto-formula', () => {
    const item = calculateWindowItem({
      window_name: 'Custom Sliding Window',
      width: 5,
      height: 4,
      measurement_unit: 'Feet',
      quantity: 1,
      components: [
        {
          name: 'Frame',
          weight_kg: 6.785,
          running_feet: 22, // Overridden manually to 22 instead of 2*(5+4)=18
        },
      ],
    }, 19, 175);

    assert.equal(item.components[0].running_feet, 22);
    // Factor = 6.785 / 19 = 0.35710526
    // Value = 22 * 0.35710526 = 7.8563158
    assert.ok(Math.abs(item.components[0].component_value - 7.856316) < 1e-3);
  });

  await t.test('5. Window calculation with multiple components & additional charges', () => {
    const item = calculateWindowItem({
      window_name: 'Living Room W-1',
      width: 3,
      height: 4,
      quantity: 2,
      components: [
        { name: 'Frame', weight_kg: 6.018 }, // Auto uses 14 ft
        { name: 'Sash', weight_kg: 6.726, running_feet: 14 },
      ],
      charges: [
        { name: 'Touch Lock', rate: 250, quantity: 1 },
        { name: 'Glass', rate: 95, quantity: 12 }, // 12 sqft * 95 = 1140
      ],
    }, 19, 175);

    // Frame value = 14 * (6.018/19) = 4.434316
    // Sash value = 14 * (6.726/19) = 4.956000
    // Total profile value = 9.390316
    // Profile cost = 9.390316 * 175 = 1643.31
    assert.equal(item.window_profile_cost, 1643.31);
    // Window charges = 250 + 1140 = 1390
    assert.equal(item.window_charges_total, 1390);
    // Unit cost = 1643.31 + 1390 = 3033.31
    assert.equal(item.unit_cost, 3033.31);
    // Quantity 2 => Subtotal = 3033.31 * 2 = 6066.62
    assert.equal(item.item_subtotal, 6066.62);
  });

  await t.test('6. Multiple windows quotation calculation with quantity & quotation-level charges', () => {
    const quotation = calculateQuotation({
      items: [
        {
          window_name: 'W1',
          width: 3,
          height: 4,
          quantity: 2,
          components: [{ name: 'Frame', weight_kg: 6.018 }],
          charges: [],
        },
        {
          window_name: 'W2',
          width: 4,
          height: 5,
          quantity: 1,
          components: [{ name: 'Frame', weight_kg: 6.785 }],
          charges: [],
        },
      ],
      quotation_charges: [
        { name: 'Transportation', rate: 1500, quantity: 1 },
      ],
      discount_amount: 500,
      divisor: 19,
      rate: 175,
    });

    assert.equal(quotation.items.length, 2);
    assert.equal(quotation.quotation_charges.length, 1);
    assert.ok(quotation.calculated_grand_total > 0);
    assert.equal(quotation.discount_amount, 500);
    assert.equal(quotation.final_amount, Number((quotation.calculated_grand_total - 500).toFixed(2)));
  });

  await t.test('7. Manual Final Amount Override preserves calculated values', () => {
    const quotation = calculateQuotation({
      items: [
        {
          window_name: 'W1',
          width: 3,
          height: 4,
          quantity: 1,
          components: [{ name: 'Frame', weight_kg: 6.018 }],
        },
      ],
      manual_override_amount: 5000.00,
      is_override_applied: true,
      override_reason: 'Special client discount agreed by director',
      divisor: 19,
      rate: 175,
    });

    assert.equal(quotation.is_override_applied, true);
    assert.equal(quotation.manual_override_amount, 5000.00);
    assert.equal(quotation.final_amount, 5000.00);
    // Calculated total is distinct and preserved
    assert.notEqual(quotation.calculated_grand_total, 5000.00);
    assert.equal(quotation.override_reason, 'Special client discount agreed by director');
  });

  await t.test('8. GST Invoice calculation (Intra-state: CGST 9% + SGST 9%)', () => {
    const gstCalc = calculateGstInvoice({
      taxable_amount: 10000,
      is_interstate: false,
      gst_rate: 18,
    });

    assert.equal(gstCalc.taxable_amount, 10000);
    assert.equal(gstCalc.cgst_rate, 9);
    assert.equal(gstCalc.cgst_amount, 900);
    assert.equal(gstCalc.sgst_rate, 9);
    assert.equal(gstCalc.sgst_amount, 900);
    assert.equal(gstCalc.igst_amount, 0);
    assert.equal(gstCalc.total_tax_amount, 1800);
    assert.equal(gstCalc.final_amount, 11800);
  });

  await t.test('9. GST Invoice calculation (Inter-state: IGST 18%)', () => {
    const gstCalc = calculateGstInvoice({
      taxable_amount: 10000,
      is_interstate: true,
      gst_rate: 18,
    });

    assert.equal(gstCalc.taxable_amount, 10000);
    assert.equal(gstCalc.cgst_amount, 0);
    assert.equal(gstCalc.sgst_amount, 0);
    assert.equal(gstCalc.igst_rate, 18);
    assert.equal(gstCalc.igst_amount, 1800);
    assert.equal(gstCalc.total_tax_amount, 1800);
    assert.equal(gstCalc.final_amount, 11800);
  });

  await t.test('10. Without-GST Invoice does NOT include separate tax line', () => {
    const nonGstCalc = calculateWithoutGstInvoice({
      material_cost: 8500,
      additional_charges_total: 1500,
      discount_amount: 200,
    });

    assert.equal(nonGstCalc.material_cost, 8500);
    assert.equal(nonGstCalc.additional_charges_total, 1500);
    assert.equal(nonGstCalc.subtotal, 10000);
    assert.equal(nonGstCalc.total_tax_amount, 0);
    assert.equal(nonGstCalc.final_amount, 9800);
  });
});
