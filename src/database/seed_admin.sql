-- ==============================================================================
-- JEN TECH Live Server SQL Seed: Admin & Staff User Credentials
-- ==============================================================================

-- 1. Operations Manager / Admin User
-- Email:    manager@jentech.com
-- Password: JenTech@2026Mgr
-- Role:     admin (full access to Settings, Calculator, Invoices, Quotations, Users)
INSERT INTO users (name, email, password_hash, role, is_active)
VALUES (
  'Operations Manager',
  'manager@jentech.com',
  '$2a$10$pHimTPwjBZuYLFbgXDvEKOYawx0Kj71WHASVMoIRDTa25Ia15D2tu',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'admin',
  is_active = true;

-- 2. Backup Admin User
-- Email:    admin@jentech.com
-- Password: JenTech@2026Admin
-- Role:     admin
INSERT INTO users (name, email, password_hash, role, is_active)
VALUES (
  'Admin User',
  'admin@jentech.com',
  '$2a$10$n591Zd14zenfXPNwMaBf0OFpXBUWmJglF2yI5u7YIaF1GoBaiKnLK',
  'admin',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'admin',
  is_active = true;

-- 3. Billing Staff
-- Email:    staff@jentech.com
-- Password: JenTech@2026Staff
-- Role:     billing_staff
INSERT INTO users (name, email, password_hash, role, is_active)
VALUES (
  'Billing Staff',
  'staff@jentech.com',
  '$2a$10$2IiIXHCRTvLBh2NtGuTnqezIswRZZR5RxXSsimaf8VOEcS/Aue/Ki',
  'billing_staff',
  true
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'billing_staff',
  is_active = true;
