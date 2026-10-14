-- ============================================================================
-- Mediconny Clinic & Supplement Shop — Relational Database Schema (SQL)
-- Compatible with SQLite 3.x and PostgreSQL 14+
-- Supports: Clinic Settings, Staff Users, Patients Database, Vitamin &
--           Supplement Inventory, Clinic Appointments, POS Sales, Line Items
--           (Products + Consultation Fees), and Split Payments (MoMo/Cash/Card)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Clinic & Receipt Header Configuration
CREATE TABLE IF NOT EXISTS clinic_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    clinic_name TEXT NOT NULL DEFAULT 'Mediconny Clinic & Supplement Shop',
    currency TEXT NOT NULL DEFAULT 'GHC',
    address TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    tax_id TEXT DEFAULT '',
    receipt_footer TEXT NOT NULL DEFAULT 'Thank you for visiting Mediconny Clinic & Shop!',
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 2. Staff Users (Multi-device Clinic & Shop Access)
CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Clinician', 'Pharmacist/Shop', 'Receptionist')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

-- 3. Patients Database
CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    patient_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT DEFAULT '',
    dob TEXT DEFAULT '',
    gender TEXT DEFAULT '',
    allergies TEXT DEFAULT '',
    medical_notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

-- 4. Vitamin & Supplements Inventory
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    form_type TEXT DEFAULT '',
    unit_cost REAL NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
    selling_price REAL NOT NULL DEFAULT 0.00 CHECK (selling_price >= 0),
    stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
    reorder_level INTEGER NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
    batch_number TEXT DEFAULT '',
    expiry_date TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory(expiry_date);

-- 5. Clinic Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    patient_id TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    visit_type TEXT NOT NULL,
    consultation_fee REAL NOT NULL DEFAULT 0.00 CHECK (consultation_fee >= 0),
    clinician TEXT NOT NULL DEFAULT 'Mediconny Clinic',
    status TEXT NOT NULL DEFAULT 'Scheduled'
        CHECK (status IN ('Scheduled', 'Checked In', 'Completed', 'Cancelled', 'No-Show')),
    clinical_notes TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);

-- 6. POS Sales & Clinic Billing Headers
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    receipt_no TEXT NOT NULL UNIQUE,
    sale_timestamp TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    patient_id TEXT DEFAULT NULL,
    patient_name TEXT NOT NULL DEFAULT 'Walk-In Customer',
    appointment_id TEXT DEFAULT NULL,
    products_subtotal REAL NOT NULL DEFAULT 0.00,
    consultation_type TEXT DEFAULT '',
    consultation_fee REAL NOT NULL DEFAULT 0.00,
    discount_amount REAL NOT NULL DEFAULT 0.00,
    tax_rate REAL NOT NULL DEFAULT 0.00,
    tax_amount REAL NOT NULL DEFAULT 0.00,
    total_due REAL NOT NULL DEFAULT 0.00,
    total_paid REAL NOT NULL DEFAULT 0.00,
    change_due REAL NOT NULL DEFAULT 0.00,
    payment_summary TEXT NOT NULL,
    sale_note TEXT DEFAULT '',
    cashier_name TEXT DEFAULT 'Shop Desk',
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(sale_timestamp);
CREATE INDEX IF NOT EXISTS idx_sales_patient ON sales(patient_id);

-- 7. POS Sale Line Items (Vitamins & Supplements Sold)
CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id TEXT NOT NULL,
    product_id TEXT DEFAULT NULL,
    sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    unit_price REAL NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total REAL NOT NULL CHECK (line_total >= 0),
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES inventory(id) ON DELETE SET NULL
);

-- 8. POS Split Payments (Supports Mobile Money + Cash + Card on a Single Sale)
CREATE TABLE IF NOT EXISTS sale_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id TEXT NOT NULL,
    payment_method TEXT NOT NULL
        CHECK (payment_method IN ('Cash', 'Mobile Money (MoMo)', 'Card / POS Terminal', 'Bank Transfer', 'Clinic Account')),
    amount REAL NOT NULL CHECK (amount > 0),
    reference_note TEXT DEFAULT '',
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
