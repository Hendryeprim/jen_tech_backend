const { pool } = require('../config/db');

async function migrate() {
  console.log('Running migration for way_bills and customer_reports...');
  
  await pool.query(`
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

    CREATE INDEX IF NOT EXISTS idx_customer_reports_name ON customer_reports(customer_name);
    CREATE INDEX IF NOT EXISTS idx_customer_reports_date ON customer_reports(entry_date);
    CREATE INDEX IF NOT EXISTS idx_way_bills_number ON way_bills(way_bill_number);
    CREATE INDEX IF NOT EXISTS idx_way_bills_date ON way_bills(way_bill_date);
  `);

  console.log('Successfully created way_bills and customer_reports tables!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

