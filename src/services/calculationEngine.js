/**
 * JEN TECH Calculation Engine
 * Accurate mathematical calculation for UPVC Windows, Profiles, Additional Charges & GST
 */

/**
 * Convert dimensions to feet if specified in inches
 */
function convertToFeet(value, unit = 'Feet') {
  const val = parseFloat(value) || 0;
  if (unit && unit.toLowerCase() === 'inches') {
    return Number((val / 12).toFixed(4));
  }
  return Number(val.toFixed(4));
}

/**
 * Calculate 4-sided rectangular frame running feet:
 * Top = Width, Bottom = Width, Left = Height, Right = Height
 * Total Frame Running Feet = 2 * Width + 2 * Height
 */
function calculateFrameRunningFeet(widthFeet, heightFeet, unit = null) {
  if (unit !== null && unit !== undefined) {
    const wFt = convertToFeet(widthFeet, unit);
    const hFt = convertToFeet(heightFeet, unit);
    const total = Number((2 * wFt + 2 * hFt).toFixed(4));
    return {
      width_feet: wFt,
      height_feet: hFt,
      top: wFt,
      bottom: wFt,
      left: hFt,
      right: hFt,
      total_running_feet: total,
    };
  }
  const w = parseFloat(widthFeet) || 0;
  const h = parseFloat(heightFeet) || 0;
  return Number((2 * w + 2 * h).toFixed(4));
}

/**
 * Calculate Profile Factor:
 * Profile Factor = Profile KG / Divisor (default 19)
 */
function calculateProfileFactor(weightKg, divisor = 19.0) {
  const kg = parseFloat(weightKg) || 0;
  const div = parseFloat(divisor) || 19.0;
  if (div === 0) return 0;
  return kg / div;
}

/**
 * Calculate Component Value:
 * Component Value = Running Feet * Profile Factor
 */
function calculateComponentValue(runningFeet, profileFactor) {
  const rf = parseFloat(runningFeet) || 0;
  const pf = parseFloat(profileFactor) || 0;
  return rf * pf;
}

/**
 * Calculate a single component's factor, value, and cost
 */
function calculateComponent(component, divisor = 19.0, rate = 175.0) {
  const weightKg = parseFloat(component.profile_kg || component.weight_kg || component.profile_kg_snapshot) || 0;
  const div = parseFloat(divisor) || 19.0;
  const factor = calculateProfileFactor(weightKg, div);
  const runningFeet = parseFloat(component.running_feet) || 0;
  const componentValue = calculateComponentValue(runningFeet, factor);
  const costRate = parseFloat(rate) || 175.0;
  const componentCost = Number((componentValue * costRate).toFixed(2));

  return {
    profile_id: component.profile_id || component.id || null,
    profile_name: component.profile_name || component.name || 'Profile',
    profile_kg_snapshot: Number(weightKg.toFixed(4)),
    divisor_snapshot: Number(div.toFixed(4)),
    profile_factor: factor,
    running_feet: Number(runningFeet.toFixed(4)),
    component_value: componentValue,
    component_cost: componentCost,
    formula_note: component.formula_note || '',
  };
}

/**
 * Automatically determine running feet based on verified client notebook formulas:
 * - Frame = 2W + 2H
 * - Sash (2-Panel) = 4H + 2W (e.g. 4x4 -> 24ft, 3x4 -> 22ft, 2x3 -> 16ft)
 * - Sash (3-Panel) = 6H + 2W
 * - Sash (4-Panel) = 8H + 2W
 * - Bead = Same as Sash perimeter (4H + 2W)
 * - Interlock (2-Panel) = 2H (e.g. 4x4 -> 8ft, 3x4 -> 8ft, 2x3 -> 6ft)
 * - Interlock (3-Panel / 4-Panel) = 4H
 */
function calculateAutoRunningFeet(compName, panelConfig, widthFeet, heightFeet, windowCategory = '', windowCode = '') {
  const rawName = (compName || '').trim();
  const name = rawName.toLowerCase();
  const cleanName = name.replace(/[\s\-_.]/g, ''); // "interlock", "doorsash", "meshscreen", "frame", "beading", "sash"
  const config = (panelConfig || '').toLowerCase();
  const category = (windowCategory || '').toLowerCase();
  const code = (windowCode || '').toUpperCase();
  const w = parseFloat(widthFeet) || 0;
  const h = parseFloat(heightFeet) || 0;

  const isOpenable = code.includes('OPEN') || category.includes('open') || config.includes('open') || config.includes('hung') || config.includes('casement');

  // Determine panel count accurately
  let panelCount = 2;
  if (config.includes('4-panel') || config.includes('4 panel') || config.includes('4-track') || config.includes('4')) {
    panelCount = 4;
  } else if (config.includes('3-panel') || config.includes('3 panel') || config.includes('3-track') || config.includes('3') || code.includes('TRACK_3') || name.includes('3-track')) {
    panelCount = 3;
  } else if (config.includes('single') || config.includes('1-panel') || config.includes('top hung') || config.includes('fanlight')) {
    panelCount = 1;
  } else if (config.includes('double')) {
    panelCount = 2;
  } else if (isOpenable) {
    panelCount = 1;
  }

  // 1. FRAME: 2W + 2H
  if (cleanName.includes('frame')) {
    const feet = Number((2 * w + 2 * h).toFixed(4));
    return {
      running_feet: feet,
      formula_note: `Outer Frame: 2W + 2H = 2(${w}) + 2(${h}) = ${feet} ft`,
    };
  }

  // 2. MESH SCREEN
  if (cleanName.includes('mesh')) {
    if (isOpenable) {
      if (panelCount === 2) {
        const feet = Number((2 * w + 4 * h).toFixed(4));
        return { running_feet: feet, formula_note: `Mesh Screen: 2W + 4H = 2(${w}) + 4(${h}) = ${feet} ft` };
      } else {
        const feet = Number((2 * w + 2 * h).toFixed(4));
        return { running_feet: feet, formula_note: `Mesh Screen: 2W + 2H = 2(${w}) + 2(${h}) = ${feet} ft` };
      }
    } else {
      // 1 sliding mosquito mesh shutter: 2H + W
      const feet = Number((2 * h + w).toFixed(4));
      return { running_feet: feet, formula_note: `Mesh Screen (1 Shutter): 2H + W = 2(${h}) + ${w} = ${feet} ft` };
    }
  }

  // 3. SASH
  if (cleanName.includes('sash')) {
    if (cleanName.includes('doorsash') || cleanName.includes('door')) {
      const isDoor = config.includes('door') || category.includes('door');
      if (!isDoor) {
        return { running_feet: 0, formula_note: '0 ft (Door Sash)' };
      }
    }

    if (isOpenable) {
      if (panelCount === 2) {
        const feet = Number((2 * w + 4 * h).toFixed(4));
        return { running_feet: feet, formula_note: `Double Sash: 2W + 4H = 2(${w}) + 4(${h}) = ${feet} ft` };
      } else {
        const feet = Number((2 * w + 2 * h).toFixed(4));
        return { running_feet: feet, formula_note: `Single Sash: 2W + 2H = 2(${w}) + 2(${h}) = ${feet} ft` };
      }
    } else {
      if (panelCount === 4) {
        const feet = Number((8 * h + 2 * w).toFixed(4));
        return { running_feet: feet, formula_note: `4-Panel Sash: 8H + 2W = 8(${h}) + 2(${w}) = ${feet} ft` };
      } else if (panelCount === 3) {
        const feet = Number((6 * h + 2 * w).toFixed(4));
        return { running_feet: feet, formula_note: `3-Panel Sash: 6H + 2W = 6(${h}) + 2(${w}) = ${feet} ft` };
      } else {
        // Standard 2-Panel sliding (Notebook formula: 4H + 2W)
        const feet = Number((4 * h + 2 * w).toFixed(4));
        return { running_feet: feet, formula_note: `2-Panel Sash: 4H + 2W = 4(${h}) + 2(${w}) = ${feet} ft` };
      }
    }
  }

  // 4. BEADING
  if (cleanName.includes('bead')) {
    if (isOpenable) {
      if (panelCount === 2) {
        const feet = Number((2 * w + 4 * h).toFixed(4));
        return { running_feet: feet, formula_note: `Double Bead: 2W + 4H = 2(${w}) + 4(${h}) = ${feet} ft` };
      } else {
        const feet = Number((2 * w + 2 * h).toFixed(4));
        return { running_feet: feet, formula_note: `Single Bead: 2W + 2H = 2(${w}) + 2(${h}) = ${feet} ft` };
      }
    } else {
      if (panelCount === 4) {
        const feet = Number((8 * h + 2 * w).toFixed(4));
        return { running_feet: feet, formula_note: `4-Panel Bead: 8H + 2W = 8(${h}) + 2(${w}) = ${feet} ft` };
      } else if (panelCount === 3) {
        const feet = Number((6 * h + 2 * w).toFixed(4));
        return { running_feet: feet, formula_note: `3-Panel Bead: 6H + 2W = 6(${h}) + 2(${w}) = ${feet} ft` };
      } else {
        const feet = Number((4 * h + 2 * w).toFixed(4));
        return { running_feet: feet, formula_note: `2-Panel Bead: 4H + 2W = 4(${h}) + 2(${w}) = ${feet} ft` };
      }
    }
  }

  // 5. INTERLOCK (Inlock / Meeting Stile)
  if (cleanName.includes('interlock') || cleanName.includes('inlock')) {
    if (isOpenable || panelCount === 1) {
      return { running_feet: 0, formula_note: '0 ft (Not Applicable)' };
    } else if (panelCount >= 3) {
      // 3-Panel or 4-Panel has 2 overlap joints = 4H
      const feet = Number((4 * h).toFixed(4));
      return { running_feet: feet, formula_note: `Interlock: 4H = 4(${h}) = ${feet} ft` };
    } else {
      // 2-Panel sliding (Notebook formula: 2H)
      const feet = Number((2 * h).toFixed(4));
      return { running_feet: feet, formula_note: `Interlock: 2H = 2(${h}) = ${feet} ft` };
    }
  }

  return {
    running_feet: 0,
    formula_note: 'Manual running feet',
  };
}

/**
 * Calculate complete single window item
 * @param {Object} itemData - Window specifications
 * @param {number} divisor - Company fixed divisor (default 19)
 * @param {number} rate - Company multiplication rate (default 175)
 */
function calculateWindowItem(itemData, divisor = 19.0, rate = 175.0) {
  const unit = itemData.measurement_unit || 'Feet';
  const widthRaw = parseFloat(itemData.width) || 0;
  const heightRaw = parseFloat(itemData.height) || 0;
  const widthFeet = convertToFeet(widthRaw, unit);
  const heightFeet = convertToFeet(heightRaw, unit);
  const quantity = Math.max(1, parseInt(itemData.quantity, 10) || 1);
  const panelConfig = itemData.panel_configuration || '2-Panel';

  // 4-sided frame running feet calculation
  const frameRunningFeet = calculateFrameRunningFeet(widthFeet, heightFeet);

  const calculatedComponents = [];
  let totalProfileValue = 0;

  // Process components
  const components = Array.isArray(itemData.components) ? itemData.components : [];
  for (const comp of components) {
    const weightKg = parseFloat(comp.profile_kg || comp.weight_kg || comp.profile_kg_snapshot) || 0;
    const factor = calculateProfileFactor(weightKg, divisor);
    
    let runningFeet = parseFloat(comp.running_feet);
    let formulaNote = comp.formula_note || '';

    // If running feet is not specified or 0, compute using client notebook formulas
    if (isNaN(runningFeet) || runningFeet === null || runningFeet === undefined || runningFeet === 0) {
      const auto = calculateAutoRunningFeet(
        comp.profile_name || comp.name,
        panelConfig,
        widthFeet,
        heightFeet,
        itemData.category || itemData.window_category || '',
        itemData.code || itemData.window_code || itemData.window_name || ''
      );
      if (auto && auto.running_feet > 0) {
        runningFeet = auto.running_feet;
        formulaNote = auto.formula_note;
      } else {
        runningFeet = 0;
        formulaNote = comp.formula_note || 'Manual running feet: 0 ft';
      }
    } else {
      formulaNote = comp.formula_note || `Running feet: ${runningFeet} ft`;
    }

    const componentValue = calculateComponentValue(runningFeet, factor);
    totalProfileValue += componentValue;

    calculatedComponents.push({
      profile_id: comp.profile_id || comp.id || null,
      profile_name: comp.profile_name || comp.name || 'Profile',
      profile_kg_snapshot: Number(weightKg.toFixed(4)),
      divisor_snapshot: Number(divisor.toFixed(4)),
      profile_factor: Number(factor.toFixed(8)),
      running_feet: Number(runningFeet.toFixed(4)),
      component_value: Number(componentValue.toFixed(6)),
      component_cost: Number((componentValue * rate).toFixed(2)),
      formula_note: formulaNote,
    });
  }

  // Window Profile Cost = Total Profile Value * multiplication rate (175)
  const windowProfileCost = Number((totalProfileValue * rate).toFixed(2));

  // Additional charges for this window
  let windowChargesTotal = 0;
  const calculatedCharges = [];
  const charges = Array.isArray(itemData.charges) ? itemData.charges : [];

  for (const ch of charges) {
    const chRate = parseFloat(ch.rate) || 0;
    const chQty = parseFloat(ch.quantity) || 1;
    const chAmount = Number((chRate * chQty).toFixed(2));
    windowChargesTotal += chAmount;

    calculatedCharges.push({
      charge_type_id: ch.charge_type_id || null,
      charge_name: ch.charge_name || ch.name || 'Additional Charge',
      charge_scope: 'window',
      rate: chRate,
      quantity: chQty,
      unit: ch.unit || 'Nos',
      amount: chAmount,
    });
  }

  // Unit Cost = Profile Cost + Additional Charges (per window)
  const unitCost = Number((windowProfileCost + windowChargesTotal).toFixed(2));
  // Item Subtotal = Unit Cost * Quantity
  const itemSubtotal = Number((unitCost * quantity).toFixed(2));

  // Client Area and Square Feet Rate
  const areaSqFt = Number((widthFeet * heightFeet).toFixed(2));
  const costPerSqFt = areaSqFt > 0 ? Number((unitCost / areaSqFt).toFixed(2)) : 0;

  return {
    item_index: itemData.item_index || 1,
    window_name: itemData.window_name || 'Window',
    window_type_id: itemData.window_type_id || null,
    window_type_name: itemData.window_type_name || '',
    panel_configuration: panelConfig,
    width: widthRaw,
    height: heightRaw,
    measurement_unit: unit,
    width_feet: widthFeet,
    height_feet: heightFeet,
    area_sqft: areaSqFt,
    cost_per_sqft: costPerSqFt,
    quantity,
    frame_running_feet: frameRunningFeet,
    components: calculatedComponents,
    charges: calculatedCharges,
    total_profile_value: Number(totalProfileValue.toFixed(6)),
    window_profile_cost: windowProfileCost,
    window_charges_total: Number(windowChargesTotal.toFixed(2)),
    unit_cost: unitCost,
    item_subtotal: itemSubtotal,
    remarks: itemData.remarks || '',
  };
}

/**
 * Calculate full quotation
 */
/**
 * Calculate full quotation
 */
function calculateQuotation(
  quotationData = {},
  divisorArg = null,
  rateArg = null
) {
  const {
    items = [],
    quotation_charges = [],
    discount_amount = 0,
    manual_override_amount = null,
    is_override_applied = false,
    override_reason = '',
    divisor: optDivisor = 19.0,
    rate: optRate = 175.0,
    is_gst_applied = false,
    gst_rate = 18.0,
    is_interstate = false,
  } = quotationData;

  const divisor = divisorArg !== null && divisorArg !== undefined ? parseFloat(divisorArg) : (parseFloat(optDivisor) || 19.0);
  const rate = rateArg !== null && rateArg !== undefined ? parseFloat(rateArg) : (parseFloat(optRate) || 175.0);

  const calculatedItems = [];
  let itemsSubtotal = 0;
  let itemsChargesTotal = 0;

  for (let i = 0; i < items.length; i++) {
    const item = calculateWindowItem({ ...items[i], item_index: i + 1 }, divisor, rate);
    calculatedItems.push(item);
    itemsSubtotal += item.item_subtotal;
    itemsChargesTotal += (item.window_charges_total * item.quantity);
  }

  // Quotation-level charges (e.g. transport, installation, craning)
  let quotationLevelChargesTotal = 0;
  const calculatedQuotationCharges = [];
  for (const qch of quotation_charges) {
    const chRate = parseFloat(qch.rate) || 0;
    const chQty = parseFloat(qch.quantity) || 1;
    const amount = Number((chRate * chQty).toFixed(2));
    quotationLevelChargesTotal += amount;

    calculatedQuotationCharges.push({
      charge_type_id: qch.charge_type_id || null,
      charge_name: qch.charge_name || qch.name || 'Charge',
      charge_scope: 'quotation',
      rate: chRate,
      quantity: chQty,
      unit: qch.unit || 'Lump Sum',
      amount,
    });
  }

  const allAdditionalCharges = Number((itemsChargesTotal + quotationLevelChargesTotal).toFixed(2));
  const calculatedGrandTotal = Number((itemsSubtotal + quotationLevelChargesTotal).toFixed(2));
  const discount = Math.max(0, parseFloat(discount_amount) || 0);

  const netCalculatedTotal = Number(Math.max(0, calculatedGrandTotal - discount).toFixed(2));

  // GST Calculation
  const isGst = Boolean(is_gst_applied);
  const taxRate = isGst ? (parseFloat(gst_rate) || 18.0) : 0;
  const taxableAmount = netCalculatedTotal;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  let totalTaxAmount = 0;

  if (isGst && taxRate > 0) {
    if (is_interstate) {
      igstAmount = Number(((taxableAmount * taxRate) / 100).toFixed(2));
      totalTaxAmount = igstAmount;
    } else {
      const halfRate = taxRate / 2;
      cgstAmount = Number(((taxableAmount * halfRate) / 100).toFixed(2));
      sgstAmount = Number(((taxableAmount * halfRate) / 100).toFixed(2));
      totalTaxAmount = Number((cgstAmount + sgstAmount).toFixed(2));
    }
  }

  let finalAmount = Number((netCalculatedTotal + totalTaxAmount).toFixed(2));
  let hasOverride = Boolean(is_override_applied && manual_override_amount !== null && manual_override_amount !== undefined && manual_override_amount !== '');

  if (hasOverride) {
    finalAmount = Number(parseFloat(manual_override_amount).toFixed(2));
  }

  return {
    items: calculatedItems,
    quotation_charges: calculatedQuotationCharges,
    fixed_divisor: Number(divisor.toFixed(4)),
    multiplication_rate: Number(rate.toFixed(2)),
    calculated_subtotal: Number(itemsSubtotal.toFixed(2)),
    additional_charges_total: Number(quotationLevelChargesTotal.toFixed(2)),
    quotation_level_charges_total: Number(quotationLevelChargesTotal.toFixed(2)),
    all_additional_charges_total: allAdditionalCharges,
    discount_amount: discount,
    calculated_grand_total: calculatedGrandTotal,
    is_gst_applied: isGst,
    gst_rate: taxRate,
    taxable_amount: taxableAmount,
    cgst_amount: cgstAmount,
    sgst_amount: sgstAmount,
    igst_amount: igstAmount,
    total_tax_amount: totalTaxAmount,
    manual_override_amount: hasOverride ? Number(parseFloat(manual_override_amount).toFixed(2)) : null,
    is_override_applied: hasOverride,
    override_reason: hasOverride ? override_reason : null,
    final_amount: finalAmount,
  };
}

/**
 * Calculate GST Invoice totals
 */
function calculateGstInvoice({
  taxable_amount = 0,
  material_cost = 0,
  additional_charges_total = 0,
  items = [],
  is_interstate = false,
  gst_rate = 18.0,
  cgst_rate = null,
  sgst_rate = null,
  igst_rate = null,
  discount_amount = 0,
}) {
  const matCost = parseFloat(material_cost) || 0;
  const addCharges = parseFloat(additional_charges_total) || 0;
  const discount = Math.max(0, parseFloat(discount_amount) || 0);

  let gross = matCost + addCharges;
  if (!gross && Array.isArray(items) && items.length > 0) {
    gross = items.reduce((sum, it) => {
      const q = parseFloat(it.quantity) || 1;
      const p = parseFloat(it.unit_price ?? it.rate ?? it.amount ?? 0);
      return sum + (parseFloat(it.item_total) || (q * p));
    }, 0);
  }
  if (!gross) {
    gross = parseFloat(taxable_amount) || 0;
  }

  // Prevent double discount if caller already subtracted discount from taxable_amount
  const passedTaxable = parseFloat(taxable_amount) || 0;
  let netTaxable;
  if (passedTaxable > 0 && Math.abs(passedTaxable - (gross - discount)) < 1) {
    netTaxable = passedTaxable;
  } else {
    netTaxable = Math.max(0, gross - discount);
  }

  let finalCgstRate = 0;
  let finalCgstAmount = 0;
  let finalSgstRate = 0;
  let finalSgstAmount = 0;
  let finalIgstRate = 0;
  let finalIgstAmount = 0;

  const defaultRate = parseFloat(gst_rate) || 18.0;

  if (is_interstate) {
    finalIgstRate = igst_rate !== null && igst_rate !== undefined ? parseFloat(igst_rate) : defaultRate;
    finalIgstAmount = Number(((netTaxable * finalIgstRate) / 100).toFixed(2));
  } else {
    finalCgstRate = cgst_rate !== null && cgst_rate !== undefined ? parseFloat(cgst_rate) : (defaultRate / 2);
    finalCgstAmount = Number(((netTaxable * finalCgstRate) / 100).toFixed(2));
    finalSgstRate = sgst_rate !== null && sgst_rate !== undefined ? parseFloat(sgst_rate) : (defaultRate / 2);
    finalSgstAmount = Number(((netTaxable * finalSgstRate) / 100).toFixed(2));
  }

  const totalTax = Number((finalCgstAmount + finalSgstAmount + finalIgstAmount).toFixed(2));
  const rawFinal = netTaxable + totalTax;
  const roundedFinal = Math.round(rawFinal);
  const roundOff = Number((roundedFinal - rawFinal).toFixed(2));

  return {
    taxable_amount: Number(netTaxable.toFixed(2)),
    subtotal: Number(gross.toFixed(2)),
    discount_amount: discount,
    is_interstate,
    cgst_rate: finalCgstRate,
    cgst_amount: finalCgstAmount,
    sgst_rate: finalSgstRate,
    sgst_amount: finalSgstAmount,
    igst_rate: finalIgstRate,
    igst_amount: finalIgstAmount,
    total_tax_amount: totalTax,
    round_off: roundOff,
    final_amount: roundedFinal,
  };
}

/**
 * Calculate Without-GST Invoice totals
 */
function calculateWithoutGstInvoice({
  taxable_amount = 0,
  material_cost = 0,
  additional_charges_total = 0,
  items = [],
  discount_amount = 0,
}) {
  let matCost = parseFloat(material_cost) || 0;
  const addCharges = parseFloat(additional_charges_total) || 0;
  if (!matCost && !addCharges && Array.isArray(items) && items.length > 0) {
    matCost = items.reduce((sum, it) => {
      const q = parseFloat(it.quantity) || 1;
      const p = parseFloat(it.unit_price ?? it.rate ?? it.amount ?? 0);
      return sum + (parseFloat(it.item_total) || (q * p));
    }, 0);
  }
  if (!matCost && !addCharges && parseFloat(taxable_amount) > 0) {
    matCost = parseFloat(taxable_amount) || 0;
  }
  const subtotal = Number((matCost + addCharges).toFixed(2));
  const discount = Math.max(0, parseFloat(discount_amount) || 0);
  const rawFinal = Math.max(0, subtotal - discount);
  const roundedFinal = Math.round(rawFinal);
  const roundOff = Number((roundedFinal - rawFinal).toFixed(2));

  return {
    taxable_amount: subtotal,
    material_cost: Number(matCost.toFixed(2)),
    additional_charges_total: Number(addCharges.toFixed(2)),
    subtotal: subtotal,
    discount_amount: discount,
    cgst_rate: 0,
    cgst_amount: 0,
    sgst_rate: 0,
    sgst_amount: 0,
    igst_rate: 0,
    igst_amount: 0,
    total_tax_amount: 0,
    round_off: roundOff,
    final_amount: roundedFinal,
  };
}

module.exports = {
  convertToFeet,
  calculateFrameRunningFeet,
  calculateProfileFactor,
  calculateComponentValue,
  calculateComponent,
  calculateAutoRunningFeet,
  calculateWindowItem,
  calculateQuotation,
  calculateGstInvoice,
  calculateWithoutGstInvoice,
  calculateNonGstInvoice: calculateWithoutGstInvoice,
};
