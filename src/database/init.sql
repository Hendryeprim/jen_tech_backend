-- JEN TECH Database Schema Initialization
-- UPVC Door & Window Cost Calculator, Quotation & Billing Software

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS invoice_tax_details CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS quotation_charges CASCADE;
DROP TABLE IF EXISTS window_components CASCADE;
DROP TABLE IF EXISTS quotation_items CASCADE;
DROP TABLE IF EXISTS quotations CASCADE;
DROP TABLE IF EXISTS additional_charge_types CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS window_types CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS company_settings CASCADE;

-- 1. Company Settings (Single row active configuration)
CREATE TABLE company_settings (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL DEFAULT 'JEN TECH UPVC & Glazing Systems',
    tagline VARCHAR(255) DEFAULT 'Premium Architectural UPVC Doors, Windows & Facade Solutions',
    logo_url TEXT,
    address_line1 VARCHAR(255) DEFAULT 'Plot No. 42, Sidco Industrial Estate Phase-II',
    address_line2 VARCHAR(255) DEFAULT 'Ambattur',
    city VARCHAR(100) DEFAULT 'Chennai',
    state VARCHAR(100) DEFAULT 'Tamil Nadu',
    state_code VARCHAR(10) DEFAULT '33',
    pincode VARCHAR(20) DEFAULT '600058',
    phone VARCHAR(50) DEFAULT '+91 98400 12345',
    email VARCHAR(150) DEFAULT 'contact@jentech.com',
    website VARCHAR(150) DEFAULT 'www.jentech.com',
    gstin VARCHAR(50) DEFAULT '33AABCT1332M1Z0',
    pan VARCHAR(50) DEFAULT 'AABCT1332M',
    bank_name VARCHAR(150) DEFAULT 'HDFC Bank',
    bank_account_number VARCHAR(100) DEFAULT '50200088991234',
    bank_ifsc VARCHAR(50) DEFAULT 'HDFC0001234',
    bank_branch VARCHAR(100) DEFAULT 'Ambattur Industrial Estate Branch, Chennai',
    fixed_divisor NUMERIC(10, 4) NOT NULL DEFAULT 19.0000,
    multiplication_rate NUMERIC(12, 2) NOT NULL DEFAULT 175.00,
    quotation_prefix VARCHAR(20) DEFAULT 'JT-Q-',
    invoice_prefix VARCHAR(20) DEFAULT 'JT-INV-',
    default_gst_rate NUMERIC(5, 2) DEFAULT 18.00,
    quotation_terms TEXT DEFAULT '1. 50% advance along with confirmed work order.\n2. 40% on delivery of materials at site before installation.\n3. 10% balance on completion.\n4. Delivery within 15-20 working days from confirmation.\n5. Quotation valid for 15 days.',
    invoice_terms TEXT DEFAULT '1. Goods once sold will not be taken back.\n2. Fabrication & product warranty for 1 year.\n3. Payments via NEFT/RTGS/Cheque in favor of JEN TECH.\n4. Subject to Chennai jurisdiction only.',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Authentication & Role Management)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'billing_staff' CHECK (role IN ('admin', 'manager', 'billing_staff')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Customers
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(200) NOT NULL,
    mobile_number VARCHAR(30),
    email VARCHAR(150),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100) DEFAULT 'Tamil Nadu',
    state_code VARCHAR(10) DEFAULT '33',
    gstin VARCHAR(50),
    project_name VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_name ON customers(customer_name);
CREATE INDEX idx_customers_mobile ON customers(mobile_number);

-- 4. Projects (Optional site/project linked to customer)
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    project_name VARCHAR(200) NOT NULL,
    site_address TEXT,
    city VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Window & Door Models
CREATE TABLE window_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'Window',
    panel_options JSONB DEFAULT '["2-Panel", "3-Panel", "4-Panel"]'::jsonb,
    default_panels VARCHAR(50) DEFAULT '2-Panel',
    illustration_type VARCHAR(50) DEFAULT 'sliding_window_2',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Profiles Master
CREATE TABLE profiles (
    id SERIAL PRIMARY KEY,
    window_type_id INT NOT NULL REFERENCES window_types(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    weight_kg NUMERIC(10, 4) NOT NULL,
    description VARCHAR(255),
    default_formula_type VARCHAR(50) DEFAULT 'manual', -- 'perimeter_frame', 'manual', 'custom'
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_window_type_profile_name UNIQUE (window_type_id, name)
);

CREATE INDEX idx_profiles_window_type ON profiles(window_type_id);

-- 7. Additional Charge Types Master
CREATE TABLE additional_charge_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50) UNIQUE NOT NULL,
    charge_scope VARCHAR(30) DEFAULT 'window' CHECK (charge_scope IN ('window', 'door', 'unit', 'quotation')),
    default_rate NUMERIC(12, 2) DEFAULT 0.00,
    unit VARCHAR(30) DEFAULT 'Nos',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Quotations
CREATE TABLE quotations (
    id SERIAL PRIMARY KEY,
    quotation_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    project_name VARCHAR(200),
    quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_until DATE,
    status VARCHAR(30) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Completed', 'Cancelled')),
    fixed_divisor NUMERIC(10, 4) NOT NULL DEFAULT 19.0000,
    multiplication_rate NUMERIC(12, 2) NOT NULL DEFAULT 175.00,
    calculated_subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    additional_charges_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(14, 2) DEFAULT 0.00,
    calculated_grand_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    manual_override_amount NUMERIC(14, 2),
    is_override_applied BOOLEAN DEFAULT FALSE,
    override_reason TEXT,
    final_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotations_number ON quotations(quotation_number);
CREATE INDEX idx_quotations_customer ON quotations(customer_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_date ON quotations(quotation_date);

-- 9. Quotation Items (Window & Door Items)
CREATE TABLE quotation_items (
    id SERIAL PRIMARY KEY,
    quotation_id INT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    item_index INT NOT NULL DEFAULT 1,
    window_name VARCHAR(200) NOT NULL,
    window_type_id INT REFERENCES window_types(id) ON DELETE RESTRICT,
    window_type_name VARCHAR(100) NOT NULL,
    panel_configuration VARCHAR(50) DEFAULT '2-Panel',
    width NUMERIC(10, 3) NOT NULL,
    height NUMERIC(10, 3) NOT NULL,
    measurement_unit VARCHAR(20) DEFAULT 'Feet' CHECK (measurement_unit IN ('Feet', 'Inches')),
    width_feet NUMERIC(10, 4) NOT NULL,
    height_feet NUMERIC(10, 4) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    frame_running_feet NUMERIC(10, 4) NOT NULL,
    total_profile_value NUMERIC(14, 6) NOT NULL DEFAULT 0.000000,
    window_profile_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    window_charges_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    item_subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotation_items_quotation ON quotation_items(quotation_id);

-- 10. Window Components (Historical Snapshot for recalculation integrity)
CREATE TABLE window_components (
    id SERIAL PRIMARY KEY,
    quotation_item_id INT NOT NULL REFERENCES quotation_items(id) ON DELETE CASCADE,
    profile_id INT REFERENCES profiles(id) ON DELETE SET NULL,
    profile_name VARCHAR(100) NOT NULL,
    profile_kg_snapshot NUMERIC(10, 4) NOT NULL,
    divisor_snapshot NUMERIC(10, 4) NOT NULL DEFAULT 19.0000,
    profile_factor NUMERIC(14, 8) NOT NULL,
    running_feet NUMERIC(10, 4) NOT NULL,
    component_value NUMERIC(14, 6) NOT NULL,
    formula_note VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_window_components_item ON window_components(quotation_item_id);

-- 11. Quotation Charges (Window-level or Quotation-level)
CREATE TABLE quotation_charges (
    id SERIAL PRIMARY KEY,
    quotation_id INT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    quotation_item_id INT REFERENCES quotation_items(id) ON DELETE CASCADE,
    charge_type_id INT REFERENCES additional_charge_types(id) ON DELETE SET NULL,
    charge_name VARCHAR(100) NOT NULL,
    charge_scope VARCHAR(30) DEFAULT 'window',
    rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit VARCHAR(30) DEFAULT 'Nos',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotation_charges_quotation ON quotation_charges(quotation_id);

-- 12. Invoices (GST & Non-GST)
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_type VARCHAR(20) NOT NULL CHECK (invoice_type IN ('GST', 'WITHOUT_GST')),
    quotation_id INT REFERENCES quotations(id) ON DELETE SET NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    project_name VARCHAR(200),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    company_gstin VARCHAR(50),
    customer_gstin VARCHAR(50),
    place_of_supply VARCHAR(100) DEFAULT 'Tamil Nadu',
    state_code VARCHAR(10) DEFAULT '33',
    is_interstate BOOLEAN DEFAULT FALSE,
    taxable_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    material_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    additional_charges_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    cgst_rate NUMERIC(5, 2) DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    sgst_rate NUMERIC(5, 2) DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    igst_rate NUMERIC(5, 2) DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) DEFAULT 0.00,
    total_tax_amount NUMERIC(12, 2) DEFAULT 0.00,
    discount_amount NUMERIC(14, 2) DEFAULT 0.00,
    round_off NUMERIC(6, 2) DEFAULT 0.00,
    final_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(30) DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid', 'Partially Paid', 'Paid', 'Cancelled')),
    payment_mode VARCHAR(50),
    notes TEXT,
    terms_and_conditions TEXT,
    delivery_to TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_type ON invoices(invoice_type);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);

-- 13. Invoice Items
CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_index INT NOT NULL DEFAULT 1,
    description VARCHAR(255) NOT NULL,
    width NUMERIC(10, 2),
    height NUMERIC(10, 2),
    total_sft NUMERIC(10, 2),
    price_per_sft NUMERIC(12, 2),
    hsn_code VARCHAR(20) DEFAULT '7610',
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    unit VARCHAR(20) DEFAULT 'Nos',
    unit_price NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    item_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    taxable_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- 14. Invoice Tax Details
CREATE TABLE invoice_tax_details (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    hsn_sac VARCHAR(20) DEFAULT '7610',
    taxable_value NUMERIC(14, 2) NOT NULL,
    cgst_rate NUMERIC(5, 2) DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    sgst_rate NUMERIC(5, 2) DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) DEFAULT 0.00,
    igst_rate NUMERIC(5, 2) DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) DEFAULT 0.00,
    total_tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Audit Logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- 16. Customer Reports (Ledger / Notebook Register)
CREATE TABLE IF NOT EXISTS customer_reports (
    id SERIAL PRIMARY KEY,
    serial_no INT,
    customer_name VARCHAR(255) NOT NULL,
    sqf NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    advance_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    balance_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    quotation_id INT REFERENCES quotations(id) ON DELETE SET NULL,
    invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    entry_date DATE DEFAULT CURRENT_DATE,
    payment_status VARCHAR(50) DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_reports_name ON customer_reports(customer_name);
CREATE INDEX IF NOT EXISTS idx_customer_reports_date ON customer_reports(entry_date);

-- 17. Way Bills (Transport Delivery Challan)
CREATE TABLE IF NOT EXISTS way_bills (
    id SERIAL PRIMARY KEY,
    way_bill_number VARCHAR(50) UNIQUE NOT NULL,
    way_bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
    dispatch_date DATE DEFAULT CURRENT_DATE,
    quotation_id INT REFERENCES quotations(id) ON DELETE SET NULL,
    invoice_id INT REFERENCES invoices(id) ON DELETE SET NULL,
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    consignee_name VARCHAR(255) NOT NULL,
    consignee_phone VARCHAR(50),
    consignee_address TEXT,
    consignee_gstin VARCHAR(50),
    delivery_address TEXT,
    place_of_supply VARCHAR(100) DEFAULT 'Tamil Nadu',
    vehicle_number VARCHAR(50),
    transporter_name VARCHAR(150),
    driver_name VARCHAR(100),
    driver_phone VARCHAR(50),
    status VARCHAR(30) DEFAULT 'Dispatched',
    items JSONB DEFAULT '[]'::jsonb,
    total_quantity NUMERIC(10, 2) DEFAULT 0,
    total_sqf NUMERIC(12, 2) DEFAULT 0,
    notes TEXT,
    terms TEXT,
    created_by INT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_way_bills_number ON way_bills(way_bill_number);
CREATE INDEX IF NOT EXISTS idx_way_bills_date ON way_bills(way_bill_date);
